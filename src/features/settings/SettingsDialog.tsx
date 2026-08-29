import { Dialog } from '../../components/ui/Dialog';
import { Switch } from '../../components/ui/Switch';
import { NumberInput } from '../../components/ui/NumberInput';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import styles from './SettingsDialog.module.css';

export function SettingsDialog() {
  const isOpen = useAppStore((s) => s.isSettingsOpen);
  const closeSettings = useAppStore((s) => s.closeSettings);
  const activeTab = useAppStore((s) => s.settingsActiveTab);
  const setActiveTab = useAppStore((s) => s.setSettingsActiveTab);

  const { snappingConfig, updateSnappingConfig } = useEditorStore();
  const { currentProject, updateProjectSpacing } = useProjectStore();

  return (
    <Dialog isOpen={isOpen} onClose={closeSettings} title="Settings" width={740} height={550} noPadding>
      <div className={styles.container}>
        {/* Left Navigation Sidebar */}
        <div className={styles.sidebar}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'snapping' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('snapping')}
          >
            <span className={styles.tabIcon}>🧲</span>
            <span>Canvas & Snapping</span>
          </button>

          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'layout' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('layout')}
          >
            <span className={styles.tabIcon}>📐</span>
            <span>Layout & Spacing</span>
          </button>

          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'pipeline' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('pipeline')}
          >
            <span className={styles.tabIcon}>🖼️</span>
            <span>Photo Pipeline</span>
          </button>

          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'shortcuts' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            <span className={styles.tabIcon}>⌨️</span>
            <span>Keyboard Shortcuts</span>
          </button>
        </div>

        {/* Right Content Area */}
        <div className={styles.contentPane}>
          {/* 1. Canvas & Snapping Tab */}
          {activeTab === 'snapping' && (
            <div>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Smart Magnetic Snapping</div>
                <div className={styles.sectionSubtitle}>
                  Configure real-time magnetic alignment targets and dynamic guidelines on the canvas.
                </div>
              </div>

              {/* Master Snapping Switch Card */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitle}>Enable Magnetic Snapping</div>
                    <div className={styles.cardSubtitle}>
                      Automatically snap photos to edges, centers, margins, and neighboring frames (hold Alt to bypass).
                    </div>
                  </div>
                  <Switch
                    checked={snappingConfig.enabled}
                    onChange={(enabled) => updateSnappingConfig({ enabled })}
                    size="md"
                  />
                </div>

                {/* Magnetic Distance / Sensitivity */}
                <div className={styles.thresholdRow}>
                  <div className={styles.checkboxLabel}>
                    <span className={styles.checkboxTitle}>Snapping Distance Threshold</span>
                    <span className={styles.checkboxDesc}>
                      Magnet pull distance in physical project units.
                    </span>
                  </div>
                  <div className={styles.presetGroup}>
                    {[
                      { label: 'Soft (1mm)', val: 1.0 },
                      { label: 'Standard (2mm)', val: 2.0 },
                      { label: 'Strong (4mm)', val: 4.0 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className={`${styles.presetBtn} ${snappingConfig.threshold === p.val ? styles.presetBtnActive : ''}`}
                        onClick={() => updateSnappingConfig({ threshold: p.val })}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Granular Snapping Targets Card */}
              <div className={styles.card}>
                <div className={styles.cardTitle} style={{ marginBottom: '12px' }}>
                  Snapping Reference Targets
                </div>

                <div className={styles.checkboxList}>
                  {/* 1. Page & Spine Edges */}
                  <label className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={snappingConfig.snapToPageEdges}
                      onChange={(e) => updateSnappingConfig({ snapToPageEdges: e.target.checked })}
                      disabled={!snappingConfig.enabled}
                    />
                    <div className={styles.checkboxLabel}>
                      <span className={styles.checkboxTitle}>Page & Spine Edges</span>
                      <span className={styles.checkboxDesc}>
                        Outer spread boundary edges (Top, Bottom, Left, Right) and center gutter / spine crease lines.
                      </span>
                    </div>
                  </label>

                  {/* 2. Page Centers */}
                  <label className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={snappingConfig.snapToPageCenters}
                      onChange={(e) => updateSnappingConfig({ snapToPageCenters: e.target.checked })}
                      disabled={!snappingConfig.enabled}
                    />
                    <div className={styles.checkboxLabel}>
                      <span className={styles.checkboxTitle}>Page Optical Centerlines</span>
                      <span className={styles.checkboxDesc}>
                        Center axes of the Left Facing Page, Right Facing Page, and full Open Spread.
                      </span>
                    </div>
                  </label>

                  {/* 3. Safe Zone Margins */}
                  <label className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={snappingConfig.snapToMargins}
                      onChange={(e) => updateSnappingConfig({ snapToMargins: e.target.checked })}
                      disabled={!snappingConfig.enabled}
                    />
                    <div className={styles.checkboxLabel}>
                      <span className={styles.checkboxTitle}>Safe Zone Margins</span>
                      <span className={styles.checkboxDesc}>
                        Safe area cut allowance guides (Blue dashed boundary lines).
                      </span>
                    </div>
                  </label>

                  {/* 4. Adjacent Photo Frames */}
                  <label className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={snappingConfig.snapToFrames}
                      onChange={(e) => updateSnappingConfig({ snapToFrames: e.target.checked })}
                      disabled={!snappingConfig.enabled}
                    />
                    <div className={styles.checkboxLabel}>
                      <span className={styles.checkboxTitle}>Adjacent Photo Frames</span>
                      <span className={styles.checkboxDesc}>
                        Align to collinear edges (Left, Top, Right, Bottom) and centerlines of other photos on the spread.
                      </span>
                    </div>
                  </label>

                  {/* 5. Equidistant Gap Spacing */}
                  <label className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={snappingConfig.snapToEqualGaps}
                      onChange={(e) => updateSnappingConfig({ snapToEqualGaps: e.target.checked })}
                      disabled={!snappingConfig.enabled}
                    />
                    <div className={styles.checkboxLabel}>
                      <span className={styles.checkboxTitle}>Equidistant Gap Spacing</span>
                      <span className={styles.checkboxDesc}>
                        Automatically detect equal inter-frame gap distances and render dynamic gap indicator HUD lines.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 2. Layout & Spacing Tab */}
          {activeTab === 'layout' && (
            <div>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Layout & Spacing Rules</div>
                <div className={styles.sectionSubtitle}>
                  Set project default gap distance and canvas interaction rules.
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardTitle} style={{ marginBottom: '8px' }}>
                  Default Photo Spacing
                </div>
                <div className={styles.cardSubtitle} style={{ marginBottom: '14px' }}>
                  The gap distance applied between adjacent photo frames across layouts.
                </div>

                {currentProject ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '120px' }}>
                      <NumberInput
                        value={currentProject.spacingValue}
                        onChange={(val) => updateProjectSpacing(Math.max(0, val), currentProject.spacingUnit)}
                        min={0}
                        max={100}
                        step={currentProject.spacingUnit === 'inch' ? 0.05 : 0.5}
                      />
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      {currentProject.spacingUnit}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Open or create a project to configure active spacing rules.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Photo Pipeline Tab */}
          {activeTab === 'pipeline' && (
            <div>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Photo Pipeline & Cache</div>
                <div className={styles.sectionSubtitle}>
                  High-performance background rendering engine powered by libvips.
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardTitle}>Image Pipeline Hierarchy</div>
                <div className={styles.cardSubtitle} style={{ marginTop: '6px', lineHeight: 1.5 }}>
                  AFSNSmartAlbum protects system memory by never loading multi-megapixel raw master photos onto the canvas.
                  Images flow through: <strong>Original $\to$ Preview (2000px) $\to$ Thumbnail (400px)</strong>.
                </div>
              </div>
            </div>
          )}

          {/* 4. Keyboard Shortcuts Tab */}
          {activeTab === 'shortcuts' && (
            <div>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Keyboard Shortcuts</div>
                <div className={styles.sectionSubtitle}>
                  Essential desktop hotkeys for lightning-fast layout design.
                </div>
              </div>

              <div className={styles.card} style={{ padding: '8px' }}>
                <table className={styles.shortcutTable}>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Shortcut</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Copy Selected Frames</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>C</kbd></td>
                    </tr>
                    <tr>
                      <td>Paste Frames</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>V</kbd></td>
                    </tr>
                    <tr>
                      <td>Duplicate Selected Frames</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>D</kbd></td>
                    </tr>
                    <tr>
                      <td>Delete Photo / Frame</td>
                      <td><kbd className={styles.kbd}>Delete</kbd> / <kbd className={styles.kbd}>Backspace</kbd></td>
                    </tr>
                    <tr>
                      <td>Bypass Magnetic Snapping</td>
                      <td>Hold <kbd className={styles.kbd}>Alt</kbd> while dragging</td>
                    </tr>
                    <tr>
                      <td>Fine Position Nudge (0.5mm)</td>
                      <td><kbd className={styles.kbd}>Arrow Keys</kbd></td>
                    </tr>
                    <tr>
                      <td>Ultra-Fine Nudge (0.1mm)</td>
                      <td><kbd className={styles.kbd}>Alt</kbd> + <kbd className={styles.kbd}>Arrow Keys</kbd></td>
                    </tr>
                    <tr>
                      <td>Fast Movement (2.0mm)</td>
                      <td><kbd className={styles.kbd}>Shift</kbd> + <kbd className={styles.kbd}>Arrow Keys</kbd></td>
                    </tr>
                    <tr>
                      <td>Multi-Select Frames / Photos</td>
                      <td><kbd className={styles.kbd}>Shift</kbd> + Click / Marquee Box</td>
                    </tr>
                    <tr>
                      <td>Crop Image Mode</td>
                      <td><kbd className={styles.kbd}>Double Click</kbd> on frame</td>
                    </tr>
                    <tr>
                      <td>Exit Crop Mode / Deselect</td>
                      <td><kbd className={styles.kbd}>Esc</kbd> / <kbd className={styles.kbd}>Enter</kbd></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
