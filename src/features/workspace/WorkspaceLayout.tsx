import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { useAppStore } from '../../stores/appStore';
import { useProjectStore } from '../../stores/projectStore';
import { useTauriInfo } from '../../hooks/useTauriInfo';
import { WelcomeScreen } from './WelcomeScreen';
import { formatDimensions } from '../../domain/units';
import { FilmstripTray } from '../photos/FilmstripTray';
import { RelinkDialog } from '../photos/RelinkDialog';
import styles from './WorkspaceLayout.module.css';

export function WorkspaceLayout() {
  const openAbout = useAppStore((s) => s.openAbout);

  const currentProject = useProjectStore((s) => s.currentProject);
  const openNewProject = useProjectStore((s) => s.openNewProject);
  const closeProject = useProjectStore((s) => s.closeProject);

  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Request 3: Collapsible Right Properties & Bottom Filmstrip
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [isFilmstripOpen, setIsFilmstripOpen] = useState(true);
  const [showGuides, setShowGuides] = useState(true);

  useTauriInfo();

  // Dimensions of the open album spread
  // Spread width = 2 * canvasWidth (Left Page + Right Page)
  const spreadW = currentProject ? currentProject.canvasWidth * 2 : 16;
  const spreadH = currentProject ? currentProject.canvasHeight : 8;

  // Viewport calculation for spread representation
  // Expand view area now that filmstrip is at the bottom and right panel is collapsible
  const maxW = isPropertiesOpen ? 820 : 1080;
  const maxH = isFilmstripOpen ? 460 : 580;
  const aspect = spreadW / spreadH;
  let viewW = maxW;
  let viewH = Math.round(maxW / aspect);
  if (viewH > maxH) {
    viewH = maxH;
    viewW = Math.round(maxH * aspect);
  }

  // Dynamic Safe Margin Calculation for canvas guide display
  const singlePageW = viewW / 2;
  const marginRatio = currentProject && currentProject.canvasWidth > 0
    ? (currentProject.marginValue || 10) / (currentProject.canvasWidth * (currentProject.canvasUnit === 'inch' ? 25.4 : currentProject.canvasUnit === 'cm' ? 10 : 1))
    : 0.05;
  const dynamicMarginPx = Math.max(6, Math.min(36, Math.round(singlePageW * marginRatio)));

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
              <button
                type="button"
                className={`${styles.toolButton} ${activeTool === 'select' ? styles.toolButtonActive : ''}`}
                onClick={() => setActiveTool('select')}
                title="Selection Tool (V)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
                  <path d="m13 13 6 6"/>
                </svg>
                Select
              </button>

              <button
                type="button"
                className={`${styles.toolButton} ${activeTool === 'pan' ? styles.toolButtonActive : ''}`}
                onClick={() => setActiveTool('pan')}
                title="Hand / Pan Tool (H)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
                  <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
                  <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
                  <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
                </svg>
                Pan
              </button>

              <div className={styles.toolbarSeparator} />

              {/* Safe Margin Guide Toggle */}
              <button
                type="button"
                className={`${styles.toolButton} ${showGuides ? styles.toolButtonActive : ''}`}
                onClick={() => setShowGuides((g) => !g)}
                title="Toggle Safe Margin Guides"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3"/>
                </svg>
                Guides
              </button>
            </>
          )}
        </div>

        {/* Right Section: View & Help Actions */}
        <div className={styles.toolbarSection}>
          {currentProject && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomLevel((z) => Math.max(25, z - 10))}
                title="Zoom Out"
              >
                −
              </Button>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', minWidth: '36px', textAlign: 'center' }}>
                {zoomLevel}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomLevel((z) => Math.min(200, z + 10))}
                title="Zoom In"
              >
                +
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomLevel(100)}
                title="Reset Zoom to 100%"
              >
                Fit
              </Button>

              <div className={styles.toolbarSeparator} />

              {/* Properties Panel Toggle (Request 3) */}
              <button
                type="button"
                className={`${styles.toolButton} ${isPropertiesOpen ? styles.toolButtonActive : ''}`}
                onClick={() => setIsPropertiesOpen((o) => !o)}
                title="Toggle Properties Panel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="3" rx="2"/>
                  <path d="M15 3v18"/>
                </svg>
                Properties
              </button>

              <div className={styles.toolbarSeparator} />
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

      {/* Center Canvas Area (Expanded, maximized workspace) */}
      <main className={styles.canvas}>
        {!currentProject ? (
          <WelcomeScreen />
        ) : (
          <div className={styles.spreadViewport}>
            {/* Album Spread Sheet */}
            <div
              className={styles.spreadContainer}
              style={{
                width: `${viewW}px`,
                height: `${viewH}px`,
                backgroundColor: currentProject.backgroundColor,
                transform: `scale(${zoomLevel / 100})`,
              }}
            >
              {/* Left Page */}
              <div className={styles.leftPage}>
                {showGuides && (currentProject.marginEnabled !== false) && (
                  <div
                    className={styles.pageGuide}
                    style={{ inset: `${dynamicMarginPx}px` }}
                    title={`Safe Margin: ${currentProject.marginValue || 10} ${currentProject.marginUnit || 'mm'}`}
                  />
                )}
              </div>

              {/* Center Gutter / Spine Fold Line */}
              <div className={styles.centerGutterLine} title="Center Fold / Spine" />

              {/* Right Page */}
              <div className={styles.rightPage}>
                {showGuides && (currentProject.marginEnabled !== false) && (
                  <div
                    className={styles.pageGuide}
                    style={{ inset: `${dynamicMarginPx}px` }}
                    title={`Safe Margin: ${currentProject.marginValue || 10} ${currentProject.marginUnit || 'mm'}`}
                  />
                )}
              </div>
            </div>

            {/* Spread Navigation Bar */}
            <div className={styles.spreadNavBar}>
              <Button variant="ghost" size="sm" disabled title="Previous spread">
                ◀ Prev
              </Button>
              <span className={styles.spreadNavText}>
                Spread 1 of 1
              </span>
              <Button variant="ghost" size="sm" disabled title="Next spread">
                Next ▶
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Right Panel: Collapsible Properties */}
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
              PROPERTIES
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

              {/* Safe Margin (Request 5) */}
              <div className={styles.propSection}>
                <div className={styles.propTitle}>Safe Margin (Batas Aman)</div>
                <div className={styles.propRow}>
                  <span>Margin Tepi</span>
                  <span className={styles.propValue}>
                    {currentProject.marginEnabled !== false
                      ? `${currentProject.marginValue || 10} ${currentProject.marginUnit || 'mm'}`
                      : 'Disabled'}
                  </span>
                </div>
                <div className={styles.propRow}>
                  <span>Guide Lines</span>
                  <span className={styles.propValue}>
                    {showGuides ? 'Visible' : 'Hidden'}
                  </span>
                </div>
              </div>

              {/* Photo Spacing & Border (Request 4: default disabled) */}
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

              {/* Background */}
              <div className={styles.propSection}>
                <div className={styles.propTitle}>Spread Background</div>
                <div className={styles.propRow}>
                  <span>Type</span>
                  <span className={styles.propValue}>{currentProject.backgroundType}</span>
                </div>
                <div className={styles.propRow}>
                  <span>Color</span>
                  <span className={styles.propValue}>
                    {currentProject.backgroundColor}
                    <span
                      className={styles.colorSwatchSmall}
                      style={{ backgroundColor: currentProject.backgroundColor }}
                    />
                  </span>
                </div>
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
