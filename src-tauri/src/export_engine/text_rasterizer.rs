use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use fontdue::{Font, FontSettings};
use image::{Rgba, RgbaImage};
use serde::{Deserialize, Serialize};

use crate::db::ElementPayload;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextElementPayload {
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub style: TextStylePayload,
    pub styled_ranges: Option<Vec<StyledRangePayload>>,
    pub text_runs: Option<Vec<TextRunPayload>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextStylePayload {
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_font_size")]
    pub font_size: f64,
    #[serde(default = "default_font_weight")]
    pub font_weight: String,
    #[serde(default = "default_font_style")]
    pub font_style: String,
    #[serde(default = "default_text_decoration")]
    pub text_decoration: String,
    #[serde(default = "default_fill")]
    pub fill: String,
    #[serde(default = "default_align")]
    pub align: String,
    #[serde(default = "default_vertical_align")]
    pub vertical_align: String,
    #[serde(default = "default_line_height")]
    pub line_height: f64,
    #[serde(default)]
    pub letter_spacing: f64,
    #[serde(default = "default_padding")]
    pub padding: f64,
    #[serde(default = "default_word_wrap")]
    pub word_wrap: String,
}

fn default_font_family() -> String { "Inter".to_string() }
fn default_font_size() -> f64 { 24.0 }
fn default_font_weight() -> String { "normal".to_string() }
fn default_font_style() -> String { "normal".to_string() }
fn default_text_decoration() -> String { "none".to_string() }
fn default_fill() -> String { "#1e293b".to_string() }
fn default_align() -> String { "center".to_string() }
fn default_vertical_align() -> String { "middle".to_string() }
fn default_line_height() -> f64 { 1.3 }
fn default_padding() -> f64 { 6.0 }
fn default_word_wrap() -> String { "word".to_string() }

impl Default for TextStylePayload {
    fn default() -> Self {
        Self {
            font_family: default_font_family(),
            font_size: default_font_size(),
            font_weight: default_font_weight(),
            font_style: default_font_style(),
            text_decoration: default_text_decoration(),
            fill: default_fill(),
            align: default_align(),
            vertical_align: default_vertical_align(),
            line_height: default_line_height(),
            letter_spacing: 0.0,
            padding: default_padding(),
            word_wrap: default_word_wrap(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StyledRangePayload {
    pub id: Option<String>,
    pub start: usize,
    pub end: usize,
    pub font_family: Option<String>,
    pub font_size: Option<f64>,
    pub font_weight: Option<String>,
    pub font_style: Option<String>,
    pub text_decoration: Option<String>,
    pub fill: Option<String>,
    pub highlight: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextRunPayload {
    pub text: String,
    pub font_family: Option<String>,
    pub font_size: Option<f64>,
    pub font_weight: Option<String>,
    pub font_style: Option<String>,
    pub text_decoration: Option<String>,
    pub fill: Option<String>,
    pub highlight: Option<String>,
}

/// Global thread-safe cache of loaded fontdue Fonts: key is (family_lower, is_bold, is_italic)
static FONT_CACHE: OnceLock<Mutex<HashMap<(String, bool, bool), Option<Arc<Font>>>>> = OnceLock::new();

fn get_font_cache() -> &'static Mutex<HashMap<(String, bool, bool), Option<Arc<Font>>>> {
    FONT_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Parse CSS / Hex color into Rgba<u8>
pub fn parse_color(c: &str) -> Rgba<u8> {
    let trimmed = c.trim();
    if trimmed.starts_with('#') {
        let hex = trimmed.trim_start_matches('#');
        if hex.len() == 3 {
            // #RGB -> #RRGGBB
            let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).unwrap_or(255);
            let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).unwrap_or(255);
            let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).unwrap_or(255);
            return Rgba([r, g, b, 255]);
        } else if hex.len() == 6 {
            if let (Ok(r), Ok(g), Ok(b)) = (
                u8::from_str_radix(&hex[0..2], 16),
                u8::from_str_radix(&hex[2..4], 16),
                u8::from_str_radix(&hex[4..6], 16),
            ) {
                return Rgba([r, g, b, 255]);
            }
        } else if hex.len() == 8 {
            if let (Ok(r), Ok(g), Ok(b), Ok(a)) = (
                u8::from_str_radix(&hex[0..2], 16),
                u8::from_str_radix(&hex[2..4], 16),
                u8::from_str_radix(&hex[4..6], 16),
                u8::from_str_radix(&hex[6..8], 16),
            ) {
                return Rgba([r, g, b, a]);
            }
        }
    } else if trimmed.starts_with("rgb") {
        // rgb(r, g, b) or rgba(r, g, b, a)
        let inside = trimmed
            .trim_start_matches("rgba(")
            .trim_start_matches("rgb(")
            .trim_end_matches(')');
        let parts: Vec<&str> = inside.split(',').map(|s| s.trim()).collect();
        if parts.len() >= 3 {
            let r = parts[0].parse::<u8>().unwrap_or(0);
            let g = parts[1].parse::<u8>().unwrap_or(0);
            let b = parts[2].parse::<u8>().unwrap_or(0);
            let a = if parts.len() >= 4 {
                let a_f = parts[3].parse::<f32>().unwrap_or(1.0);
                (a_f.clamp(0.0, 1.0) * 255.0).round() as u8
            } else {
                255
            };
            return Rgba([r, g, b, a]);
        }
    }

    // Default rich dark slate
    Rgba([30, 41, 59, 255])
}

/// Find system font directories
fn get_system_font_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Ok(windir) = std::env::var("WINDIR") {
            dirs.push(PathBuf::from(&windir).join("Fonts"));
        }
        dirs.push(PathBuf::from("C:\\Windows\\Fonts"));
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            dirs.push(PathBuf::from(&local_app_data).join("Microsoft\\Windows\\Fonts"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        dirs.push(PathBuf::from("/System/Library/Fonts"));
        dirs.push(PathBuf::from("/Library/Fonts"));
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(PathBuf::from(&home).join("Library/Fonts"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        dirs.push(PathBuf::from("/usr/share/fonts"));
        dirs.push(PathBuf::from("/usr/local/share/fonts"));
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(PathBuf::from(&home).join(".local/share/fonts"));
            dirs.push(PathBuf::from(&home).join(".fonts"));
        }
    }

    dirs
}

/// Resolve font file path on system with smart font family fallback
fn resolve_font_path(family: &str, is_bold: bool, is_italic: bool) -> Option<PathBuf> {
    let family_lower = family.to_lowercase();
    let dirs = get_system_font_dirs();

    // Map common album families to actual system filenames
    let candidate_names: Vec<String> = if family_lower.contains("georgia")
        || family_lower.contains("playfair")
        || family_lower.contains("garamond")
        || family_lower.contains("cormorant")
    {
        match (is_bold, is_italic) {
            (true, true) => vec!["georgiaz.ttf".into(), "georgiab.ttf".into(), "georgia.ttf".into()],
            (true, false) => vec!["georgiab.ttf".into(), "georgia.ttf".into()],
            (false, true) => vec!["georgiai.ttf".into(), "georgia.ttf".into()],
            (false, false) => vec!["georgia.ttf".into()],
        }
    } else if family_lower.contains("times")
        || family_lower.contains("cinzel")
        || family_lower.contains("roman")
    {
        match (is_bold, is_italic) {
            (true, true) => vec!["timesbi.ttf".into(), "timesbd.ttf".into(), "times.ttf".into()],
            (true, false) => vec!["timesbd.ttf".into(), "times.ttf".into()],
            (false, true) => vec!["timesi.ttf".into(), "times.ttf".into()],
            (false, false) => vec!["times.ttf".into()],
        }
    } else if family_lower.contains("script")
        || family_lower.contains("great vibes")
        || family_lower.contains("cursive")
    {
        match (is_bold, is_italic) {
            (true, _) => vec!["segoescb.ttf".into(), "segoesc.ttf".into()],
            _ => vec!["segoesc.ttf".into(), "segoescb.ttf".into()],
        }
    } else if family_lower.contains("arial") {
        match (is_bold, is_italic) {
            (true, true) => vec!["arialbi.ttf".into(), "arialbd.ttf".into(), "arial.ttf".into()],
            (true, false) => vec!["arialbd.ttf".into(), "arial.ttf".into()],
            (false, true) => vec!["ariali.ttf".into(), "arial.ttf".into()],
            (false, false) => vec!["arial.ttf".into()],
        }
    } else {
        // Default sans-serif: Inter, Montserrat, Segoe UI, Roboto, etc.
        match (is_bold, is_italic) {
            (true, true) => vec![
                "segoeuiz.ttf".into(),
                "segoeuib.ttf".into(),
                "arialbi.ttf".into(),
                "arialbd.ttf".into(),
                "segoeui.ttf".into(),
                "arial.ttf".into(),
            ],
            (true, false) => vec![
                "segoeuib.ttf".into(),
                "arialbd.ttf".into(),
                "segoeui.ttf".into(),
                "arial.ttf".into(),
            ],
            (false, true) => vec![
                "segoeuii.ttf".into(),
                "ariali.ttf".into(),
                "segoeui.ttf".into(),
                "arial.ttf".into(),
            ],
            (false, false) => vec![
                "segoeui.ttf".into(),
                "arial.ttf".into(),
            ],
        }
    };

    // 1. First search explicit candidate names
    for dir in &dirs {
        for name in &candidate_names {
            let p = dir.join(name);
            if p.exists() {
                return Some(p);
            }
        }
    }

    // 2. Search directory for files matching family name
    for dir in &dirs {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ext_lower == "ttf" || ext_lower == "otf" {
                        if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                            let stem_lower = stem.to_lowercase();
                            if stem_lower.contains(&family_lower) {
                                return Some(p);
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Fallback to any guaranteed standard font on system
    let universal_fallbacks = ["arial.ttf", "segoeui.ttf", "times.ttf", "georgia.ttf", "DejaVuSans.ttf"];
    for dir in &dirs {
        for fb in &universal_fallbacks {
            let p = dir.join(fb);
            if p.exists() {
                return Some(p);
            }
        }
    }

    None
}

/// Load or retrieve font from memory cache
pub fn get_or_load_font(family: &str, is_bold: bool, is_italic: bool) -> Option<Arc<Font>> {
    let key = (family.to_lowercase(), is_bold, is_italic);
    let cache = get_font_cache();
    {
        let guard = cache.lock().unwrap();
        if let Some(cached) = guard.get(&key) {
            return cached.clone();
        }
    }

    let loaded = if let Some(path) = resolve_font_path(family, is_bold, is_italic) {
        match fs::read(&path) {
            Ok(bytes) => {
                match Font::from_bytes(bytes, FontSettings::default()) {
                    Ok(f) => Some(Arc::new(f)),
                    Err(e) => {
                        log::warn!("Failed to parse font file {:?}: {}", path, e);
                        None
                    }
                }
            }
            Err(e) => {
                log::warn!("Failed to read font file {:?}: {}", path, e);
                None
            }
        }
    } else {
        log::warn!("No suitable font found on system for family: {}", family);
        None
    };

    let mut guard = cache.lock().unwrap();
    guard.insert(key, loaded.clone());
    loaded
}

/// Alpha blend pixel using standard Porter-Duff source-over formula
#[inline]
pub fn blend_pixel_over(dest: &mut Rgba<u8>, r: u8, g: u8, b: u8, src_a: f32) {
    if src_a <= 0.001 {
        return;
    }
    let dest_a = dest[3] as f32 / 255.0;
    let out_a = src_a + dest_a * (1.0 - src_a);
    if out_a <= 0.001 {
        return;
    }

    let out_r = (r as f32 * src_a + dest[0] as f32 * dest_a * (1.0 - src_a)) / out_a;
    let out_g = (g as f32 * src_a + dest[1] as f32 * dest_a * (1.0 - src_a)) / out_a;
    let out_b = (b as f32 * src_a + dest[2] as f32 * dest_a * (1.0 - src_a)) / out_a;

    *dest = Rgba([
        out_r.clamp(0.0, 255.0).round() as u8,
        out_g.clamp(0.0, 255.0).round() as u8,
        out_b.clamp(0.0, 255.0).round() as u8,
        (out_a * 255.0).clamp(0.0, 255.0).round() as u8,
    ]);
}

/// Internal token for text measurement and line layout
#[derive(Clone, Debug)]
struct MeasuredToken {
    text: String,
    is_space: bool,
    is_newline: bool,
    font_family: String,
    font_size_px: f32,
    is_bold: bool,
    is_italic: bool,
    text_decoration: String,
    fill: Rgba<u8>,
    highlight: Option<Rgba<u8>>,
    width: f32,
    ascent: f32,
    descent: f32,
}

/// A line containing laid out tokens
#[derive(Clone, Debug)]
struct LayoutLine {
    tokens: Vec<MeasuredToken>,
    width: f32,
    max_line_height: f32,
    max_ascent: f32,
    max_descent: f32,
}

/// Convert styled ranges into non-overlapping TextRun tokens matching frontend domain
fn ranges_to_text_runs(
    text: &str,
    ranges: Option<&Vec<StyledRangePayload>>,
    base_style: &TextStylePayload,
) -> Vec<TextRunPayload> {
    let chars: Vec<char> = text.chars().collect();
    let total_len = chars.len();
    if total_len == 0 {
        return Vec::new();
    }

    let Some(ranges) = ranges else {
        return vec![TextRunPayload {
            text: text.to_string(),
            font_family: Some(base_style.font_family.clone()),
            font_size: Some(base_style.font_size),
            font_weight: Some(base_style.font_weight.clone()),
            font_style: Some(base_style.font_style.clone()),
            text_decoration: Some(base_style.text_decoration.clone()),
            fill: Some(base_style.fill.clone()),
            highlight: None,
        }];
    };

    if ranges.is_empty() {
        return vec![TextRunPayload {
            text: text.to_string(),
            font_family: Some(base_style.font_family.clone()),
            font_size: Some(base_style.font_size),
            font_weight: Some(base_style.font_weight.clone()),
            font_style: Some(base_style.font_style.clone()),
            text_decoration: Some(base_style.text_decoration.clone()),
            fill: Some(base_style.fill.clone()),
            highlight: None,
        }];
    }

    // Determine style per character
    let mut runs: Vec<TextRunPayload> = Vec::new();
    let mut current_char_idx = 0;

    while current_char_idx < total_len {
        let mut char_family = base_style.font_family.clone();
        let mut char_size = base_style.font_size;
        let mut char_weight = base_style.font_weight.clone();
        let mut char_style = base_style.font_style.clone();
        let mut char_decor = base_style.text_decoration.clone();
        let mut char_fill = base_style.fill.clone();
        let mut char_highlight = None;

        for r in ranges {
            if current_char_idx >= r.start && current_char_idx < r.end {
                if let Some(ref f) = r.font_family { char_family = f.clone(); }
                if let Some(s) = r.font_size { char_size = s; }
                if let Some(ref w) = r.font_weight { char_weight = w.clone(); }
                if let Some(ref st) = r.font_style { char_style = st.clone(); }
                if let Some(ref d) = r.text_decoration { char_decor = d.clone(); }
                if let Some(ref fi) = r.fill { char_fill = fi.clone(); }
                if let Some(ref hl) = r.highlight { char_highlight = Some(hl.clone()); }
            }
        }

        // Find how far this exact style extends
        let mut end_char_idx = current_char_idx + 1;
        while end_char_idx < total_len {
            let mut next_family = base_style.font_family.clone();
            let mut next_size = base_style.font_size;
            let mut next_weight = base_style.font_weight.clone();
            let mut next_style = base_style.font_style.clone();
            let mut next_decor = base_style.text_decoration.clone();
            let mut next_fill = base_style.fill.clone();
            let mut next_highlight = None;

            for r in ranges {
                if end_char_idx >= r.start && end_char_idx < r.end {
                    if let Some(ref f) = r.font_family { next_family = f.clone(); }
                    if let Some(s) = r.font_size { next_size = s; }
                    if let Some(ref w) = r.font_weight { next_weight = w.clone(); }
                    if let Some(ref st) = r.font_style { next_style = st.clone(); }
                    if let Some(ref d) = r.text_decoration { next_decor = d.clone(); }
                    if let Some(ref fi) = r.fill { next_fill = fi.clone(); }
                    if let Some(ref hl) = r.highlight { next_highlight = Some(hl.clone()); }
                }
            }

            if next_family == char_family
                && (next_size - char_size).abs() < 0.01
                && next_weight == char_weight
                && next_style == char_style
                && next_decor == char_decor
                && next_fill == char_fill
                && next_highlight == char_highlight
            {
                end_char_idx += 1;
            } else {
                break;
            }
        }

        let slice: String = chars[current_char_idx..end_char_idx].iter().collect();
        runs.push(TextRunPayload {
            text: slice,
            font_family: Some(char_family),
            font_size: Some(char_size),
            font_weight: Some(char_weight),
            font_style: Some(char_style),
            text_decoration: Some(char_decor),
            fill: Some(char_fill),
            highlight: char_highlight,
        });

        current_char_idx = end_char_idx;
    }

    runs
}

/// Renders a text node element onto the high-resolution spread canvas
pub fn render_text_element(
    canvas: &mut RgbaImage,
    elem: &ElementPayload,
    offset_x_px: f64,
    offset_y_px: f64,
    scale_factor: f64,
    dpi: u32,
) {
    let Some(ref raw_payload) = elem.text_payload else {
        return;
    };

    let parsed_payload: TextElementPayload = match serde_json::from_str(raw_payload) {
        Ok(p) => p,
        Err(e) => {
            log::warn!("Could not parse text_payload for element {}: {}", elem.id, e);
            return;
        }
    };

    let full_text = &parsed_payload.text;
    if full_text.is_empty() {
        return;
    }

    let base_style = &parsed_payload.style;

    // Physical bounds on canvas
    let frame_px_x = (elem.x * scale_factor + offset_x_px).round() as i64;
    let frame_px_y = (elem.y * scale_factor + offset_y_px).round() as i64;
    let frame_px_w = (elem.width * scale_factor).round() as u32;
    let frame_px_h = (elem.height * scale_factor).round() as u32;

    if frame_px_w == 0 || frame_px_h == 0 {
        return;
    }

    let canvas_w = canvas.width() as i64;
    let canvas_h = canvas.height() as i64;

    // Boundary check for non-rotated boxes
    if elem.rotation.abs() < 0.01 {
        if frame_px_x + frame_px_w as i64 <= 0
            || frame_px_x >= canvas_w
            || frame_px_y + frame_px_h as i64 <= 0
            || frame_px_y >= canvas_h
        {
            return;
        }
    }

    // Convert styled ranges to runs
    let runs = if let Some(ref precomputed_runs) = parsed_payload.text_runs {
        if !precomputed_runs.is_empty() {
            precomputed_runs.clone()
        } else {
            ranges_to_text_runs(full_text, parsed_payload.styled_ranges.as_ref(), base_style)
        }
    } else {
        ranges_to_text_runs(full_text, parsed_payload.styled_ranges.as_ref(), base_style)
    };

    // Calculate padding in export pixels (1pt = dpi / 72.0 px)
    let dpi_f = dpi as f64;
    let pt_to_px = (dpi_f / 72.0) as f32;
    let raw_padding_px = (base_style.padding as f32 * pt_to_px).max(2.0);
    let padding_px = raw_padding_px.min(frame_px_w as f32 / 4.0).max(2.0);
    let available_w = (frame_px_w as f32 - 2.0 * padding_px).max(10.0);
    let available_h = (frame_px_h as f32 - 2.0 * padding_px).max(10.0);

    // 1. Tokenize runs into atomic words, whitespace, and newlines
    let mut raw_tokens: Vec<MeasuredToken> = Vec::new();

    for run in &runs {
        let font_pt = run.font_size.unwrap_or(base_style.font_size) as f32;
        let font_size_px = (font_pt * pt_to_px).max(4.0);

        let family = run.font_family.as_ref().unwrap_or(&base_style.font_family);
        let weight = run.font_weight.as_ref().unwrap_or(&base_style.font_weight);
        let style = run.font_style.as_ref().unwrap_or(&base_style.font_style);
        let decor = run.text_decoration.as_ref().unwrap_or(&base_style.text_decoration);
        let fill_color = parse_color(run.fill.as_ref().unwrap_or(&base_style.fill));
        let hl_color = run.highlight.as_ref().map(|h| parse_color(h));

        let is_bold = weight == "bold" || weight.parse::<u32>().unwrap_or(400) >= 600;
        let is_italic = style == "italic";

        let font_opt = get_or_load_font(family, is_bold, is_italic);

        // Split text by lines and spaces
        let mut current_segment = String::new();
        let mut chars = run.text.chars().peekable();

        while let Some(c) = chars.next() {
            if c == '\n' {
                if !current_segment.is_empty() {
                    let is_sp = current_segment.chars().all(|ch| ch.is_whitespace());
                    let w = measure_text_width(&current_segment, font_opt.as_deref(), font_size_px);
                    let (asc, desc) = get_font_metrics(font_opt.as_deref(), font_size_px);
                    raw_tokens.push(MeasuredToken {
                        text: current_segment.clone(),
                        is_space: is_sp,
                        is_newline: false,
                        font_family: family.clone(),
                        font_size_px,
                        is_bold,
                        is_italic,
                        text_decoration: decor.clone(),
                        fill: fill_color,
                        highlight: hl_color,
                        width: w,
                        ascent: asc,
                        descent: desc,
                    });
                    current_segment.clear();
                }
                raw_tokens.push(MeasuredToken {
                    text: "\n".to_string(),
                    is_space: false,
                    is_newline: true,
                    font_family: family.clone(),
                    font_size_px,
                    is_bold,
                    is_italic,
                    text_decoration: decor.clone(),
                    fill: fill_color,
                    highlight: None,
                    width: 0.0,
                    ascent: font_size_px * 0.8,
                    descent: font_size_px * 0.2,
                });
            } else if c.is_whitespace() {
                if !current_segment.is_empty() {
                    let is_sp = current_segment.chars().all(|ch| ch.is_whitespace());
                    let w = measure_text_width(&current_segment, font_opt.as_deref(), font_size_px);
                    let (asc, desc) = get_font_metrics(font_opt.as_deref(), font_size_px);
                    raw_tokens.push(MeasuredToken {
                        text: current_segment.clone(),
                        is_space: is_sp,
                        is_newline: false,
                        font_family: family.clone(),
                        font_size_px,
                        is_bold,
                        is_italic,
                        text_decoration: decor.clone(),
                        fill: fill_color,
                        highlight: hl_color,
                        width: w,
                        ascent: asc,
                        descent: desc,
                    });
                    current_segment.clear();
                }
                // Accumulate whitespace
                let mut ws = String::new();
                ws.push(c);
                while let Some(&next_c) = chars.peek() {
                    if next_c.is_whitespace() && next_c != '\n' {
                        ws.push(chars.next().unwrap());
                    } else {
                        break;
                    }
                }
                let w = measure_text_width(&ws, font_opt.as_deref(), font_size_px);
                let (asc, desc) = get_font_metrics(font_opt.as_deref(), font_size_px);
                raw_tokens.push(MeasuredToken {
                    text: ws,
                    is_space: true,
                    is_newline: false,
                    font_family: family.clone(),
                    font_size_px,
                    is_bold,
                    is_italic,
                    text_decoration: decor.clone(),
                    fill: fill_color,
                    highlight: hl_color,
                    width: w,
                    ascent: asc,
                    descent: desc,
                });
            } else {
                current_segment.push(c);
            }
        }

        if !current_segment.is_empty() {
            let is_sp = current_segment.chars().all(|ch| ch.is_whitespace());
            let w = measure_text_width(&current_segment, font_opt.as_deref(), font_size_px);
            let (asc, desc) = get_font_metrics(font_opt.as_deref(), font_size_px);
            raw_tokens.push(MeasuredToken {
                text: current_segment,
                is_space: is_sp,
                is_newline: false,
                font_family: family.clone(),
                font_size_px,
                is_bold,
                is_italic,
                text_decoration: decor.clone(),
                fill: fill_color,
                highlight: hl_color,
                width: w,
                ascent: asc,
                descent: desc,
            });
        }
    }

    // 2. Break tokens into visual wrapped lines
    let mut lines: Vec<LayoutLine> = Vec::new();
    let mut current_line_tokens: Vec<MeasuredToken> = Vec::new();
    let mut current_line_w: f32 = 0.0;
    let mut current_max_asc: f32 = 0.0;
    let mut current_max_desc: f32 = 0.0;
    let mut current_max_lh: f32 = 0.0;

    let line_height_multiplier = base_style.line_height as f32;
    let should_wrap = base_style.word_wrap != "none";

    let mut push_line = |tokens: &mut Vec<MeasuredToken>,
                         line_w: &mut f32,
                         max_asc: &mut f32,
                         max_desc: &mut f32,
                         max_lh: &mut f32| {
        if tokens.is_empty() {
            let fallback_size = base_style.font_size as f32 * pt_to_px;
            lines.push(LayoutLine {
                tokens: Vec::new(),
                width: 0.0,
                max_line_height: fallback_size * line_height_multiplier,
                max_ascent: fallback_size * 0.8,
                max_descent: fallback_size * 0.2,
            });
            return;
        }

        let mut trimmed_w = *line_w;
        if let Some(last) = tokens.last() {
            if last.is_space {
                trimmed_w = (trimmed_w - last.width).max(0.0);
            }
        }

        lines.push(LayoutLine {
            tokens: std::mem::take(tokens),
            width: trimmed_w,
            max_line_height: *max_lh,
            max_ascent: *max_asc,
            max_descent: *max_desc,
        });

        *line_w = 0.0;
        *max_asc = 0.0;
        *max_desc = 0.0;
        *max_lh = 0.0;
    };

    for tok in raw_tokens {
        if tok.is_newline {
            push_line(
                &mut current_line_tokens,
                &mut current_line_w,
                &mut current_max_asc,
                &mut current_max_desc,
                &mut current_max_lh,
            );
            continue;
        }

        let tok_lh = tok.font_size_px * line_height_multiplier;

        if should_wrap
            && !current_line_tokens.is_empty()
            && current_line_w + tok.width > available_w
            && !tok.is_space
        {
            push_line(
                &mut current_line_tokens,
                &mut current_line_w,
                &mut current_max_asc,
                &mut current_max_desc,
                &mut current_max_lh,
            );
        }

        current_line_w += tok.width;
        current_max_asc = current_max_asc.max(tok.ascent);
        current_max_desc = current_max_desc.max(tok.descent);
        current_max_lh = current_max_lh.max(tok_lh);
        current_line_tokens.push(tok);
    }

    if !current_line_tokens.is_empty() {
        push_line(
            &mut current_line_tokens,
            &mut current_line_w,
            &mut current_max_asc,
            &mut current_max_desc,
            &mut current_max_lh,
        );
    }

    // 3. Vertical alignment
    let total_content_h: f32 = lines.iter().map(|l| l.max_line_height).sum();
    let start_y = match base_style.vertical_align.as_str() {
        "middle" => padding_px + ((available_h - total_content_h) / 2.0).max(0.0),
        "bottom" => padding_px + (available_h - total_content_h).max(0.0),
        _ => padding_px, // "top"
    };

    // 4. Render into element text buffer
    let mut text_buffer = RgbaImage::new(frame_px_w, frame_px_h);
    let mut current_top = start_y;

    for line in &lines {
        let start_x = match base_style.align.as_str() {
            "center" => padding_px + ((available_w - line.width) / 2.0).max(0.0),
            "right" => padding_px + (available_w - line.width).max(0.0),
            _ => padding_px, // "left"
        };

        let baseline = current_top + line.max_ascent
            + ((line.max_line_height - (line.max_ascent + line.max_descent)) / 2.0).max(0.0);

        let mut token_x = start_x;

        // Pass 1: Render Highlights
        for tok in &line.tokens {
            if let Some(ref hl) = tok.highlight {
                if !tok.is_space && !tok.is_newline {
                    let hl_x = (token_x - 2.0).max(0.0).round() as i32;
                    let hl_y = (baseline - tok.ascent - 2.0).max(0.0).round() as i32;
                    let hl_w = (tok.width + 4.0).round() as i32;
                    let hl_h = (tok.ascent + tok.descent + 4.0).round() as i32;
                    draw_filled_rect(&mut text_buffer, hl_x, hl_y, hl_w, hl_h, *hl);
                }
            }
            token_x += tok.width;
        }

        // Pass 2: Render Glyphs & Decorations
        token_x = start_x;
        for tok in &line.tokens {
            if tok.is_newline {
                continue;
            }

            let font_opt = get_or_load_font(&tok.font_family, tok.is_bold, tok.is_italic);

            if !tok.is_space {
                if let Some(ref font) = font_opt {
                    let mut pen_x = token_x;
                    for ch in tok.text.chars() {
                        let (metrics, bitmap) = font.rasterize(ch, tok.font_size_px);
                        let glyph_top_y = (baseline - metrics.ymin as f32 - metrics.height as f32).round() as i32;
                        let glyph_left_x = (pen_x + metrics.xmin as f32).round() as i32;

                        for by in 0..metrics.height {
                            let dest_y = glyph_top_y + by as i32;
                            if dest_y < 0 || dest_y >= frame_px_h as i32 {
                                continue;
                            }
                            for bx in 0..metrics.width {
                                let dest_x = glyph_left_x + bx as i32;
                                if dest_x < 0 || dest_x >= frame_px_w as i32 {
                                    continue;
                                }

                                let coverage = bitmap[by * metrics.width + bx];
                                if coverage == 0 {
                                    continue;
                                }

                                let cov_a = (coverage as f32 / 255.0) * (tok.fill[3] as f32 / 255.0);
                                let dest_pixel = text_buffer.get_pixel_mut(dest_x as u32, dest_y as u32);
                                blend_pixel_over(dest_pixel, tok.fill[0], tok.fill[1], tok.fill[2], cov_a);
                            }
                        }

                        pen_x += metrics.advance_width;
                    }
                }

                // Text Decorations
                if tok.text_decoration == "underline" {
                    let bar_y = (baseline + 2.0).round() as i32;
                    let bar_h = (tok.font_size_px * 0.07).max(1.5).round() as i32;
                    draw_filled_rect(
                        &mut text_buffer,
                        token_x.round() as i32,
                        bar_y,
                        tok.width.round() as i32,
                        bar_h,
                        tok.fill,
                    );
                } else if tok.text_decoration == "line-through" {
                    let bar_y = (baseline - tok.ascent * 0.35).round() as i32;
                    let bar_h = (tok.font_size_px * 0.07).max(1.5).round() as i32;
                    draw_filled_rect(
                        &mut text_buffer,
                        token_x.round() as i32,
                        bar_y,
                        tok.width.round() as i32,
                        bar_h,
                        tok.fill,
                    );
                }
            }

            token_x += tok.width;
        }

        current_top += line.max_line_height;
    }

    // 5. Composite text buffer onto high-res canvas (handling rotation if non-zero)
    let rotation_deg = elem.rotation % 360.0;
    if rotation_deg.abs() < 0.01 {
        // Direct blit
        for ty in 0..frame_px_h {
            let dest_y = frame_px_y + ty as i64;
            if dest_y < 0 || dest_y >= canvas_h {
                continue;
            }
            for tx in 0..frame_px_w {
                let dest_x = frame_px_x + tx as i64;
                if dest_x < 0 || dest_x >= canvas_w {
                    continue;
                }

                let p = text_buffer.get_pixel(tx, ty);
                if p[3] == 0 {
                    continue;
                }

                let src_a = (p[3] as f32 / 255.0 * elem.opacity as f32).clamp(0.0, 1.0);
                let canvas_pixel = canvas.get_pixel_mut(dest_x as u32, dest_y as u32);
                blend_pixel_over(canvas_pixel, p[0], p[1], p[2], src_a);
            }
        }
    } else {
        // Rotated blit around top-left origin (matching Konva coordinate model)
        let rad = (-rotation_deg).to_radians();
        let cos_r = rad.cos();
        let sin_r = rad.sin();

        // Corners in local space: (0,0), (w, 0), (0, h), (w, h)
        let w_f = frame_px_w as f64;
        let h_f = frame_px_h as f64;
        let rot_rad = rotation_deg.to_radians();
        let cos_f = rot_rad.cos();
        let sin_f = rot_rad.sin();

        let corners = [
            (0.0, 0.0),
            (w_f * cos_f, w_f * sin_f),
            (-h_f * sin_f, h_f * cos_f),
            (w_f * cos_f - h_f * sin_f, w_f * sin_f + h_f * cos_f),
        ];

        let min_x = corners.iter().map(|c| c.0).fold(f64::INFINITY, f64::min).floor() as i64;
        let max_x = corners.iter().map(|c| c.0).fold(f64::NEG_INFINITY, f64::max).ceil() as i64;
        let min_y = corners.iter().map(|c| c.1).fold(f64::INFINITY, f64::min).floor() as i64;
        let max_y = corners.iter().map(|c| c.1).fold(f64::NEG_INFINITY, f64::max).ceil() as i64;

        for cy in min_y..=max_y {
            let dest_y = frame_px_y + cy;
            if dest_y < 0 || dest_y >= canvas_h {
                continue;
            }
            for cx in min_x..=max_x {
                let dest_x = frame_px_x + cx;
                if dest_x < 0 || dest_x >= canvas_w {
                    continue;
                }

                // Inverse rotation
                let dx = cx as f64;
                let dy = cy as f64;
                let tx = (dx * cos_r - dy * sin_r).round() as i64;
                let ty = (dx * sin_r + dy * cos_r).round() as i64;

                if tx >= 0 && tx < frame_px_w as i64 && ty >= 0 && ty < frame_px_h as i64 {
                    let p = text_buffer.get_pixel(tx as u32, ty as u32);
                    if p[3] == 0 {
                        continue;
                    }
                    let src_a = (p[3] as f32 / 255.0 * elem.opacity as f32).clamp(0.0, 1.0);
                    let canvas_pixel = canvas.get_pixel_mut(dest_x as u32, dest_y as u32);
                    blend_pixel_over(canvas_pixel, p[0], p[1], p[2], src_a);
                }
            }
        }
    }
}

/// Helper: Measure width of string using fontdue
fn measure_text_width(text: &str, font: Option<&Font>, font_size_px: f32) -> f32 {
    if let Some(font) = font {
        let mut w = 0.0;
        for ch in text.chars() {
            let (metrics, _) = font.rasterize(ch, font_size_px);
            w += metrics.advance_width;
        }
        w
    } else {
        text.len() as f32 * (font_size_px * 0.55)
    }
}

/// Helper: Get font line ascent & descent
fn get_font_metrics(font: Option<&Font>, font_size_px: f32) -> (f32, f32) {
    if let Some(font) = font {
        if let Some(lm) = font.horizontal_line_metrics(font_size_px) {
            (lm.ascent, lm.descent.abs())
        } else {
            (font_size_px * 0.8, font_size_px * 0.2)
        }
    } else {
        (font_size_px * 0.8, font_size_px * 0.2)
    }
}

/// Draw a solid filled rectangle with alpha blending
fn draw_filled_rect(buffer: &mut RgbaImage, x: i32, y: i32, w: i32, h: i32, color: Rgba<u8>) {
    let buf_w = buffer.width() as i32;
    let buf_h = buffer.height() as i32;

    let x1 = x.clamp(0, buf_w);
    let y1 = y.clamp(0, buf_h);
    let x2 = (x + w).clamp(0, buf_w);
    let y2 = (y + h).clamp(0, buf_h);

    let src_a = color[3] as f32 / 255.0;
    for py in y1..y2 {
        for px in x1..x2 {
            let p = buffer.get_pixel_mut(px as u32, py as u32);
            blend_pixel_over(p, color[0], color[1], color[2], src_a);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_color() {
        assert_eq!(parse_color("#ffffff"), Rgba([255, 255, 255, 255]));
        assert_eq!(parse_color("#fff"), Rgba([255, 255, 255, 255]));
        assert_eq!(parse_color("#000000"), Rgba([0, 0, 0, 255]));
        assert_eq!(parse_color("#1e293b"), Rgba([30, 41, 59, 255]));
        assert_eq!(parse_color("rgba(255, 0, 0, 0.5)"), Rgba([255, 0, 0, 128]));
    }

    #[test]
    fn test_blend_pixel_over() {
        let mut dest = Rgba([255, 255, 255, 255]); // White background
        blend_pixel_over(&mut dest, 0, 0, 0, 1.0); // Opaque black
        assert_eq!(dest, Rgba([0, 0, 0, 255]));

        let mut dest = Rgba([255, 255, 255, 255]); // White background
        blend_pixel_over(&mut dest, 0, 0, 0, 0.5); // 50% black
        assert_eq!(dest[0], 128);
        assert_eq!(dest[1], 128);
        assert_eq!(dest[2], 128);
        assert_eq!(dest[3], 255);
    }

    #[test]
    fn test_ranges_to_text_runs() {
        let text = "Hello World";
        let base_style = TextStylePayload::default();
        let ranges = vec![StyledRangePayload {
            id: None,
            start: 6,
            end: 11,
            font_family: None,
            font_size: None,
            font_weight: Some("bold".to_string()),
            font_style: None,
            text_decoration: None,
            fill: Some("#ef4444".to_string()),
            highlight: None,
        }];

        let runs = ranges_to_text_runs(text, Some(&ranges), &base_style);
        assert_eq!(runs.len(), 2);
        assert_eq!(runs[0].text, "Hello ");
        assert_eq!(runs[0].font_weight.as_deref(), Some("normal"));
        assert_eq!(runs[1].text, "World");
        assert_eq!(runs[1].font_weight.as_deref(), Some("bold"));
        assert_eq!(runs[1].fill.as_deref(), Some("#ef4444"));
    }

    #[test]
    fn test_render_text_element_smoke() {
        let mut canvas = RgbaImage::from_pixel(600, 400, Rgba([255, 255, 255, 255]));
        let elem = ElementPayload {
            id: "test-text-1".to_string(),
            r#type: "text".to_string(),
            photo_id: None,
            file_path: String::new(),
            file_name: String::new(),
            preview_path: None,
            thumbnail_path: None,
            x: 20.0,
            y: 20.0,
            width: 100.0,
            height: 40.0,
            rotation: 0.0,
            z_index: 1,
            photo_aspect: 1.0,
            group_id: None,
            original_width: None,
            original_height: None,
            crop_x: 0.0,
            crop_y: 0.0,
            crop_scale: 1.0,
            crop_rotation: None,
            border_enabled: false,
            border_width: 0.0,
            border_color: "#000000".to_string(),
            opacity: 1.0,
            locked: None,
            text_payload: Some(
                serde_json::to_string(&TextElementPayload {
                    text: "Our Wedding Story".to_string(),
                    style: TextStylePayload {
                        font_family: "Inter".to_string(),
                        font_size: 24.0,
                        font_weight: "bold".to_string(),
                        font_style: "normal".to_string(),
                        text_decoration: "none".to_string(),
                        fill: "#0f172a".to_string(),
                        align: "center".to_string(),
                        vertical_align: "middle".to_string(),
                        line_height: 1.3,
                        letter_spacing: 0.0,
                        padding: 6.0,
                        word_wrap: "word".to_string(),
                    },
                    styled_ranges: None,
                    text_runs: None,
                })
                .unwrap(),
            ),
        };

        // Render at 300 DPI, scale = 1.0
        render_text_element(&mut canvas, &elem, 0.0, 0.0, 1.0, 300);

        // Verify canvas still has dimensions and did not crash
        assert_eq!(canvas.width(), 600);
        assert_eq!(canvas.height(), 400);
    }
}
