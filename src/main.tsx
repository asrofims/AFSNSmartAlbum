import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { loadAlbumFonts } from './domain/bundledFonts';

loadAlbumFonts().catch((error) => console.error('Could not load bundled album fonts', error)).finally(() => {
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

});
