// The same licensed TrueType faces are embedded in the Rust exporter.
export const BUNDLED_FONT_FACES = [
  {
    "family": "Inter",
    "weight": 400,
    "style": "italic"
  },
  {
    "family": "Inter",
    "weight": 700,
    "style": "italic"
  },
  {
    "family": "Inter",
    "weight": 400,
    "style": "normal"
  },
  {
    "family": "Inter",
    "weight": 600,
    "style": "normal"
  },
  {
    "family": "Inter",
    "weight": 700,
    "style": "normal"
  },
  {
    "family": "Playfair Display",
    "weight": 400,
    "style": "italic"
  },
  {
    "family": "Playfair Display",
    "weight": 700,
    "style": "italic"
  },
  {
    "family": "Playfair Display",
    "weight": 400,
    "style": "normal"
  },
  {
    "family": "Playfair Display",
    "weight": 600,
    "style": "normal"
  },
  {
    "family": "Playfair Display",
    "weight": 700,
    "style": "normal"
  },
  {
    "family": "Montserrat",
    "weight": 400,
    "style": "italic"
  },
  {
    "family": "Montserrat",
    "weight": 700,
    "style": "italic"
  },
  {
    "family": "Montserrat",
    "weight": 400,
    "style": "normal"
  },
  {
    "family": "Montserrat",
    "weight": 600,
    "style": "normal"
  },
  {
    "family": "Montserrat",
    "weight": 700,
    "style": "normal"
  },
  {
    "family": "Cormorant Garamond",
    "weight": 400,
    "style": "italic"
  },
  {
    "family": "Cormorant Garamond",
    "weight": 700,
    "style": "italic"
  },
  {
    "family": "Cormorant Garamond",
    "weight": 400,
    "style": "normal"
  },
  {
    "family": "Cormorant Garamond",
    "weight": 600,
    "style": "normal"
  },
  {
    "family": "Cormorant Garamond",
    "weight": 700,
    "style": "normal"
  },
  {
    "family": "Cinzel",
    "weight": 400,
    "style": "normal"
  },
  {
    "family": "Cinzel",
    "weight": 600,
    "style": "normal"
  },
  {
    "family": "Cinzel",
    "weight": 700,
    "style": "normal"
  },
  {
    "family": "Great Vibes",
    "weight": 400,
    "style": "normal"
  }
] as const;

export async function loadAlbumFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(BUNDLED_FONT_FACES.map((face) => document.fonts.load(`${face.style} ${face.weight} 24px "${face.family}"`)));
}
