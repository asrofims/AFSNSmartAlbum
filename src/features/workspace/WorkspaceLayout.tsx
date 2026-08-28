import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { useAppStore } from '../../stores/appStore';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useTauriInfo } from '../../hooks/useTauriInfo';
import { WelcomeScreen } from './WelcomeScreen';
import { formatDimensions } from '../../domain/units';
import { FilmstripTray } from '../photos/FilmstripTray';
import { RelinkDialog } from '../photos/RelinkDialog';
import { SpreadCanvas } from '../album/SpreadCanvas';
import { PageNavigator } from '../album/PageNavigator';
import styles from './WorkspaceLayout.module.css';

export function WorkspaceLayout() {
  const openAbout = useAppStore((s) => s.openAbout);

  const currentProject = useProjectStore((s) => s.currentProject);
  const openNewProject = useProjectStore((s) => s.openNewProject);
  const closeProject = useProjectStore((s) => s.closeProject);

  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Collapsible Right Properties & Bottom Filmstrip
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [isFilmstripOpen, setIsFilmstripOpen] = useState(true);

  useTauriInfo();

  // Initialize album structure on project load
  useEffect(() => {
    if (currentProject) {
      const album = useAlbumStore.getState().currentAlbum;
      if (!album || album.projectId !== currentProject.id) {
        useAlbumStore.getState().initializeAlbum(currentProject);
      }
    }
  }, [currentProject]);

  const spreadW = currentProject ? currentProject.canvasWidth * 2 : 16;
  const spreadH = currentProject ? currentProject.canvasHeight : 8;

  return (
    <div className={styles.workspace}>
      {/* Top Main Toolbar */}
      <header className={styles.toolbar} data-tauri-drag-region>
        {/* Left Section: Brand & File Actions */}
        <div className={styles.toolbarSection}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
            </span>
            <span>AFSNSmartAlbum</span>
          </div>

          <div className={styles.toolbarSeparator} />

          <Button
            variant="secondary"
            size="sm"
            onClick={openNewProject}
            title="Create a new album project"
          >
            + New Project
          </Button>

          {currentProject && (
            <div className={styles.activeProjectBadge} title={currentProject.name}>
              <span className={styles.projectNameText}>{currentProject.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeProject}
                title="Close active project"
                style={{ padding: '0 4px', height: '20px' }}
              >
                ✕
              </Button>
            </div>
          )}

          {currentProject && (
            <>
              <div className={styles.toolbarSeparator} />

              {/* Editor Tool Switcher */}
              <div className={styles.toolGroup}>
                <button
                  type="button"
                  className={`${styles.toolButton} ${activeTool === 'select' ? styles.toolActive : ''}`}
                  onClick={() => setActiveTool('select')}
                  title="Selection Tool (V)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m3 3 7 18 3-7 7-3L3 3z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  className={`${styles.toolButton} ${activeTool === 'pan' ? styles.toolActive : ''}`}
                  onClick={() => setActiveTool('pan')}
                  title="Pan Tool (H)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
                  </svg>
                </button>
              </div>

              <div className={styles.toolbarSeparator} />

              {/* Zoom Controls */}
              <div className={styles.zoomControls}>
                <button
                  type="button"
                  className={styles.toolButton}
                  onClick={() => setZoomLevel((z) => Math.max(25, z - 15))}
                  title="Zoom Out"
                >
                  -
                </button>
                <span className={styles.zoomLevelText}>{zoomLevel}%</span>
                <button
                  type="button"
                  className={styles.toolButton}
                  onClick={() => setZoomLevel((z) => Math.min(250, z + 15))}
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  className={styles.toolButton}
                  onClick={() => setZoomLevel(100)}
                  title="Fit to Screen / Reset Zoom"
                  style={{ fontSize: '10px', padding: '0 6px' }}
                >
                  Fit
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Section: View Toggles & About */}
        <div className={styles.toolbarSection}>
          {currentProject && (
            <>
              {/* Properties Panel Toggle Button */}
              <Button
                variant={isPropertiesOpen ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setIsPropertiesOpen((v) => !v)}
                title={isPropertiesOpen ? 'Hide Properties Panel' : 'Show Properties Panel'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="3" rx="2"/>
                  <path d="M15 3v18"/>
                </svg>
                <span>Properties</span>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={openAbout}
            title="About AFSNSmartAlbum"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
            About
          </Button>
        </div>
      </header>

      {/* Center Canvas Area (Spread Visualizer) */}
      <main className={styles.canvas}>
        {!currentProject ? (
          <WelcomeScreen />
        ) : (
          <SpreadCanvas zoomLevel={zoomLevel} activeTool={activeTool} />
        )}
      </main>

      {/* Page & Spread Navigation Bar */}
      {currentProject && <PageNavigator />}

      {/* Right Panel: Collapsible Properties & Album Structure */}
      {isPropertiesOpen && (
        <aside className={styles.rightPanel}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.05em' }}>
              PROJECT PROPERTIES
            </span>
            <button
              type="button"
              onClick={() => setIsPropertiesOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px 4px',
              }}
              title="Collapse Properties Panel"
            >
              ▶
            </button>
          </div>

          {!currentProject ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
              No project open
            </div>
          ) : (
            <div className={styles.propertyList}>
              {/* Project Overview */}
              <div className={styles.propSection}>
                <div className={styles.propTitle}>Album Project</div>
                <div className={styles.propRow}>
                  <span>Name</span>
                  <span className={styles.propValue}>{currentProject.name}</span>
                </div>
                <div className={styles.propRow}>
                  <span>Created</span>
                  <span className={styles.propValue}>
                    {new Date(currentProject.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Dimensions */}
              <div className={styles.propSection}>
                <div className={styles.propTitle}>Dimensions</div>
                <div className={styles.propRow}>
                  <span>Single Page</span>
                  <span className={styles.propValue}>
                    {formatDimensions(currentProject.canvasWidth, currentProject.canvasHeight, currentProject.canvasUnit)}
                  </span>
                </div>
                <div className={styles.propRow}>
                  <span>Open Spread</span>
                  <span className={styles.propValue}>
                    {formatDimensions(spreadW, spreadH, currentProject.canvasUnit)}
                  </span>
                </div>
                <div className={styles.propRow}>
                  <span>Resolution</span>
                  <span className={styles.propValue}>{currentProject.canvasDpi} DPI</span>
                </div>
              </div>

              {/* Photo Spacing & Border */}
              <div className={styles.propSection}>
                <div className={styles.propTitle}>Photo Styling</div>
                <div className={styles.propRow}>
                  <span>Photo Spacing</span>
                  <span className={styles.propValue}>
                    {currentProject.spacingValue} {currentProject.spacingUnit}
                  </span>
                </div>
                <div className={styles.propRow}>
                  <span>Photo Border</span>
                  <span className={styles.propValue}>
                    {currentProject.borderEnabled
                      ? `${currentProject.borderWidth} ${currentProject.borderUnit}`
                      : 'Disabled'}
                  </span>
                </div>
                {currentProject.borderEnabled && (
                  <div className={styles.propRow}>
                    <span>Border Color</span>
                    <span className={styles.propValue}>
                      {currentProject.borderColor}
                      <span
                        className={styles.colorSwatchSmall}
                        style={{ backgroundColor: currentProject.borderColor }}
                      />
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Bottom Photo Library Filmstrip */}
      {currentProject && (
        <FilmstripTray
          isOpen={isFilmstripOpen}
          onToggle={() => setIsFilmstripOpen((v) => !v)}
        />
      )}

      {/* Relink Missing Photos Dialog */}
      <RelinkDialog />
    </div>
  );
}
