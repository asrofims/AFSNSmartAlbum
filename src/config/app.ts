export const APP_CONFIG = {
  name: 'AFSNSmartAlbum',
  description: 'Professional Photo Album Layout Software',
  projectExtension: '.afsn',
  website: '',
  license: 'Proprietary — All Rights Reserved',
  credits: [
    'Afsunmedia - Asrofims',
  ],
  acknowledgements: [
    { name: 'React', url: 'https://react.dev', license: 'MIT' },
    { name: 'Tauri', url: 'https://tauri.app', license: 'MIT/Apache-2.0' },
    { name: 'Vite', url: 'https://vitejs.dev', license: 'MIT' },
    { name: 'Konva.js', url: 'https://konvajs.org', license: 'MIT' },
    { name: 'Zustand', url: 'https://zustand-demo.pmnd.rs', license: 'MIT' },
    { name: 'SQLite', url: 'https://sqlite.org', license: 'Public Domain' },
    { name: 'libvips', url: 'https://libvips.github.io/libvips', license: 'LGPL-2.1' },
  ],
} as const;

export type Acknowledgement = typeof APP_CONFIG.acknowledgements[number];
