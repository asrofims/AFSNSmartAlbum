use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use image::{GenericImageView, ImageBuffer, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
use crate::db::{ElementPayload, ProjectRow, SpreadPayload};

pub mod text_rasterizer;
pub use text_rasterizer::render_text_element;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub format: String, // "jpeg", "png", "pdf"
    pub dpi: u32,       // e.g. 300
    #[serde(default = "default_jpeg_quality")]
    pub jpeg_quality: u8, // 1 - 100 (default 95)
    #[serde(default)]
    pub include_bleed: bool,
    #[serde(default)]
    pub split_pages: bool, // split spread into Left & Right page images
    #[serde(default)]
    pub sharpen_enabled: bool,
    #[serde(default = "default_sharpen_amount")]
    pub sharpen_amount: String, // "standard", "high"
    pub output_dir: String,
    pub selected_spread_ids: Option<Vec<String>>,
    #[serde(default)]
    pub file_prefix: Option<String>,
}

fn default_jpeg_quality() -> u8 {
    95
}

fn default_sharpen_amount() -> String {
    "standard".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgressEvent {
    pub current: usize,
    pub total: usize,
    #[serde(default)]
    pub current_photos: usize,
    #[serde(default)]
    pub total_photos: usize,
    #[serde(default)]
    pub percent: f64,
    pub spread_name: String,
    pub status: String,
    pub is_finished: bool,
    pub output_files: Vec<String>,
}

/// Calculate the scale factor to convert project units to export pixels.
/// - If project unit is 'px', scales by (export_dpi / project_base_dpi).
/// - If project unit is physical ('mm', 'cm', 'inch'), converts physical unit to pixels at export_dpi.
pub fn calculate_export_scale(unit: &str, project_base_dpi: i32, export_dpi: u32) -> f64 {
    let export_dpi_f = export_dpi as f64;
    match unit.to_lowercase().as_str() {
        "mm" => export_dpi_f / 25.4,
        "cm" => export_dpi_f / 2.54,
        "inch" | "in" => export_dpi_f,
        "px" => {
            let base = if project_base_dpi > 0 { project_base_dpi as f64 } else { 300.0 };
            export_dpi_f / base
        }
        _ => export_dpi_f / 25.4, // default mm
    }
}

/// Convert physical dimension (in mm, cm, inch, or px) to pixels at given DPI (assumes 300 base DPI for px)
#[allow(dead_code)]
pub fn unit_to_pixels(val: f64, unit: &str, dpi: u32) -> f64 {
    let scale = calculate_export_scale(unit, 300, dpi);
    val * scale
}

/// Convert dimension value to pixels using explicit project base DPI and export DPI
#[allow(dead_code)]
pub fn unit_to_pixels_with_base_dpi(val: f64, unit: &str, project_base_dpi: i32, export_dpi: u32) -> f64 {
    let scale = calculate_export_scale(unit, project_base_dpi, export_dpi);
    val * scale
}

/// Standard IEEE 802.3 CRC32 calculation for PNG chunks
fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            if (crc & 1) != 0 {
                crc = (crc >> 1) ^ 0xEDB8_8320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}

/// Creates a standard JFIF APP0 header segment with the specified DPI
pub fn create_jfif_app0_header(dpi: u16) -> [u8; 18] {
    let dpi_bytes = dpi.to_be_bytes();
    [
        0xFF, 0xE0, // APP0 marker
        0x00, 0x10, // Length of segment (16 bytes)
        0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
        0x01, 0x02, // Version 1.02
        0x01,       // Units: 1 = dots per inch (DPI)
        dpi_bytes[0], dpi_bytes[1], // Xdensity
        dpi_bytes[0], dpi_bytes[1], // Ydensity
        0x00,       // Xthumbnail (0)
        0x00,       // Ythumbnail (0)
    ]
}

/// Encodes an RGB image into JPEG bytes with embedded JFIF DPI density metadata
pub fn encode_jpeg_with_dpi(rgb_img: &image::RgbImage, quality: u8, dpi: u32) -> Result<Vec<u8>, String> {
    let mut raw_bytes = Vec::new();
    {
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut raw_bytes, quality);
        encoder.encode_image(rgb_img).map_err(|e| e.to_string())?;
    }

    let jfif_header = create_jfif_app0_header(dpi.clamp(1, 65535) as u16);

    if raw_bytes.len() >= 4 && raw_bytes[0] == 0xFF && raw_bytes[1] == 0xD8 {
        if raw_bytes[2] == 0xFF && raw_bytes[3] == 0xE0 && raw_bytes.len() >= 20 {
            // Replace existing APP0 with our explicit JFIF DPI header
            let mut final_bytes = Vec::with_capacity(raw_bytes.len() + 18);
            final_bytes.extend_from_slice(&raw_bytes[0..2]); // SOI
            final_bytes.extend_from_slice(&jfif_header);     // APP0 JFIF
            let original_app0_len = ((raw_bytes[4] as usize) << 8) | (raw_bytes[5] as usize);
            let skip_offset = 4 + original_app0_len;
            if skip_offset <= raw_bytes.len() {
                final_bytes.extend_from_slice(&raw_bytes[skip_offset..]);
            } else {
                final_bytes.extend_from_slice(&raw_bytes[20..]);
            }
            Ok(final_bytes)
        } else {
            // Insert APP0 JFIF right after SOI
            let mut final_bytes = Vec::with_capacity(raw_bytes.len() + 18);
            final_bytes.extend_from_slice(&raw_bytes[0..2]); // SOI
            final_bytes.extend_from_slice(&jfif_header);     // APP0 JFIF
            final_bytes.extend_from_slice(&raw_bytes[2..]);  // Rest of JPEG stream
            Ok(final_bytes)
        }
    } else {
        Ok(raw_bytes)
    }
}

/// Creates a standard PNG pHYs (physical pixel dimensions) chunk with the specified DPI
pub fn create_png_phys_chunk(dpi: u32) -> Vec<u8> {
    // 1 meter = 39.37007874 inches
    let ppm = (dpi as f64 * 39.37007874).round() as u32;
    let mut chunk_data = Vec::with_capacity(13);
    chunk_data.extend_from_slice(b"pHYs");
    chunk_data.extend_from_slice(&ppm.to_be_bytes()); // X pixels per meter
    chunk_data.extend_from_slice(&ppm.to_be_bytes()); // Y pixels per meter
    chunk_data.push(1); // 1 = meter

    let crc = crc32(&chunk_data);

    let mut result = Vec::with_capacity(21);
    result.extend_from_slice(&9u32.to_be_bytes()); // Length of chunk data (9 bytes)
    result.extend_from_slice(&chunk_data);         // Type + Data (13 bytes)
    result.extend_from_slice(&crc.to_be_bytes());  // CRC (4 bytes)
    result
}

/// Encodes an RGBA image into PNG bytes with embedded pHYs DPI density metadata
pub fn encode_png_with_dpi(rgba_img: &RgbaImage, dpi: u32) -> Result<Vec<u8>, String> {
    let mut raw_bytes = Vec::new();
    rgba_img.write_to(&mut std::io::Cursor::new(&mut raw_bytes), image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    let phys_chunk = create_png_phys_chunk(dpi);

    // PNG signature (8 bytes) + IHDR (25 bytes) = 33 bytes
    if raw_bytes.len() >= 33 && &raw_bytes[0..8] == b"\x89PNG\r\n\x1a\n" {
        let mut final_bytes = Vec::with_capacity(raw_bytes.len() + phys_chunk.len());
        final_bytes.extend_from_slice(&raw_bytes[0..33]);
        final_bytes.extend_from_slice(&phys_chunk);
        final_bytes.extend_from_slice(&raw_bytes[33..]);
        Ok(final_bytes)
    } else {
        Ok(raw_bytes)
    }
}

/// Parses hex color string like "#FFFFFF" or "rgba(255,255,255,1)" into Rgba<u8>
pub fn parse_hex_color(hex: &str) -> Rgba<u8> {
    let cleaned = hex.trim().trim_start_matches('#');
    if cleaned.len() == 6 {
        if let (Ok(r), Ok(g), Ok(b)) = (
            u8::from_str_radix(&cleaned[0..2], 16),
            u8::from_str_radix(&cleaned[2..4], 16),
            u8::from_str_radix(&cleaned[4..6], 16),
        ) {
            return Rgba([r, g, b, 255]);
        }
    } else if cleaned.len() == 8 {
        if let (Ok(r), Ok(g), Ok(b), Ok(a)) = (
            u8::from_str_radix(&cleaned[0..2], 16),
            u8::from_str_radix(&cleaned[2..4], 16),
            u8::from_str_radix(&cleaned[4..6], 16),
            u8::from_str_radix(&cleaned[6..8], 16),
        ) {
            return Rgba([r, g, b, a]);
        }
    }
    Rgba([255, 255, 255, 255]) // Default white
}

/// Renders a single photo element onto the canvas at high resolution with maximum speed and memory efficiency
fn render_photo_element(
    canvas: &mut RgbaImage,
    elem: &ElementPayload,
    offset_x_px: f64,
    offset_y_px: f64,
    scale_factor: f64,
    include_bleed: bool,
    total_spread_w: f64,
    total_spread_h: f64,
) {
    if elem.file_path.is_empty() {
        return;
    }

    let mut frame_px_x = (elem.x * scale_factor + offset_x_px).round() as i64;
    let mut frame_px_y = (elem.y * scale_factor + offset_y_px).round() as i64;
    let mut frame_px_w = (elem.width * scale_factor).round() as u32;
    let mut frame_px_h = (elem.height * scale_factor).round() as u32;

    let canvas_w = canvas.width() as i64;
    let canvas_h = canvas.height() as i64;

    // If include_bleed is active and this photo is aligned with spread boundaries (trim line),
    // automatically extend the photo all the way into the bleed margin so it prints seamlessly
    // without unwanted blank white borders around full-bleed photos.
    if include_bleed && (offset_x_px > 0.0 || offset_y_px > 0.0) {
        let tolerance = 2.0; // 2 physical pixels tolerance for edge snapping

        let touches_left = (elem.x * scale_factor) <= tolerance;
        let touches_top = (elem.y * scale_factor) <= tolerance;
        let touches_right = ((elem.x + elem.width) * scale_factor) >= (total_spread_w * scale_factor - tolerance);
        let touches_bottom = ((elem.y + elem.height) * scale_factor) >= (total_spread_h * scale_factor - tolerance);

        if touches_left {
            let extend_left = frame_px_x.max(0);
            frame_px_x = 0;
            frame_px_w += extend_left as u32;
        }

        if touches_top {
            let extend_top = frame_px_y.max(0);
            frame_px_y = 0;
            frame_px_h += extend_top as u32;
        }

        if touches_right {
            let right_edge = frame_px_x + frame_px_w as i64;
            if right_edge < canvas_w {
                frame_px_w += (canvas_w - right_edge) as u32;
            }
        }

        if touches_bottom {
            let bottom_edge = frame_px_y + frame_px_h as i64;
            if bottom_edge < canvas_h {
                frame_px_h += (canvas_h - bottom_edge) as u32;
            }
        }
    }

    if frame_px_w == 0 || frame_px_h == 0 {
        return;
    }

    // Quick boundary check: if frame is completely off canvas, skip
    if frame_px_x + frame_px_w as i64 <= 0
        || frame_px_x >= canvas_w
        || frame_px_y + frame_px_h as i64 <= 0
        || frame_px_y >= canvas_h
    {
        return;
    }

    // Try loading original file, fallback to preview or thumbnail
    let img_path = Path::new(&elem.file_path);
    let mut dynamic_img = match image::open(img_path) {
        Ok(img) => img,
        Err(e) => {
            log::warn!("Could not open original image at {:?}: {}", img_path, e);
            if let Some(ref prev) = elem.preview_path {
                match image::open(Path::new(prev)) {
                    Ok(img) => img,
                    Err(_) => return,
                }
            } else {
                return;
            }
        }
    };

    // Apply frame rotation if 90, 180, 270 degrees
    let rotation = ((elem.rotation % 360.0 + 360.0) % 360.0).round() as i64;
    dynamic_img = match rotation {
        90 => dynamic_img.rotate90(),
        180 => dynamic_img.rotate180(),
        270 => dynamic_img.rotate270(),
        _ => dynamic_img,
    };

    let (img_w, img_h) = dynamic_img.dimensions();
    if img_w == 0 || img_h == 0 {
        return;
    }

    let photo_aspect = img_w as f64 / img_h as f64;
    let frame_aspect = if frame_px_h > 0 {
        frame_px_w as f64 / frame_px_h as f64
    } else if elem.height > 0.0 {
        elem.width / elem.height
    } else {
        1.0
    };
    let crop_scale = elem.crop_scale.max(1.0);

    // Calculate visible crop rectangle in original image pixel coordinates
    let (visible_w, visible_h) = if photo_aspect > frame_aspect {
        let vh = img_h as f64 / crop_scale;
        let vw = (vh * frame_aspect).min(img_w as f64);
        (vw, vh)
    } else {
        let vw = img_w as f64 / crop_scale;
        let vh = (vw / frame_aspect.max(0.001)).min(img_h as f64);
        (vw, vh)
    };

    let excess_x = (img_w as f64 - visible_w).max(0.0);
    let excess_y = (img_h as f64 - visible_h).max(0.0);

    let norm_x = elem.crop_x.clamp(-1.0, 1.0);
    let norm_y = elem.crop_y.clamp(-1.0, 1.0);

    // Center offset + pan offset
    let src_x = ((excess_x / 2.0) + (norm_x * (excess_x / 2.0))).clamp(0.0, (img_w as f64 - visible_w).max(0.0));
    let src_y = ((excess_y / 2.0) + (norm_y * (excess_y / 2.0))).clamp(0.0, (img_h as f64 - visible_h).max(0.0));

    let crop_x_px = src_x.round() as u32;
    let crop_y_px = src_y.round() as u32;
    let crop_w_px = (visible_w.round() as u32).min(img_w.saturating_sub(crop_x_px)).max(1);
    let crop_h_px = (visible_h.round() as u32).min(img_h.saturating_sub(crop_y_px)).max(1);

    // 1. Pre-crop the original image (virtually instant sub-view)
    let cropped_sub = image::imageops::crop_imm(&dynamic_img, crop_x_px, crop_y_px, crop_w_px, crop_h_px);

    // 2. High speed, high quality Triangle/Bilinear resampling directly to frame dimensions
    let resized_img = cropped_sub.to_image();
    let resized_dynamic = image::DynamicImage::ImageRgba8(resized_img);
    let final_frame_img = resized_dynamic.resize_exact(frame_px_w, frame_px_h, image::imageops::FilterType::Triangle);
    let resized_rgba = final_frame_img.to_rgba8();

    // 3. Blit into canvas
    let render_w = resized_rgba.width();
    let render_h = resized_rgba.height();

    for fy in 0..render_h {
        let dest_y = frame_px_y + fy as i64;
        if dest_y < 0 || dest_y >= canvas_h {
            continue;
        }

        for fx in 0..render_w {
            let dest_x = frame_px_x + fx as i64;
            if dest_x < 0 || dest_x >= canvas_w {
                continue;
            }

            let p = resized_rgba.get_pixel(fx, fy);
            let effective_alpha = (p[3] as f64 / 255.0 * elem.opacity).clamp(0.0, 1.0);
            if effective_alpha < 0.001 {
                // Completely transparent pixel, leave canvas background intact
                continue;
            }
            if effective_alpha > 0.999 {
                canvas.put_pixel(dest_x as u32, dest_y as u32, *p);
            } else {
                let existing = canvas.get_pixel_mut(dest_x as u32, dest_y as u32);
                let inv_alpha = 1.0 - effective_alpha;
                existing[0] = ((p[0] as f64 * effective_alpha) + (existing[0] as f64 * inv_alpha)).round() as u8;
                existing[1] = ((p[1] as f64 * effective_alpha) + (existing[1] as f64 * inv_alpha)).round() as u8;
                existing[2] = ((p[2] as f64 * effective_alpha) + (existing[2] as f64 * inv_alpha)).round() as u8;
                existing[3] = 255;
            }
        }
    }

    // 4. Render frame border if enabled
    if elem.border_enabled && elem.border_width > 0.0 {
        let border_px = (elem.border_width * scale_factor).round().max(1.0) as i64;
        let border_color = parse_hex_color(&elem.border_color);

        for b in 0..border_px {
            for fx in 0..frame_px_w as i64 {
                let dx = frame_px_x + fx;
                if dx >= 0 && dx < canvas_w {
                    let dy_top = frame_px_y + b;
                    let dy_bot = frame_px_y + frame_px_h as i64 - 1 - b;
                    if dy_top >= 0 && dy_top < canvas_h {
                        canvas.put_pixel(dx as u32, dy_top as u32, border_color);
                    }
                    if dy_bot >= 0 && dy_bot < canvas_h {
                        canvas.put_pixel(dx as u32, dy_bot as u32, border_color);
                    }
                }
            }
            for fy in 0..frame_px_h as i64 {
                let dy = frame_px_y + fy;
                if dy >= 0 && dy < canvas_h {
                    let dx_left = frame_px_x + b;
                    let dx_right = frame_px_x + frame_px_w as i64 - 1 - b;
                    if dx_left >= 0 && dx_left < canvas_w {
                        canvas.put_pixel(dx_left as u32, dy as u32, border_color);
                    }
                    if dx_right >= 0 && dx_right < canvas_w {
                        canvas.put_pixel(dx_right as u32, dy as u32, border_color);
                    }
                }
            }
        }
    }
}

/// Renders an entire spread to high-res RgbaImage with sub-step progress callback
pub fn render_spread_to_image_with_progress<F>(
    project: &ProjectRow,
    spread: &SpreadPayload,
    dpi: u32,
    include_bleed: bool,
    mut on_photo_progress: F,
) -> RgbaImage
where
    F: FnMut(usize, usize) -> bool,
{
    let scale = calculate_export_scale(&project.canvas_unit, project.canvas_dpi, dpi);
    let single_page_w = project.canvas_width;
    let single_page_h = project.canvas_height;
    let gutter_w = spread.gutter_width;
    let bleed = spread.bleed;

    let total_spread_w = single_page_w * 2.0 + gutter_w;
    let total_spread_h = single_page_h;

    let (canvas_w_px, canvas_h_px, offset_x_px, offset_y_px) = if include_bleed {
        let w = ((total_spread_w + bleed * 2.0) * scale).round() as u32;
        let h = ((total_spread_h + bleed * 2.0) * scale).round() as u32;
        let ox = (bleed * scale).round();
        let oy = (bleed * scale).round();
        (w, h, ox, oy)
    } else {
        let w = (total_spread_w * scale).round() as u32;
        let h = (total_spread_h * scale).round() as u32;
        (w, h, 0.0, 0.0)
    };

    let bg_color = parse_hex_color(&spread.background_color);
    let mut canvas: RgbaImage = ImageBuffer::from_pixel(canvas_w_px, canvas_h_px, bg_color);

    // Fill Left Page and Right Page distinct backgrounds if configured
    let left_bg = spread.left_page.as_ref().map(|p| parse_hex_color(&p.background_color)).unwrap_or(bg_color);
    let right_bg = spread.right_page.as_ref().map(|p| parse_hex_color(&p.background_color)).unwrap_or(bg_color);

    let left_page_w_px = ((single_page_w + if include_bleed { bleed } else { 0.0 }) * scale).round() as u32;
    let right_page_start_x = if include_bleed {
        ((single_page_w + bleed + gutter_w) * scale).round() as u32
    } else {
        ((single_page_w + gutter_w) * scale).round() as u32
    };

    if left_bg != bg_color {
        for y in 0..canvas_h_px {
            for x in 0..left_page_w_px.min(canvas_w_px) {
                canvas.put_pixel(x, y, left_bg);
            }
        }
    }

    if right_bg != bg_color {
        for y in 0..canvas_h_px {
            for x in right_page_start_x.min(canvas_w_px)..canvas_w_px {
                canvas.put_pixel(x, y, right_bg);
            }
        }
    }

    // Sort elements by z_index
    let mut sorted_elements = spread.elements.clone();
    sorted_elements.sort_by_key(|e| e.z_index);

    let total_elements = sorted_elements.len();
    for (i, elem) in sorted_elements.iter().enumerate() {
        let keep_running = on_photo_progress(i + 1, total_elements);
        if !keep_running {
            break;
        }
        if elem.r#type == "text" || elem.text_payload.is_some() {
            render_text_element(&mut canvas, elem, offset_x_px, offset_y_px, scale, dpi);
        } else {
            render_photo_element(
                &mut canvas,
                elem,
                offset_x_px,
                offset_y_px,
                scale,
                include_bleed,
                total_spread_w,
                total_spread_h,
            );
        }
    }

    canvas
}

/// Renders an entire spread to high-res RgbaImage
#[allow(dead_code)]
pub fn render_spread_to_image(
    project: &ProjectRow,
    spread: &SpreadPayload,
    dpi: u32,
    include_bleed: bool,
) -> RgbaImage {
    render_spread_to_image_with_progress(project, spread, dpi, include_bleed, |_, _| true)
}

/// Slices a spread image into Left Page and Right Page with zero cross-page bleed overlap
pub fn split_spread_into_pages(
    spread_img: &RgbaImage,
    project: &ProjectRow,
    spread: &SpreadPayload,
    dpi: u32,
    include_bleed: bool,
) -> (RgbaImage, RgbaImage) {
    let scale = calculate_export_scale(&project.canvas_unit, project.canvas_dpi, dpi);
    let single_page_w = project.canvas_width;
    let gutter_w = spread.gutter_width;
    let bleed = spread.bleed;
    let total_w = spread_img.width();
    let total_h = spread_img.height();

    let spine_center_x = (((if include_bleed { bleed } else { 0.0 }) + single_page_w + gutter_w * 0.5) * scale).round() as u32;
    let spine_center_x = spine_center_x.min(total_w);

    let left_w = spine_center_x;
    let right_w = total_w.saturating_sub(spine_center_x);

    let left_page = image::imageops::crop_imm(spread_img, 0, 0, left_w, total_h).to_image();
    let right_page = image::imageops::crop_imm(spread_img, spine_center_x, 0, right_w, total_h).to_image();

    (left_page, right_page)
}

/// Applies fast multi-threaded print output unsharp masking to enhance micro-detail for physical printing
pub fn apply_print_sharpening(img: &RgbaImage, amount: &str) -> RgbaImage {
    let (alpha, threshold): (f32, i32) = match amount.to_lowercase().as_str() {
        "none" | "disabled" | "off" => return img.clone(),
        "high" => (0.55f32, 2),
        _ => (0.35f32, 2), // "standard" or default
    };

    let (width, height) = img.dimensions();
    if width < 3 || height < 3 {
        return img.clone();
    }

    let mut raw_vec = vec![0u8; (width * height * 4) as usize];
    let src_raw = img.as_raw();
    let row_stride = (width * 4) as usize;

    use rayon::prelude::*;
    raw_vec
        .par_chunks_exact_mut(row_stride)
        .enumerate()
        .for_each(|(y, row_slice)| {
            let y_u32 = y as u32;
            let prev_row_offset = if y_u32 == 0 { 0 } else { (y - 1) * row_stride };
            let curr_row_offset = y * row_stride;
            let next_row_offset = if y_u32 == height - 1 { curr_row_offset } else { (y + 1) * row_stride };

            for x in 0..(width as usize) {
                let px_idx = x * 4;
                let left_idx = if x == 0 { 0 } else { (x - 1) * 4 };
                let right_idx = if x == (width as usize) - 1 { px_idx } else { (x + 1) * 4 };

                // Process RGB channels
                for c in 0..3 {
                    let center = src_raw[curr_row_offset + px_idx + c] as i32;
                    let top = src_raw[prev_row_offset + px_idx + c] as i32;
                    let bottom = src_raw[next_row_offset + px_idx + c] as i32;
                    let left = src_raw[curr_row_offset + left_idx + c] as i32;
                    let right = src_raw[curr_row_offset + right_idx + c] as i32;

                    let laplacian = (center * 4) - (top + bottom + left + right);
                    if laplacian.abs() >= threshold {
                        let sharpened = center as f32 + (laplacian as f32 * alpha);
                        row_slice[px_idx + c] = sharpened.clamp(0.0, 255.0) as u8;
                    } else {
                        row_slice[px_idx + c] = center as u8;
                    }
                }
                // Preserve original Alpha channel
                row_slice[px_idx + 3] = src_raw[curr_row_offset + px_idx + 3];
            }
        });

    RgbaImage::from_raw(width, height, raw_vec).unwrap_or_else(|| img.clone())
}

/// Assembles JPEG image files into a multi-page PDF document
pub fn assemble_pdf_from_jpegs(
    jpeg_files: &[(PathBuf, u32, u32)], // (file_path, width_px, height_px)
    pdf_dest: &Path,
    dpi: u32,
) -> Result<(), String> {
    let mut pdf_data = Vec::new();
    let mut object_offsets = Vec::new();

    // PDF Header
    pdf_data.extend_from_slice(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

    let num_pages = jpeg_files.len();
    if num_pages == 0 {
        return Err("No pages to assemble into PDF".to_string());
    }

    // Object 1: Catalog
    object_offsets.push(pdf_data.len());
    pdf_data.extend_from_slice(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    // Object 2: Pages
    object_offsets.push(pdf_data.len());
    let mut kids_str = String::new();
    for i in 0..num_pages {
        let page_obj_num = 3 + i * 3;
        kids_str.push_str(&format!("{} 0 R ", page_obj_num));
    }
    let pages_obj = format!(
        "2 0 obj\n<< /Type /Pages /Kids [ {}] /Count {} >>\nendobj\n",
        kids_str, num_pages
    );
    pdf_data.extend_from_slice(pages_obj.as_bytes());

    for (i, (jpg_path, w_px, h_px)) in jpeg_files.iter().enumerate() {
        let page_obj_num = 3 + i * 3;
        let content_obj_num = page_obj_num + 1;
        let image_obj_num = page_obj_num + 2;

        let width_pt = (*w_px as f64 * 72.0 / dpi as f64).round();
        let height_pt = (*h_px as f64 * 72.0 / dpi as f64).round();

        // Read raw JPEG stream
        let raw_jpeg = fs::read(jpg_path).map_err(|e| format!("Failed to read JPEG {}: {}", jpg_path.display(), e))?;

        // Page Object
        object_offsets.push(pdf_data.len());
        let page_obj = format!(
            "{} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {} {}] /Contents {} 0 R /Resources << /XObject << /Im0 {} 0 R >> >> >>\nendobj\n",
            page_obj_num, width_pt, height_pt, content_obj_num, image_obj_num
        );
        pdf_data.extend_from_slice(page_obj.as_bytes());

        // Content Stream (Draw Image)
        object_offsets.push(pdf_data.len());
        let stream_cmd = format!("q {} 0 0 {} 0 0 cm /Im0 Do Q", width_pt, height_pt);
        let content_obj = format!(
            "{} 0 obj\n<< /Length {} >>\nstream\n{}\nendstream\nendobj\n",
            content_obj_num, stream_cmd.len(), stream_cmd
        );
        pdf_data.extend_from_slice(content_obj.as_bytes());

        // Image XObject (Direct DCTDecode passthrough)
        object_offsets.push(pdf_data.len());
        let img_header = format!(
            "{} 0 obj\n<< /Type /XObject /Subtype /Image /Width {} /Height {} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {} >>\nstream\n",
            image_obj_num, w_px, h_px, raw_jpeg.len()
        );
        pdf_data.extend_from_slice(img_header.as_bytes());
        pdf_data.extend_from_slice(&raw_jpeg);
        pdf_data.extend_from_slice(b"\nendstream\nendobj\n");
    }

    // XRef Table
    let xref_start = pdf_data.len();
    let total_objs = 2 + num_pages * 3;
    let mut xref = format!("xref\n0 {}\n0000000000 65535 f \n", total_objs + 1);
    for offset in &object_offsets {
        xref.push_str(&format!("{:010} 00000 n \n", offset));
    }
    pdf_data.extend_from_slice(xref.as_bytes());

    // Trailer
    let trailer = format!(
        "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{}\n%%EOF\n",
        total_objs + 1,
        xref_start
    );
    pdf_data.extend_from_slice(trailer.as_bytes());

    let tmp_pdf = pdf_dest.with_extension(format!("tmp_pdf_{}", uuid::Uuid::new_v4().simple()));
    let write_res = (|| -> Result<(), String> {
        let mut out = File::create(&tmp_pdf).map_err(|e| format!("Failed to create temp PDF file: {}", e))?;
        out.write_all(&pdf_data).map_err(|e| format!("Failed to write PDF data: {}", e))?;
        out.sync_all().map_err(|e| format!("Failed to flush PDF data: {}", e))?;
        Ok(())
    })();

    if let Err(e) = write_res {
        if tmp_pdf.exists() {
            let _ = fs::remove_file(&tmp_pdf);
        }
        return Err(e);
    }

    if pdf_dest.exists() {
        let _ = fs::remove_file(pdf_dest);
    }

    if let Err(e) = fs::rename(&tmp_pdf, pdf_dest) {
        if let Err(copy_err) = fs::copy(&tmp_pdf, pdf_dest) {
            if tmp_pdf.exists() {
                let _ = fs::remove_file(&tmp_pdf);
            }
            return Err(format!("Failed to finalize PDF {}: {} (copy fallback: {})", pdf_dest.display(), e, copy_err));
        }
        let _ = fs::remove_file(&tmp_pdf);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unit_to_pixels() {
        // 25.4 mm at 300 DPI = 300 px
        let px = unit_to_pixels(25.4, "mm", 300);
        assert!((px - 300.0).abs() < 0.001);

        // 1 inch at 300 DPI = 300 px
        let px_in = unit_to_pixels(1.0, "inch", 300);
        assert!((px_in - 300.0).abs() < 0.001);

        // 2.54 cm at 300 DPI = 300 px
        let px_cm = unit_to_pixels(2.54, "cm", 300);
        assert!((px_cm - 300.0).abs() < 0.001);
    }

    #[test]
    fn test_calculate_export_scale_physical_and_pixels() {
        // Physical units scale directly with export DPI
        let scale_mm_300 = calculate_export_scale("mm", 300, 300);
        assert!((scale_mm_300 - (300.0 / 25.4)).abs() < 0.001);

        let scale_cm_600 = calculate_export_scale("cm", 300, 600);
        assert!((scale_cm_600 - (600.0 / 2.54)).abs() < 0.001);

        let scale_in_300 = calculate_export_scale("inch", 300, 300);
        assert_eq!(scale_in_300, 300.0);

        // Pixel units scale dynamically by (export_dpi / base_dpi)
        let scale_px_72_to_300 = calculate_export_scale("px", 72, 300);
        assert!((scale_px_72_to_300 - (300.0 / 72.0)).abs() < 0.001);

        let scale_px_300_to_600 = calculate_export_scale("px", 300, 600);
        assert_eq!(scale_px_300_to_600, 2.0);

        let scale_px_same = calculate_export_scale("px", 300, 300);
        assert_eq!(scale_px_same, 1.0);
    }

    #[test]
    fn test_encode_with_dpi_metadata() {
        // Test JPEG DPI Header injection
        let rgb_img = image::RgbImage::new(10, 10);
        let jpg_300 = encode_jpeg_with_dpi(&rgb_img, 95, 300).unwrap();
        assert!(jpg_300.len() > 20);
        assert_eq!(&jpg_300[0..2], &[0xFF, 0xD8]); // SOI
        assert_eq!(&jpg_300[2..4], &[0xFF, 0xE0]); // APP0
        assert_eq!(&jpg_300[6..11], b"JFIF\0");
        assert_eq!(jpg_300[13], 1); // Units = DPI
        let x_density = u16::from_be_bytes([jpg_300[14], jpg_300[15]]);
        let y_density = u16::from_be_bytes([jpg_300[16], jpg_300[17]]);
        assert_eq!(x_density, 300);
        assert_eq!(y_density, 300);

        // Test PNG pHYs chunk injection
        let rgba_img = RgbaImage::new(10, 10);
        let png_600 = encode_png_with_dpi(&rgba_img, 600).unwrap();
        assert!(png_600.len() > 33);
        assert_eq!(&png_600[0..8], b"\x89PNG\r\n\x1a\n");
        // Verify pHYs chunk appears in PNG stream
        let ppm_expected = (600.0f64 * 39.37007874f64).round() as u32;
        let mut found_phys = false;
        for i in 0..(png_600.len() - 12) {
            if &png_600[i..i + 4] == b"pHYs" {
                found_phys = true;
                let ppm_x = u32::from_be_bytes([png_600[i + 4], png_600[i + 5], png_600[i + 6], png_600[i + 7]]);
                assert_eq!(ppm_x, ppm_expected);
                break;
            }
        }
        assert!(found_phys, "PNG output must contain pHYs DPI chunk");
    }

    #[test]
    fn test_parse_hex_color() {
        let white = parse_hex_color("#FFFFFF");
        assert_eq!(white, Rgba([255, 255, 255, 255]));

        let black = parse_hex_color("#000000");
        assert_eq!(black, Rgba([0, 0, 0, 255]));

        let red = parse_hex_color("#FF0000");
        assert_eq!(red, Rgba([255, 0, 0, 255]));
    }

    #[test]
    fn test_render_spread_and_pdf_generation() {
        use image::DynamicImage;
        let project = ProjectRow {
            id: "test-proj".to_string(),
            name: "Test Project".to_string(),
            canvas_width: 200.0,
            canvas_height: 300.0,
            canvas_unit: "mm".to_string(),
            canvas_dpi: 300,
            spacing_value: 4.0,
            spacing_unit: "mm".to_string(),
            margin_enabled: true,
            margin_value: 10.0,
            margin_unit: "mm".to_string(),
            border_enabled: false,
            border_width: 0.0,
            border_unit: "mm".to_string(),
            border_color: "#FFFFFF".to_string(),
            background_type: "solid".to_string(),
            background_color: "#FFFFFF".to_string(),
            file_path: None,
            created_at: "2026-08-29T12:00:00Z".to_string(),
            updated_at: "2026-08-29T12:00:00Z".to_string(),
        };

        let spread = SpreadPayload {
            id: "spread-1".to_string(),
            spread_index: 1,
            r#type: "interior".to_string(),
            name: "Spread 01".to_string(),
            left_page: None,
            right_page: None,
            gutter_width: 6.0,
            gutter_unit: "mm".to_string(),
            bleed: 3.0,
            safe_area: 10.0,
            background_color: "#FFFFFF".to_string(),
            elements: vec![],
        };

        // Render at 72 DPI for fast unit test
        let img = render_spread_to_image(&project, &spread, 72, false);
        // Total spread width = 200 * 2 + 6 = 406 mm -> 406 * (72/25.4) ~ 1150 px
        assert!(img.width() > 1000);
        assert!(img.height() > 800);

        // Test PDF Assembly
        let temp_dir = std::env::temp_dir().join("afsn_test_pdf");
        let _ = fs::create_dir_all(&temp_dir);

        let jpg_path = temp_dir.join("test_spread.jpg");
        let rgb_img = DynamicImage::ImageRgba8(img.clone()).to_rgb8();
        rgb_img.save_with_format(&jpg_path, image::ImageFormat::Jpeg).unwrap();

        let pdf_path = temp_dir.join("test_album.pdf");
        let jpegs = vec![(jpg_path.clone(), rgb_img.width(), rgb_img.height())];
        assemble_pdf_from_jpegs(&jpegs, &pdf_path, 72).unwrap();

        assert!(pdf_path.exists());
        let pdf_bytes = fs::read(&pdf_path).unwrap();
        assert!(pdf_bytes.starts_with(b"%PDF-1.4"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_generate_installer_graphics() {
        use image::{DynamicImage, RgbaImage, ImageBuffer, Rgba};
        let icons_dir = std::path::Path::new("icons");
        let _ = std::fs::create_dir_all(icons_dir);

        let logo_path = std::path::Path::new("../src/assets/app-logo.png");
        let hero_path = std::path::Path::new("../src/assets/welcome-hero.jpg");

        // 1. Generate Header Image (150x57) for NSIS (BMP Format)
        // Clean dark theme background (#0d1117) with refined 38x38 logo with comfortable margins
        let mut header: RgbaImage = ImageBuffer::from_pixel(150, 57, Rgba([13, 17, 23, 255]));
        if let Ok(logo) = image::open(logo_path) {
            let logo_size = 38;
            let resized_logo = image::imageops::resize(&logo, logo_size, logo_size, image::imageops::FilterType::Lanczos3);
            let x = 150 - logo_size - 12;
            let y = (57 - logo_size) / 2;
            image::imageops::overlay(&mut header, &resized_logo, x as i64, y as i64);
        }
        let header_rgb = DynamicImage::ImageRgba8(header.clone()).to_rgb8();
        let _ = header_rgb.save_with_format(icons_dir.join("header.bmp"), image::ImageFormat::Bmp);
        let _ = header.save_with_format(icons_dir.join("header.png"), image::ImageFormat::Png);

        // 2. Generate Sidebar Image (164x314) for NSIS (BMP Format)
        // Full-height cover photo with natural tree proportions
        let mut sidebar: RgbaImage = ImageBuffer::from_pixel(164, 314, Rgba([13, 17, 23, 255]));

        if let Ok(hero) = image::open(hero_path) {
            let (orig_w, orig_h) = (hero.width() as f64, hero.height() as f64);
            let target_w = 164.0;
            let target_h = 314.0;
            let scale = (target_w / orig_w).max(target_h / orig_h);
            let scaled_w = (orig_w * scale).round() as u32;
            let scaled_h = (orig_h * scale).round() as u32;

            let scaled_hero = image::imageops::resize(&hero, scaled_w, scaled_h, image::imageops::FilterType::Lanczos3);
            let crop_x = (scaled_w.saturating_sub(164)) / 2;
            let crop_y = (scaled_h.saturating_sub(314)) / 2;
            let cropped = image::imageops::crop_imm(&scaled_hero, crop_x, crop_y, 164, 314).to_image();
            image::imageops::overlay(&mut sidebar, &cropped, 0, 0);
        }

        // Apply subtle dark vignette at top and bottom to ground the layout without obscuring tree
        for y in 0..314 {
            // Top subtle vignette (y: 0..80) to give logo subtle depth
            let top_alpha = if y < 70 {
                (0.35 * (1.0 - (y as f64 / 70.0))).clamp(0.0, 1.0)
            } else {
                0.0
            };

            // Bottom subtle vignette (y: 250..314) to blend into installer base
            let bottom_alpha = if y > 240 {
                (0.45 * ((y - 240) as f64 / 74.0)).clamp(0.0, 1.0)
            } else {
                0.0
            };

            let alpha = top_alpha.max(bottom_alpha);
            if alpha > 0.0 {
                for x in 0..164 {
                    let p = sidebar.get_pixel_mut(x, y);
                    let dark = [13.0, 17.0, 23.0]; // #0d1117
                    p[0] = ((p[0] as f64) * (1.0 - alpha) + dark[0] * alpha).round() as u8;
                    p[1] = ((p[1] as f64) * (1.0 - alpha) + dark[1] * alpha).round() as u8;
                    p[2] = ((p[2] as f64) * (1.0 - alpha) + dark[2] * alpha).round() as u8;
                }
            }
        }

        // Overlay Logo in the open sky area at the top (y = 20..72)
        // Center x = (164 - 52) / 2 = 56. Leaves plenty of open breathing room before tree starts at y = 125.
        if let Ok(logo) = image::open(logo_path) {
            let logo_size = 52;
            let resized_logo = image::imageops::resize(&logo, logo_size, logo_size, image::imageops::FilterType::Lanczos3);
            let logo_x = (164 - logo_size) / 2;
            let logo_y = 22;

            // Render soft drop shadow behind logo for studio pop
            for dy in 0..logo_size {
                for dx in 0..logo_size {
                    let lp = resized_logo.get_pixel(dx, dy);
                    let a = lp[3] as f64 / 255.0;
                    if a > 0.05 {
                        let sx = logo_x + dx + 1;
                        let sy = logo_y + dy + 2;
                        if sx < 164 && sy < 314 {
                            let p = sidebar.get_pixel_mut(sx, sy);
                            let shadow_factor = a * 0.35;
                            p[0] = ((p[0] as f64) * (1.0 - shadow_factor)).round() as u8;
                            p[1] = ((p[1] as f64) * (1.0 - shadow_factor)).round() as u8;
                            p[2] = ((p[2] as f64) * (1.0 - shadow_factor)).round() as u8;
                        }
                    }
                }
            }

            image::imageops::overlay(&mut sidebar, &resized_logo, logo_x as i64, logo_y as i64);
        }

        let _ = sidebar.save_with_format(icons_dir.join("sidebar.png"), image::ImageFormat::Png);
        let sidebar_rgb = DynamicImage::ImageRgba8(sidebar).to_rgb8();
        let _ = sidebar_rgb.save_with_format(icons_dir.join("sidebar.bmp"), image::ImageFormat::Bmp);
    }

    #[test]
    fn test_apply_print_sharpening() {
        let test_img: RgbaImage = ImageBuffer::from_pixel(100, 100, Rgba([128, 128, 128, 255]));
        let standard_sharp = apply_print_sharpening(&test_img, "standard");
        assert_eq!(standard_sharp.dimensions(), (100, 100));

        let high_sharp = apply_print_sharpening(&test_img, "high");
        assert_eq!(high_sharp.dimensions(), (100, 100));
    }
}

