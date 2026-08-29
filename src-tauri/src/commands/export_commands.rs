use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use rayon::prelude::*;
use tauri::{AppHandle, Emitter, State};
use crate::db::{AlbumPayload, Database, ProjectRow, SpreadPayload};
use crate::export_engine::{
    assemble_pdf_from_jpegs, render_spread_to_image_with_progress, split_spread_into_pages,
    ExportOptions, ExportProgressEvent,
};

#[tauri::command]
pub async fn select_export_directory() -> Result<Option<String>, String> {
    let folder: Option<PathBuf> = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Select Export Destination Folder")
            .pick_folder()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn open_export_directory(dir_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&dir_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory in Explorer: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&dir_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&dir_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }
    Ok(())
}

fn export_album_high_res_worker(
    app: AppHandle,
    project: ProjectRow,
    album: AlbumPayload,
    options: ExportOptions,
) -> Result<ExportProgressEvent, String> {
    let output_path = PathBuf::from(&options.output_dir);
    if !output_path.exists() {
        fs::create_dir_all(&output_path).map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let mut candidate_spreads = Vec::new();
    // Only include cover spread if it has elements and was explicitly requested
    if !album.cover_spread.elements.is_empty() {
        candidate_spreads.push(album.cover_spread);
    }
    candidate_spreads.extend(album.spreads);

    let spreads: Vec<SpreadPayload> = if let Some(ref selected_ids) = options.selected_spread_ids {
        if !selected_ids.is_empty() {
            candidate_spreads
                .into_iter()
                .filter(|s| selected_ids.contains(&s.id))
                .collect()
        } else {
            candidate_spreads
        }
    } else {
        candidate_spreads
    };

    let total_spreads = spreads.len();
    if total_spreads == 0 {
        return Err("No spreads selected to export".to_string());
    }

    // Count total photos across all selected spreads for exact percentage calculation
    let total_photos: usize = spreads.iter().map(|s| s.elements.len()).sum();
    let completed_photos = Arc::new(AtomicUsize::new(0));

    // Emit initial progress
    let _ = app.emit(
        "export-progress",
        &ExportProgressEvent {
            current: 0,
            total: total_spreads,
            current_photos: 0,
            total_photos,
            percent: 0.0,
            spread_name: "Initializing".to_string(),
            status: format!("Starting multi-core export (0 of {} photos)...", total_photos),
            is_finished: false,
            output_files: Vec::new(),
        },
    );

    // Thread-safe container for parallel results (preserves index for sequential ordering)
    let results: Arc<Mutex<Vec<(usize, Vec<String>, Vec<(PathBuf, u32, u32)>)>>> =
        Arc::new(Mutex::new(Vec::new()));

    // Parallel multi-core rendering across all CPU threads via Rayon!
    spreads
        .par_iter()
        .enumerate()
        .try_for_each(|(idx, spread)| -> Result<(), String> {
            let current_num = idx + 1;
            let spread_name = if spread.r#type == "cover" {
                "Cover Spread".to_string()
            } else {
                format!("Spread {:02}", spread.spread_index)
            };

            let completed_photos_clone = completed_photos.clone();
            let app_handle = app.clone();

            // Render spread to high resolution bitmap with live photo-by-photo atomic progress
            let spread_img = render_spread_to_image_with_progress(
                &project,
                spread,
                options.dpi,
                options.include_bleed,
                |_photo_idx, _total_photos_in_spread| {
                    let done = completed_photos_clone.fetch_add(1, Ordering::SeqCst) + 1;
                    let pct = if total_photos > 0 {
                        ((done as f64 / total_photos as f64) * 90.0).clamp(1.0, 95.0)
                    } else {
                        ((current_num as f64 / total_spreads as f64) * 90.0).clamp(1.0, 95.0)
                    };

                    let _ = app_handle.emit(
                        "export-progress",
                        &ExportProgressEvent {
                            current: current_num,
                            total: total_spreads,
                            current_photos: done,
                            total_photos,
                            percent: pct,
                            spread_name: spread_name.clone(),
                            status: format!("Compositing photo {} of {} (Spread {}/{})", done, total_photos, current_num, total_spreads),
                            is_finished: false,
                            output_files: Vec::new(),
                        },
                    );
                },
            );

            let mut local_output_files = Vec::new();
            let mut local_temp_jpegs = Vec::new();

            // Handle Split Pages vs Full Spread
            if options.split_pages && spread.r#type != "cover" {
                let (left_page, right_page) = split_spread_into_pages(&spread_img, &project, spread, options.dpi, options.include_bleed);
                let left_num = (spread.spread_index - 1) * 2 + 1;
                let right_num = left_num + 1;

                let ext = if options.format == "png" { "png" } else { "jpg" };
                let left_filename = format!("Page_{:03}.{}", left_num, ext);
                let right_filename = format!("Page_{:03}.{}", right_num, ext);

                let left_path = output_path.join(&left_filename);
                let right_path = output_path.join(&right_filename);

                if options.format == "png" {
                    left_page.save_with_format(&left_path, image::ImageFormat::Png)
                        .map_err(|e| format!("Failed to save {}: {}", left_path.display(), e))?;
                    right_page.save_with_format(&right_path, image::ImageFormat::Png)
                        .map_err(|e| format!("Failed to save {}: {}", right_path.display(), e))?;
                } else {
                    // JPEG
                    let left_rgb = image::DynamicImage::ImageRgba8(left_page).to_rgb8();
                    let mut left_f = fs::File::create(&left_path).map_err(|e| e.to_string())?;
                    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut left_f, options.jpeg_quality);
                    encoder.encode_image(&left_rgb).map_err(|e| e.to_string())?;

                    let right_rgb = image::DynamicImage::ImageRgba8(right_page).to_rgb8();
                    let mut right_f = fs::File::create(&right_path).map_err(|e| e.to_string())?;
                    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut right_f, options.jpeg_quality);
                    encoder.encode_image(&right_rgb).map_err(|e| e.to_string())?;

                    if options.format == "pdf" {
                        local_temp_jpegs.push((left_path.clone(), left_rgb.width(), left_rgb.height()));
                        local_temp_jpegs.push((right_path.clone(), right_rgb.width(), right_rgb.height()));
                    }
                }

                local_output_files.push(left_path.to_string_lossy().to_string());
                local_output_files.push(right_path.to_string_lossy().to_string());
            } else {
                // Full Spread
                let ext = if options.format == "png" { "png" } else { "jpg" };
                let filename = if spread.r#type == "cover" {
                    format!("Spread_00_Cover.{}", ext)
                } else {
                    format!("Spread_{:02}.{}", spread.spread_index, ext)
                };

                let file_dest = output_path.join(&filename);

                if options.format == "png" {
                    spread_img.save_with_format(&file_dest, image::ImageFormat::Png)
                        .map_err(|e| format!("Failed to save {}: {}", file_dest.display(), e))?;
                } else {
                    let spread_rgb = image::DynamicImage::ImageRgba8(spread_img).to_rgb8();
                    let mut f = fs::File::create(&file_dest).map_err(|e| e.to_string())?;
                    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut f, options.jpeg_quality);
                    encoder.encode_image(&spread_rgb).map_err(|e| e.to_string())?;

                    if options.format == "pdf" {
                        local_temp_jpegs.push((file_dest.clone(), spread_rgb.width(), spread_rgb.height()));
                    }
                }

                local_output_files.push(file_dest.to_string_lossy().to_string());
            }

            let mut lock = results.lock().unwrap();
            lock.push((idx, local_output_files, local_temp_jpegs));

            Ok(())
        })?;

    // Sort results by original spread index to guarantee exact sequential order
    let mut lock = results.lock().unwrap();
    lock.sort_by_key(|(idx, _, _)| *idx);

    let mut output_files = Vec::new();
    let mut temp_jpegs_for_pdf = Vec::new();

    for (_, files, jpegs) in lock.drain(..) {
        output_files.extend(files);
        temp_jpegs_for_pdf.extend(jpegs);
    }

    // If PDF format requested, assemble the rendered JPEGs into a single multi-page PDF document
    if options.format == "pdf" && !temp_jpegs_for_pdf.is_empty() {
        let _ = app.emit(
            "export-progress",
            &ExportProgressEvent {
                current: total_spreads,
                total: total_spreads,
                current_photos: total_photos,
                total_photos,
                percent: 96.0,
                spread_name: "PDF Packaging".to_string(),
                status: "Assembling multi-page print-ready PDF document...".to_string(),
                is_finished: false,
                output_files: output_files.clone(),
            },
        );

        let safe_name = project.name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|', ' '], "_");
        let pdf_filename = format!("{}_Print_Ready.pdf", safe_name);
        let pdf_dest = output_path.join(&pdf_filename);

        assemble_pdf_from_jpegs(&temp_jpegs_for_pdf, &pdf_dest, options.dpi)
            .map_err(|e| format!("Failed to assemble PDF: {}", e))?;

        output_files.insert(0, pdf_dest.to_string_lossy().to_string());
    }

    let final_event = ExportProgressEvent {
        current: total_spreads,
        total: total_spreads,
        current_photos: total_photos,
        total_photos,
        percent: 100.0,
        spread_name: "Complete".to_string(),
        status: format!("Successfully exported {} file(s) to {}", output_files.len(), output_path.display()),
        is_finished: true,
        output_files: output_files.clone(),
    };

    let _ = app.emit("export-progress", &final_event);

    Ok(final_event)
}

#[tauri::command]
pub async fn export_album_high_res(
    app: AppHandle,
    db: State<'_, Database>,
    project_id: String,
    options: ExportOptions,
) -> Result<ExportProgressEvent, String> {
    log::info!(
        "export_album_high_res: project_id={}, format={}, dpi={}, out_dir={}",
        project_id,
        options.format,
        options.dpi,
        options.output_dir
    );

    let project = db
        .get_project(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let album = db
        .load_album_structure(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No album structure found for project".to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        export_album_high_res_worker(app, project, album, options)
    })
    .await
    .map_err(|e| format!("Export worker execution failed: {}", e))?
}
