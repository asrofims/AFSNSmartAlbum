// Licensed font faces and attribution: public/fonts/*-OFL.txt.
pub fn bundled_font(family: &str, weight: u16, italic: bool) -> Option<&'static [u8]> {
    let faces: &[(u16, bool, &[u8])] = match family.to_lowercase().as_str() {
        "inter" => &[
            (400, true, include_bytes!("../../../public/fonts/inter-400-italic.ttf")),
            (700, true, include_bytes!("../../../public/fonts/inter-700-italic.ttf")),
            (400, false, include_bytes!("../../../public/fonts/inter-400-normal.ttf")),
            (600, false, include_bytes!("../../../public/fonts/inter-600-normal.ttf")),
            (700, false, include_bytes!("../../../public/fonts/inter-700-normal.ttf")),
        ],
        "playfair display" => &[
            (400, true, include_bytes!("../../../public/fonts/playfairdisplay-400-italic.ttf")),
            (700, true, include_bytes!("../../../public/fonts/playfairdisplay-700-italic.ttf")),
            (400, false, include_bytes!("../../../public/fonts/playfairdisplay-400-normal.ttf")),
            (600, false, include_bytes!("../../../public/fonts/playfairdisplay-600-normal.ttf")),
            (700, false, include_bytes!("../../../public/fonts/playfairdisplay-700-normal.ttf")),
        ],
        "montserrat" => &[
            (400, true, include_bytes!("../../../public/fonts/montserrat-400-italic.ttf")),
            (700, true, include_bytes!("../../../public/fonts/montserrat-700-italic.ttf")),
            (400, false, include_bytes!("../../../public/fonts/montserrat-400-normal.ttf")),
            (600, false, include_bytes!("../../../public/fonts/montserrat-600-normal.ttf")),
            (700, false, include_bytes!("../../../public/fonts/montserrat-700-normal.ttf")),
        ],
        "cormorant garamond" => &[
            (400, true, include_bytes!("../../../public/fonts/cormorantgaramond-400-italic.ttf")),
            (700, true, include_bytes!("../../../public/fonts/cormorantgaramond-700-italic.ttf")),
            (400, false, include_bytes!("../../../public/fonts/cormorantgaramond-400-normal.ttf")),
            (600, false, include_bytes!("../../../public/fonts/cormorantgaramond-600-normal.ttf")),
            (700, false, include_bytes!("../../../public/fonts/cormorantgaramond-700-normal.ttf")),
        ],
        "cinzel" => &[
            (400, false, include_bytes!("../../../public/fonts/cinzel-400-normal.ttf")),
            (600, false, include_bytes!("../../../public/fonts/cinzel-600-normal.ttf")),
            (700, false, include_bytes!("../../../public/fonts/cinzel-700-normal.ttf")),
        ],
        "great vibes" => &[
            (400, false, include_bytes!("../../../public/fonts/greatvibes-400-normal.ttf")),
        ],
        _ => return None,
    };
    let use_italic = italic && faces.iter().any(|(_, it, _)| *it);
    let target = if weight <= 500 { 400 } else { weight };
    faces.iter().filter(|(_, it, _)| *it == use_italic)
        .min_by_key(|(w, _, _)| w.abs_diff(target)).map(|(_, _, bytes)| *bytes)
}
