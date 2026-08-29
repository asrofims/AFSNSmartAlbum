import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { NumberInput } from '../../components/ui/NumberInput';
import { Switch } from '../../components/ui/Switch';
import { useAppStore } from '../../stores/appStore';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { useTauriInfo } from '../../hooks/useTauriInfo';
import { WelcomeScreen } from './WelcomeScreen';
import { formatDimensions, convertUnit, Unit } from '../../domain/units';
import { getAllAlbumSpreads } from '../../domain/album';
import { clampCropTransform, zoomCropAtPoint, PhotoFrameElement } from '../../domain/editor';
import { FilmstripTray } from '../photos/FilmstripTray';
import { RelinkDialog } from '../photos/RelinkDialog';
import { KonvaEditorCanvas } from '../editor/KonvaEditorCanvas';
import { FrameToolbar } from '../editor/FrameToolbar';
import { PageNavigator } from '../album/PageNavigator';
import styles from './WorkspaceLayout.module.css';

export function WorkspaceLayout() {
  const openAbout = useAppStore((s) => s.openAbout);

  const currentProject = useProjectStore((s) => s.currentProject);
  const openNewProject = useProjectStore((s) => s.openNewProject);
  const closeProject = useProjectStore((s) => s.closeProject);
  const updateProjectSpacing = useProjectStore((s) => s.updateProjectSpacing);

  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const showGutterGuide = useAlbumStore((s) => s.showGutterGuide);
  const showBleedGuide = useAlbumStore((s) => s.showBleedGuide);
  const showSafeAreaGuide = useAlbumStore((s) => s.showSafeAreaGuide);
  const toggleGuide = useAlbumStore((s) => s.toggleGuide);
  const updateGutterWidth = useAlbumStore((s) => s.updateGutterWidth);
  const updateBleed = useAlbumStore((s) => s.updateBleed);
  const updateSafeArea = useAlbumStore((s) => s.updateSafeArea);

  const selectedFrameIds = useEditorStore((s) => s.selectedFrameIds);
  const updateFrameGeometry = useEditorStore((s) => s.updateFrameGeometry);
  const updateCrop = useEditorStore((s) => s.updateCrop);
  const resetToOriginalRatio = useEditorStore((s) => s.resetToOriginalRatio);
  const resetCrop = useEditorStore((s) => s.resetCrop);
  const editingCropFrameId = useEditorStore((s) => s.editingCropFrameId);
  const enterCropMode = useEditorStore((s) => s.enterCropMode);
  const exitCropMode = useEditorStore((s) => s.exitCropMode);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const alignSelectedFrames = useEditorStore((s) => s.alignSelectedFrames);
  const distributeSelectedFrames = useEditorStore((s) => s.distributeSelectedFrames);
  const applyFixedGapToSelected = useEditorStore((s) => s.applyFixedGapToSelected);
  const matchSelectedDimensions = useEditorStore((s) => s.matchSelectedDimensions);

  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isRatioLocked, setIsRatioLocked] = useState<boolean>(true);
  const [customGapValue, setCustomGapValue] = useState<number>(currentProject?.spacingValue ?? 5);

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

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

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

      {/* Center Editor Area (contains Canvas + Bottom Full-Width PageNavigator) */}
      <div className={styles.centerArea}>
        <main className={styles.canvas}>
          {!currentProject ? (
            <WelcomeScreen />
          ) : (
            <>
              <KonvaEditorCanvas
                zoomLevel={zoomLevel}
                activeTool={activeTool}
                onZoomChange={setZoomLevel}
              />
              <FrameToolbar />
            </>
          )}
        </main>

        {/* Page & Spread Navigation Bar spanning full width of the editor */}
        {currentProject && <PageNavigator />}
      </div>

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
              {/* Selected Photo Frame Properties / Multi-Selection Controls (Placed at TOP when active) */}
              {(() => {
                const paletteColors = ['#FFFFFF', '#000000', '#F8FAFC', '#94A3B8', '#F59E0B', '#EF4444', '#3B82F6', '#10B981'];
                if (!activeSpread || selectedFrameIds.length === 0) return null;

                // MULTI-SELECTION MODE (>= 2 frames selected)
                if (selectedFrameIds.length >= 2) {
                  return (
                    <div
                      className={styles.propSection}
                      style={{
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        borderRadius: 'var(--radius-md)',
                        padding: '10px',
                        backgroundColor: 'rgba(59, 130, 246, 0.04)',
                      }}
                    >
                      <div className={styles.propTitle} style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span>Multi-Selection ({selectedFrameIds.length} Frames)</span>
                      </div>

                      {/* GAP Spacing Control */}
                      <div style={{ marginBottom: '10px', padding: '8px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                          Gap Spacing
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <NumberInput
                              value={customGapValue}
                              onChange={(val) => setCustomGapValue(Math.max(0, val))}
                              min={0}
                              max={200}
                              step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 1}
                            />
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentProject.canvasUnit}</span>
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <button
                            type="button"
                            className={styles.multiActionBtn}
                            onClick={() => applyFixedGapToSelected(activeSpread.id, 'horizontal', customGapValue)}
                            title="Set uniform horizontal gap spacing"
                          >
                            ⇿ Set Gap H
                          </button>
                          <button
                            type="button"
                            className={styles.multiActionBtn}
                            onClick={() => applyFixedGapToSelected(activeSpread.id, 'vertical', customGapValue)}
                            title="Set uniform vertical gap spacing"
                          >
                            ⇳ Set Gap V
                          </button>
                        </div>
                      </div>

                      {/* Distribute Evenly */}
                      {selectedFrameIds.length >= 3 && (
                        <div style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                            Distribute Spacing
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <button
                              type="button"
                              className={styles.multiActionBtn}
                              onClick={() => distributeSelectedFrames(activeSpread.id, 'horizontal')}
                              title="Distribute Horizontal Spacing Evenly"
                            >
                              ⇿ Distribute H
                            </button>
                            <button
                              type="button"
                              className={styles.multiActionBtn}
                              onClick={() => distributeSelectedFrames(activeSpread.id, 'vertical')}
                              title="Distribute Vertical Spacing Evenly"
                            >
                              ⇳ Distribute V
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Alignments Grid */}
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                          Alignment
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'left')} title="Align Left">⇤ Left</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'center')} title="Align Center Horizontal">⇥⇤ Center H</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'right')} title="Align Right">⇥ Right</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'top')} title="Align Top">⤒ Top</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'middle')} title="Align Middle Vertical">⤓⤒ Center V</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'bottom')} title="Align Bottom">⤓ Bottom</button>
                        </div>
                      </div>

                      {/* Match Size */}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                          Match Size
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                          <button type="button" className={styles.multiActionBtn} onClick={() => matchSelectedDimensions(activeSpread.id, 'width')} title="Match Width">⬌ Width</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => matchSelectedDimensions(activeSpread.id, 'height')} title="Match Height">⬍ Height</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => matchSelectedDimensions(activeSpread.id, 'both')} title="Match Both">⬚ Both</button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // SINGLE FRAME SELECTION MODE
                const selectedFrame = (activeSpread?.elements || []).find((f) => f.id === selectedFrameIds[0]);
                if (!selectedFrame) return null;
                const isEditingCrop = editingCropFrameId === selectedFrame.id;
                const cropTransform = clampCropTransform(selectedFrame);

                return (
                  <div
                    className={styles.propSection}
                    style={{
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px',
                      backgroundColor: 'rgba(59, 130, 246, 0.04)',
                    }}
                  >
                    <div className={styles.propTitle} style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span>Selected Photo Frame</span>
                    </div>

                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: isEditingCrop ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
                        Photo Crop
                      </span>
                      <button
                        type="button"
                        onClick={() => (isEditingCrop ? exitCropMode() : enterCropMode(selectedFrame.id))}
                        style={{
                          padding: '4px 8px',
                          fontSize: '10px',
                          fontWeight: 700,
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isEditingCrop ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                          border: isEditingCrop ? '1px solid rgba(245, 158, 11, 0.55)' : '1px solid var(--color-border)',
                          color: isEditingCrop ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                        }}
                        title={isEditingCrop ? 'Finish crop mode' : 'Edit photo crop'}
                      >
                        {isEditingCrop ? 'Done' : 'Edit'}
                      </button>
                    </div>

                    {isEditingCrop && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.28)', backgroundColor: 'rgba(245, 158, 11, 0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          <span>Zoom</span>
                          <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{Math.round(cropTransform.cropScale * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={3.5}
                          step={0.05}
                          value={cropTransform.cropScale}
                          onChange={(e) =>
                            updateCrop(
                              activeSpread.id,
                              selectedFrame.id,
                              zoomCropAtPoint(
                                selectedFrame,
                                { x: selectedFrame.width / 2, y: selectedFrame.height / 2 },
                                Number(e.target.value)
                              )
                            )
                          }
                          style={{ width: '100%', accentColor: 'var(--color-warning)' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => resetCrop(activeSpread.id, selectedFrame.id)}
                            style={{
                              padding: '4px 6px',
                              fontSize: '10px',
                              fontWeight: 600,
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={exitCropMode}
                            style={{
                              padding: '4px 6px',
                              fontSize: '10px',
                              fontWeight: 700,
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(245, 158, 11, 0.18)',
                              border: '1px solid rgba(245, 158, 11, 0.55)',
                              color: 'var(--color-warning)',
                              cursor: 'pointer',
                            }}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Frame Border Switch */}
                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Frame Border</span>
                      <Switch
                        checked={selectedFrame.borderEnabled}
                        onChange={(chk) => updateFrameGeometry(activeSpread.id, selectedFrame.id, { borderEnabled: chk })}
                        size="sm"
                      />
                    </div>

                    {selectedFrame.borderEnabled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '2px', marginBottom: '8px' }}>
                        {/* Border Width */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Border Width</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100px' }}>
                            <NumberInput
                              value={selectedFrame.borderWidth || 1}
                              onChange={(val) => updateFrameGeometry(activeSpread.id, selectedFrame.id, { borderWidth: val })}
                              min={0.1}
                              max={50}
                              step={0.5}
                            />
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>mm</span>
                          </div>
                        </div>

                        {/* Border Color */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Border Color</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="color"
                                value={selectedFrame.borderColor || '#FFFFFF'}
                                onChange={(e) => updateFrameGeometry(activeSpread.id, selectedFrame.id, { borderColor: e.target.value })}
                                style={{ width: '22px', height: '22px', padding: 0, border: 'none', borderRadius: '3px', cursor: 'pointer', backgroundColor: 'transparent' }}
                              />
                              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                                {selectedFrame.borderColor || '#FFFFFF'}
                              </span>
                            </div>
                          </div>

                          {/* Quick Palette */}
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            {paletteColors.map((color) => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => updateFrameGeometry(activeSpread.id, selectedFrame.id, { borderColor: color })}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '3px',
                                  backgroundColor: color,
                                  border: (selectedFrame.borderColor || '#FFFFFF').toUpperCase() === color.toUpperCase() ? '2px solid var(--color-accent)' : '1px solid rgba(255,255,255,0.2)',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Interactive Frame Dimensions & Position Inspector */}
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Dimensions & Transform</span>
                        <button
                          type="button"
                          onClick={() => setIsRatioLocked(!isRatioLocked)}
                          className={styles.ratioLockButton}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isRatioLocked ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                            border: isRatioLocked ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid var(--color-border)',
                            color: isRatioLocked ? 'var(--color-accent)' : 'var(--color-text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title={isRatioLocked ? 'Lock Aspect Ratio (Active)' : 'Unlock Aspect Ratio (Free)'}
                        >
                          <span>{isRatioLocked ? '🔗 Locked' : '🔓 Unlocked'}</span>
                        </button>
                      </div>

                      {/* W & H Inputs in 2 columns */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Width (W)</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <NumberInput
                              value={selectedFrame.width}
                              onChange={(newW) => {
                                if (newW <= 0) return;
                                const updates: Partial<PhotoFrameElement> = { width: newW };
                                if (isRatioLocked && selectedFrame.width > 0 && selectedFrame.height > 0) {
                                  const ratio = selectedFrame.width / selectedFrame.height;
                                  updates.height = Number((newW / ratio).toFixed(1));
                                }
                                updateFrameGeometry(activeSpread.id, selectedFrame.id, updates);
                              }}
                              min={0.1}
                              max={2000}
                              step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 1}
                            />
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentProject.canvasUnit}</span>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Height (H)</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <NumberInput
                              value={selectedFrame.height}
                              onChange={(newH) => {
                                if (newH <= 0) return;
                                const updates: Partial<PhotoFrameElement> = { height: newH };
                                if (isRatioLocked && selectedFrame.width > 0 && selectedFrame.height > 0) {
                                  const ratio = selectedFrame.width / selectedFrame.height;
                                  updates.width = Number((newH * ratio).toFixed(1));
                                }
                                updateFrameGeometry(activeSpread.id, selectedFrame.id, updates);
                              }}
                              min={0.1}
                              max={2000}
                              step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 1}
                            />
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentProject.canvasUnit}</span>
                          </div>
                        </div>
                      </div>

                      {/* X & Y Position Inputs in 2 columns */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Position X</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <NumberInput
                              value={selectedFrame.x}
                              onChange={(newX) => updateFrameGeometry(activeSpread.id, selectedFrame.id, { x: newX })}
                              step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 1}
                            />
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentProject.canvasUnit}</span>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Position Y</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <NumberInput
                              value={selectedFrame.y}
                              onChange={(newY) => updateFrameGeometry(activeSpread.id, selectedFrame.id, { y: newY })}
                              step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 1}
                            />
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentProject.canvasUnit}</span>
                          </div>
                        </div>
                      </div>

                      {/* Rotation Input & Quick Reset */}
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Rotation Angle</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <NumberInput
                              value={selectedFrame.rotation || 0}
                              onChange={(newRot) => updateFrameGeometry(activeSpread.id, selectedFrame.id, { rotation: ((newRot % 360) + 360) % 360 })}
                              min={-360}
                              max={360}
                              step={1}
                            />
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>°</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateFrameGeometry(activeSpread.id, selectedFrame.id, { rotation: 0 })}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '24px',
                            }}
                            title="Reset rotation to 0°"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <path d="M3 3v5h5" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* 1-Click Dual Entity Reset Actions */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <button
                          type="button"
                          onClick={() => resetToOriginalRatio(activeSpread.id, selectedFrame.id)}
                          style={{
                            flex: 1,
                            padding: '4px 6px',
                            fontSize: '10px',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                          }}
                          title="Restore original photo aspect ratio (3:2 / 4:3)"
                        >
                          ↺ Reset Ratio
                        </button>
                        <button
                          type="button"
                          onClick={() => resetCrop(activeSpread.id, selectedFrame.id)}
                          style={{
                            flex: 1,
                            padding: '4px 6px',
                            fontSize: '10px',
                            fontWeight: 600,
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                          }}
                          title="Center photo and reset zoom to 1.0x"
                        >
                          ↺ Reset Crop
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

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

              {/* Photo Spacing & Default Gap Section (Interactive rule for Project Spacing) */}
              <div className={styles.propSection}>
                <div className={styles.propTitle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Photo Spacing</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Default Gap</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '120px' }}>
                      <NumberInput
                        value={currentProject.spacingValue}
                        onChange={(val) => {
                          const num = Math.max(0, val);
                          updateProjectSpacing(num, currentProject.spacingUnit);
                          setCustomGapValue(num);
                        }}
                        min={0}
                        max={100}
                        step={currentProject.spacingUnit === 'inch' ? 0.05 : currentProject.spacingUnit === 'cm' ? 0.1 : 0.5}
                      />
                      <select
                        value={currentProject.spacingUnit}
                        onChange={(e) => {
                          const newUnit = e.target.value as Unit;
                          updateProjectSpacing(currentProject.spacingValue, newUnit);
                        }}
                        style={{
                          fontSize: '10px',
                          backgroundColor: 'var(--color-bg-secondary)',
                          color: 'var(--color-text-primary)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '2px 4px',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                        <option value="inch">in</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Action to apply project spacing to currently selected frames */}
                  {selectedFrameIds.length >= 2 && activeSpread && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                      <button
                        type="button"
                        className={styles.toolBtn}
                        style={{ flex: 1, fontSize: '10px', padding: '4px 6px', justifyContent: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-accent)' }}
                        onClick={() => {
                          const gapInMm = convertUnit(currentProject.spacingValue, currentProject.spacingUnit, 'mm');
                          applyFixedGapToSelected(activeSpread.id, 'horizontal', gapInMm);
                        }}
                        title={`Apply default gap (${currentProject.spacingValue} ${currentProject.spacingUnit}) horizontally`}
                      >
                        ⇿ Apply Gap H
                      </button>
                      <button
                        type="button"
                        className={styles.toolBtn}
                        style={{ flex: 1, fontSize: '10px', padding: '4px 6px', justifyContent: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-accent)' }}
                        onClick={() => {
                          const gapInMm = convertUnit(currentProject.spacingValue, currentProject.spacingUnit, 'mm');
                          applyFixedGapToSelected(activeSpread.id, 'vertical', gapInMm);
                        }}
                        title={`Apply default gap (${currentProject.spacingValue} ${currentProject.spacingUnit}) vertically`}
                      >
                        ⇳ Apply Gap V
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Safe Margins & Guides Section */}
              <div className={styles.propSection}>
                <div className={styles.propTitle}>Margins & Guides</div>

                {/* Guide Toggles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showSafeAreaGuide}
                      onChange={() => toggleGuide('safeArea')}
                      style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                    />
                    <span>Safe Zone Margin (Blue)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showBleedGuide}
                      onChange={() => toggleGuide('bleed')}
                      style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                    />
                    <span>Bleed Cut Line (Red)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showGutterGuide}
                      onChange={() => toggleGuide('gutter')}
                      style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                    />
                    <span>Center Gutter Crease</span>
                  </label>
                </div>

                {/* Safe Margins & Spine Inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Safe Zone Margin</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '110px' }}>
                      <NumberInput
                        value={activeSpread?.safeArea ?? (currentProject.marginValue || 10)}
                        onChange={(val) => updateSafeArea(val)}
                        min={0.1}
                        max={50}
                        step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                      />
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentProject.canvasUnit}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Bleed Allowance</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '110px' }}>
                      <NumberInput
                        value={activeSpread?.bleed ?? 3}
                        onChange={(val) => updateBleed(val)}
                        min={0}
                        max={20}
                        step={currentProject.canvasUnit === 'inch' ? 0.025 : currentProject.canvasUnit === 'cm' ? 0.05 : 0.5}
                      />
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentProject.canvasUnit}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {activeSpread?.type === 'cover' ? 'Spine Width' : 'Gutter Width'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '110px' }}>
                      <NumberInput
                        value={activeSpread?.gutterWidth ?? 0}
                        onChange={(val) => updateGutterWidth(val)}
                        min={0}
                        max={50}
                        step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 1}
                      />
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentProject.canvasUnit}</span>
                    </div>
                  </div>
                </div>

                {/* Smart Snapping Switch */}
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Smart Magnetic Snapping</span>
                  <Switch checked={snapEnabled} onChange={toggleSnap} size="sm" />
                </div>
              </div>

              {/* Project Default Border */}
              <div className={styles.propSection}>
                <div className={styles.propTitle}>Project Default Border</div>
                <div className={styles.propRow}>
                  <span>Default Border</span>
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
