use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, State};
use crate::db::Database;
use crate::export_engine::{
    assemble_pdf_from_jpegs, render_spread_to_image, split_spread_into_pages, ExportOptions,
    ExportProgressEvent,
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

    let output_path = PathBuf::from(&options.output_dir);
    if !output_path.exists() {
        fs::create_dir_all(&output_path).map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let project = db
        .get_project(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Project '{}' not found", project_id))?;

    let album = db
        .load_album_structure(&project_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No album structure found for project".to_string())?;

    // Gather all spreads to export
    let mut spreads = Vec::new();
    // Include cover spread if present
    spreads.push(album.cover_spread);
    // Include interior spreads
    spreads.extend(album.spreads);

    // Filter if specific spreads were selected
    if let Some(ref selected_ids) = options.selected_spread_ids {
        if !selected_ids.is_empty() {
            spreads.retain(|s| selected_ids.contains(&s.id));
        }
    }

    let total_spreads = spreads.len();
    if total_spreads == 0 {
        return Err("No spreads found to export".to_string());
    }

    let mut output_files = Vec::new();
    let mut temp_jpegs_for_pdf = Vec::new();

    for (idx, spread) in spreads.iter().enumerate() {
        let current_num = idx + 1;
        let spread_name = if spread.r#type == "cover" {
            "Cover Spread".to_string()
        } else {
            format!("Spread {:02}", spread.spread_index)
        };

        // Emit progress before rendering
        let _ = app.emit(
            "export-progress",
            &ExportProgressEvent {
                current: current_num,
                total: total_spreads,
                spread_name: spread_name.clone(),
                status: format!("Rendering {} ({} of {})...", spread_name, current_num, total_spreads),
                is_finished: false,
                output_files: output_files.clone(),
            },
        );

        // Render spread to high resolution bitmap
        let spread_img = render_spread_to_image(&project, spread, options.dpi, options.include_bleed);

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
                    temp_jpegs_for_pdf.push((left_path.clone(), left_rgb.width(), left_rgb.height()));
                    temp_jpegs_for_pdf.push((right_path.clone(), right_rgb.width(), right_rgb.height()));
                }
            }

            output_files.push(left_path.to_string_lossy().to_string());
            output_files.push(right_path.to_string_lossy().to_string());
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
                    temp_jpegs_for_pdf.push((file_dest.clone(), spread_rgb.width(), spread_rgb.height()));
                }
            }

            output_files.push(file_dest.to_string_lossy().to_string());
        }
    }

    // If PDF format requested, assemble the rendered JPEGs into a single multi-page PDF document
    if options.format == "pdf" && !temp_jpegs_for_pdf.is_empty() {
        let pdf_filename = format!("{}_Print_Ready.pdf", project.name.replace(' ', "_"));
        let pdf_dest = output_path.join(&pdf_filename);

        assemble_pdf_from_jpegs(&temp_jpegs_for_pdf, &pdf_dest, options.dpi)
            .map_err(|e| format!("Failed to assemble PDF: {}", e))?;

        output_files.insert(0, pdf_dest.to_string_lossy().to_string());
    }

    let final_event = ExportProgressEvent {
        current: total_spreads,
        total: total_spreads,
        spread_name: "Complete".to_string(),
        status: format!("Successfully exported {} files to {}", output_files.len(), output_path.display()),
        is_finished: true,
        output_files: output_files.clone(),
    };

    let _ = app.emit("export-progress", &final_event);

    Ok(final_event)
}
