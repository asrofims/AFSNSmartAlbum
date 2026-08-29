use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
use crate::db::{ElementPayload, ProjectRow, SpreadPayload};

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
    pub output_dir: String,
    pub selected_spread_ids: Option<Vec<String>>,
}

fn default_jpeg_quality() -> u8 {
    95
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

/// Convert physical dimension (in mm, cm, inch, or px) to pixels at given DPI
pub fn unit_to_pixels(val: f64, unit: &str, dpi: u32) -> f64 {
    let dpi_f = dpi as f64;
    match unit.to_lowercase().as_str() {
        "mm" => val * (dpi_f / 25.4),
        "cm" => val * (dpi_f / 2.54),
        "inch" | "in" => val * dpi_f,
        "px" => val,
        _ => val * (dpi_f / 25.4), // default mm
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
) {
    if elem.file_path.is_empty() {
        return;
    }

    let frame_px_x = (elem.x * scale_factor + offset_x_px).round() as i64;
    let frame_px_y = (elem.y * scale_factor + offset_y_px).round() as i64;
    let frame_px_w = (elem.width * scale_factor).round() as u32;
    let frame_px_h = (elem.height * scale_factor).round() as u32;

    if frame_px_w == 0 || frame_px_h == 0 {
        return;
    }

    let canvas_w = canvas.width() as i64;
    let canvas_h = canvas.height() as i64;

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
    let frame_aspect = if elem.height > 0.0 { elem.width / elem.height } else { 1.0 };
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
            if elem.opacity < 0.999 {
                let existing = canvas.get_pixel_mut(dest_x as u32, dest_y as u32);
                let alpha = (p[3] as f64 / 255.0 * elem.opacity).clamp(0.0, 1.0);
                let inv_alpha = 1.0 - alpha;
                existing[0] = ((p[0] as f64 * alpha) + (existing[0] as f64 * inv_alpha)) as u8;
                existing[1] = ((p[1] as f64 * alpha) + (existing[1] as f64 * inv_alpha)) as u8;
                existing[2] = ((p[2] as f64 * alpha) + (existing[2] as f64 * inv_alpha)) as u8;
                existing[3] = 255;
            } else {
                canvas.put_pixel(dest_x as u32, dest_y as u32, *p);
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
    let scale = unit_to_pixels(1.0, &project.canvas_unit, dpi);
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

    // Sort elements by z_index
    let mut sorted_elements = spread.elements.clone();
    sorted_elements.sort_by_key(|e| e.z_index);

    let total_elements = sorted_elements.len();
    for (i, elem) in sorted_elements.iter().enumerate() {
        let keep_running = on_photo_progress(i + 1, total_elements);
        if !keep_running {
            break;
        }
        render_photo_element(&mut canvas, elem, offset_x_px, offset_y_px, scale);
    }

    canvas
}

/// Renders an entire spread to high-res RgbaImage
pub fn render_spread_to_image(
    project: &ProjectRow,
    spread: &SpreadPayload,
    dpi: u32,
    include_bleed: bool,
) -> RgbaImage {
    render_spread_to_image_with_progress(project, spread, dpi, include_bleed, |_, _| true)
}

/// Slices a spread image into Left Page and Right Page
pub fn split_spread_into_pages(
    spread_img: &RgbaImage,
    project: &ProjectRow,
    spread: &SpreadPayload,
    dpi: u32,
    include_bleed: bool,
) -> (RgbaImage, RgbaImage) {
    let scale = unit_to_pixels(1.0, &project.canvas_unit, dpi);
    let single_page_w = project.canvas_width;
    let gutter_w = spread.gutter_width;
    let bleed = spread.bleed;

    let page_w_px = (if include_bleed { (single_page_w + bleed * 1.5) * scale } else { (single_page_w + gutter_w * 0.5) * scale }).round() as u32;
    let page_h_px = spread_img.height();

    let left_x = 0;
    let right_x = (spread_img.width().saturating_sub(page_w_px)).max(0);

    let left_page = image::imageops::crop_imm(spread_img, left_x, 0, page_w_px.min(spread_img.width()), page_h_px).to_image();
    let right_page = image::imageops::crop_imm(spread_img, right_x, 0, page_w_px.min(spread_img.width() - right_x), page_h_px).to_image();

    (left_page, right_page)
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

    let mut out = File::create(pdf_dest).map_err(|e| format!("Failed to create PDF file: {}", e))?;
    out.write_all(&pdf_data).map_err(|e| format!("Failed to write PDF data: {}", e))?;

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
}

