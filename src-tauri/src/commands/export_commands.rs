use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use rayon::prelude::*;
use tauri::{AppHandle, Emitter, State};
use crate::db::{AlbumPayload, Database, ProjectRow, SpreadPayload};
use crate::export_engine::{
    assemble_pdf_from_jpegs, render_spread_to_image_with_progress, split_spread_into_pages,
    ExportOptions, ExportProgressEvent,
};

#[derive(Default)]
pub struct ExportState {
    pub cancel_requested: Arc<AtomicBool>,
}

#[tauri::command]
pub fn cancel_export(state: State<'_, ExportState>) -> Result<(), String> {
    log::info!("cancel_export requested by user");
    state.cancel_requested.store(true, Ordering::SeqCst);
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightReport {
    pub total_photos: usize,
    pub missing_photos: Vec<MissingPhotoInfo>,
    pub existing_files: Vec<String>,
    pub destination_writable: bool,
    pub destination_error: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingPhotoInfo {
    pub element_id: String,
    pub spread_name: String,
    pub file_path: String,
    pub file_name: String,
    pub has_preview: bool,
}

#[tauri::command]
pub async fn preflight_check_export(
    db: State<'_, Database>,
    project_id: String,
    options: ExportOptions,
) -> Result<PreflightReport, String> {
    let album = db
        .load_album_structure(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No album structure found for project".to_string())?;

    let mut candidate_spreads = Vec::new();
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

    let mut total_photos = 0;
    let mut missing_photos = Vec::new();

    for spread in &spreads {
        let spread_name = if spread.r#type == "cover" {
            "Cover Spread".to_string()
        } else {
            format!("Spread {:02}", spread.spread_index)
        };

        for elem in &spread.elements {
            if elem.file_path.is_empty() {
                continue;
            }
            total_photos += 1;
            let path = std::path::Path::new(&elem.file_path);
            if !path.exists() {
                let file_name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| elem.file_path.clone());

                let has_preview = elem.preview_path.as_ref().map(|p| std::path::Path::new(p).exists()).unwrap_or(false);

                missing_photos.push(MissingPhotoInfo {
                    element_id: elem.id.clone(),
                    spread_name: spread_name.clone(),
                    file_path: elem.file_path.clone(),
                    file_name,
                    has_preview,
                });
            }
        }
    }

    // Check if destination directory is writable
    let out_dir = PathBuf::from(&options.output_dir);
    let mut destination_writable = true;
    let mut destination_error = None;

    if !out_dir.exists() {
        if let Err(e) = fs::create_dir_all(&out_dir) {
            destination_writable = false;
            destination_error = Some(format!("Cannot create output folder: {}", e));
        }
    }

    if destination_writable {
        let probe_file = out_dir.join(".afsn_write_test.tmp");
        match fs::File::create(&probe_file) {
            Ok(_) => {
                let _ = fs::remove_file(&probe_file);
            }
            Err(e) => {
                destination_writable = false;
                destination_error = Some(format!("Destination folder is not writable: {}", e));
            }
        }
    }

    // Check if any output files already exist in destination directory
    let mut existing_files = Vec::new();
    let ext = if options.format == "png" { "png" } else { "jpg" };

    if options.format == "pdf" {
        let project = db.get_project(&project_id).ok().flatten();
        let project_name = project.map(|p| p.name).unwrap_or_else(|| "Album".to_string());
        let safe_name = project_name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|', ' '], "_");
        let pdf_filename = format!("{}_Print_Ready.pdf", safe_name);
        if out_dir.join(&pdf_filename).exists() {
            existing_files.push(pdf_filename);
        }
    } else if options.split_pages {
        for spread in &spreads {
            if spread.r#type == "cover" {
                let filename = format!("Spread_00_Cover.{}", ext);
                if out_dir.join(&filename).exists() {
                    existing_files.push(filename);
                }
            } else {
                let left_num = (spread.spread_index - 1) * 2 + 1;
                let right_num = left_num + 1;
                let left_filename = format!("Page_{:03}.{}", left_num, ext);
                let right_filename = format!("Page_{:03}.{}", right_num, ext);
                if out_dir.join(&left_filename).exists() {
                    existing_files.push(left_filename);
                }
                if out_dir.join(&right_filename).exists() {
                    existing_files.push(right_filename);
                }
            }
        }
    } else {
        for spread in &spreads {
            let filename = if spread.r#type == "cover" {
                format!("Spread_00_Cover.{}", ext)
            } else {
                format!("Spread_{:02}.{}", spread.spread_index, ext)
            };
            if out_dir.join(&filename).exists() {
                existing_files.push(filename);
            }
        }
    }

    Ok(PreflightReport {
        total_photos,
        missing_photos,
        existing_files,
        destination_writable,
        destination_error,
    })
}

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

fn safe_write_image<F>(dest: &PathBuf, write_fn: F) -> Result<(), String>
where
    F: FnOnce(&PathBuf) -> Result<(), String>,
{
    let tmp_dest = dest.with_extension("tmp_export");
    write_fn(&tmp_dest)?;
    if dest.exists() {
        let _ = fs::remove_file(dest);
    }
    fs::rename(&tmp_dest, dest).map_err(|e| format!("Failed to finalize {}: {}", dest.display(), e))?;
    Ok(())
}

fn export_album_high_res_worker(
    app: AppHandle,
    project: ProjectRow,
    album: AlbumPayload,
    options: ExportOptions,
    cancel_flag: Arc<AtomicBool>,
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

    // Count total photos across all selected spreads for exact monotonic percentage
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
            status: if total_photos > 0 {
                format!("Preparing export (0 of {} photos)...", total_photos)
            } else {
                "Preparing export...".to_string()
            },
            is_finished: false,
            output_files: Vec::new(),
        },
    );

    // Advanced Memory Guard: Detect available hardware CPU cores and bound concurrent batch chunks
    let num_cpus = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
    let chunk_size = num_cpus.clamp(2, 8); // Max 2-8 concurrent spread buffers in RAM

    // Container for results (preserves global sequential index for proper page naming/PDF assembly)
    let results: Arc<Mutex<Vec<(usize, Vec<String>, Vec<(PathBuf, u32, u32)>)>>> =
        Arc::new(Mutex::new(Vec::new()));

    // Process in bounded chunks to protect peak RAM while keeping 100% CPU core utilization
    for (chunk_idx, spread_chunk) in spreads.chunks(chunk_size).enumerate() {
        if cancel_flag.load(Ordering::SeqCst) {
            log::info!("Export worker cancelled before chunk {}", chunk_idx);
            let cancel_event = ExportProgressEvent {
                current: 0,
                total: total_spreads,
                current_photos: 0,
                total_photos,
                percent: 0.0,
                spread_name: "Cancelled".to_string(),
                status: "Export cancelled by user.".to_string(),
                is_finished: true,
                output_files: Vec::new(),
            };
            let _ = app.emit("export-progress", &cancel_event);
            return Err("Export cancelled by user".to_string());
        }

        let chunk_offset = chunk_idx * chunk_size;

        let chunk_res = spread_chunk
            .par_iter()
            .enumerate()
            .try_for_each(|(local_idx, spread)| -> Result<(), String> {
                if cancel_flag.load(Ordering::SeqCst) {
                    return Err("Export cancelled by user".to_string());
                }

                let global_idx = chunk_offset + local_idx;
                let current_num = global_idx + 1;
                let spread_name = if spread.r#type == "cover" {
                    "Cover Spread".to_string()
                } else {
                    format!("Spread {:02}", spread.spread_index)
                };

                let completed_photos_clone = completed_photos.clone();
                let app_handle = app.clone();
                let cancel_flag_clone = cancel_flag.clone();

                // Render spread to high resolution bitmap with live photo-by-photo atomic progress
                let spread_img = render_spread_to_image_with_progress(
                    &project,
                    spread,
                    options.dpi,
                    options.include_bleed,
                    |_photo_idx, _total_photos_in_spread| {
                        if cancel_flag_clone.load(Ordering::SeqCst) {
                            return false;
                        }
                        let done = completed_photos_clone.fetch_add(1, Ordering::SeqCst) + 1;
                        let pct = if total_photos > 0 {
                            ((done as f64 / total_photos as f64) * 92.0).clamp(1.0, 95.0)
                        } else {
                            ((current_num as f64 / total_spreads as f64) * 92.0).clamp(1.0, 95.0)
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
                                status: format!("Processing photo {} of {}...", done, total_photos),
                                is_finished: false,
                                output_files: Vec::new(),
                            },
                        );

                        true
                    },
                );

                if cancel_flag.load(Ordering::SeqCst) {
                    return Err("Export cancelled by user".to_string());
                }

                let mut local_output_files = Vec::new();
                let mut local_temp_jpegs = Vec::new();

                // Handle Split Pages vs Full Spread with Atomic Safe Overwrite
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
                        safe_write_image(&left_path, |tmp| {
                            left_page.save_with_format(tmp, image::ImageFormat::Png)
                                .map_err(|e| format!("Failed to save {}: {}", left_path.display(), e))
                        })?;
                        safe_write_image(&right_path, |tmp| {
                            right_page.save_with_format(tmp, image::ImageFormat::Png)
                                .map_err(|e| format!("Failed to save {}: {}", right_path.display(), e))
                        })?;
                    } else {
                        // JPEG with atomic safe write
                        let left_rgb = image::DynamicImage::ImageRgba8(left_page).to_rgb8();
                        safe_write_image(&left_path, |tmp| {
                            let mut left_f = fs::File::create(tmp).map_err(|e| e.to_string())?;
                            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut left_f, options.jpeg_quality);
                            encoder.encode_image(&left_rgb).map_err(|e| e.to_string())
                        })?;

                        let right_rgb = image::DynamicImage::ImageRgba8(right_page).to_rgb8();
                        safe_write_image(&right_path, |tmp| {
                            let mut right_f = fs::File::create(tmp).map_err(|e| e.to_string())?;
                            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut right_f, options.jpeg_quality);
                            encoder.encode_image(&right_rgb).map_err(|e| e.to_string())
                        })?;

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
                        safe_write_image(&file_dest, |tmp| {
                            spread_img.save_with_format(tmp, image::ImageFormat::Png)
                                .map_err(|e| format!("Failed to save {}: {}", file_dest.display(), e))
                        })?;
                    } else {
                        let spread_rgb = image::DynamicImage::ImageRgba8(spread_img).to_rgb8();
                        safe_write_image(&file_dest, |tmp| {
                            let mut f = fs::File::create(tmp).map_err(|e| e.to_string())?;
                            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut f, options.jpeg_quality);
                            encoder.encode_image(&spread_rgb).map_err(|e| e.to_string())
                        })?;

                        if options.format == "pdf" {
                            local_temp_jpegs.push((file_dest.clone(), spread_rgb.width(), spread_rgb.height()));
                        }
                    }

                    local_output_files.push(file_dest.to_string_lossy().to_string());
                }

                let mut lock = results.lock().unwrap();
                lock.push((global_idx, local_output_files, local_temp_jpegs));

                Ok(())
            });

        if let Err(e) = chunk_res {
            if cancel_flag.load(Ordering::SeqCst) || e.contains("cancelled") {
                let cancel_event = ExportProgressEvent {
                    current: 0,
                    total: total_spreads,
                    current_photos: 0,
                    total_photos,
                    percent: 0.0,
                    spread_name: "Cancelled".to_string(),
                    status: "Export was cancelled.".to_string(),
                    is_finished: true,
                    output_files: Vec::new(),
                };
                let _ = app.emit("export-progress", &cancel_event);
                return Err("Export cancelled by user".to_string());
            }
            return Err(e);
        }
    }

    if cancel_flag.load(Ordering::SeqCst) {
        log::info!("Export worker detected cancel_flag before finalization");
        let cancel_event = ExportProgressEvent {
            current: 0,
            total: total_spreads,
            current_photos: 0,
            total_photos,
            percent: 0.0,
            spread_name: "Cancelled".to_string(),
            status: "Export cancelled by user.".to_string(),
            is_finished: true,
            output_files: Vec::new(),
        };
        let _ = app.emit("export-progress", &cancel_event);
        return Err("Export cancelled by user".to_string());
    }

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
        if cancel_flag.load(Ordering::SeqCst) {
            return Err("Export cancelled by user".to_string());
        }

        let _ = app.emit(
            "export-progress",
            &ExportProgressEvent {
                current: total_spreads,
                total: total_spreads,
                current_photos: total_photos,
                total_photos,
                percent: 96.0,
                spread_name: "PDF Packaging".to_string(),
                status: "Generating print-ready PDF document...".to_string(),
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
        status: format!("Export complete! {} file(s) saved.", output_files.len()),
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
    export_state: State<'_, ExportState>,
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

    // Reset cancel flag before starting
    export_state.cancel_requested.store(false, Ordering::SeqCst);
    let cancel_flag = export_state.cancel_requested.clone();

    tauri::async_runtime::spawn_blocking(move || {
        export_album_high_res_worker(app, project, album, options, cancel_flag)
    })
    .await
    .map_err(|e| format!("Export worker execution failed: {}", e))?
}
