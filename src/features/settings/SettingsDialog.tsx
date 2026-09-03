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

  const {
    snappingConfig,
    updateSnappingConfig,
    multiResizeGapMode,
    setMultiResizeGapMode,
  } = useEditorStore();
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
                <div className={styles.thresholdSection}>
                  <div className={styles.checkboxLabel}>
                    <span className={styles.checkboxTitle}>Snapping Distance Threshold</span>
                    <span className={styles.checkboxDesc}>
                      Magnet pull distance in physical project units (0.1 mm is subtle, 2.0 mm is strong).
                    </span>
                  </div>
                  <div className={styles.thresholdControls}>
                    <div className={styles.presetGroup}>
                      {[
                        { label: '0.1mm', val: 0.1, title: 'Ultra Soft / Minimal Magnet (0.1mm)' },
                        { label: '0.5mm', val: 0.5, title: 'Soft Snapping (0.5mm)' },
                        { label: '1.0mm', val: 1.0, title: 'Standard Professional (1.0mm)' },
                        { label: '2.0mm', val: 2.0, title: 'Strong Magnet (2.0mm)' },
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          className={`${styles.presetBtn} ${Math.abs(snappingConfig.threshold - p.val) < 0.01 ? styles.presetBtnActive : ''}`}
                          onClick={() => updateSnappingConfig({ threshold: p.val })}
                          title={p.title}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ width: '80px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <NumberInput
                        value={snappingConfig.threshold}
                        onChange={(val) => updateSnappingConfig({ threshold: Math.max(0.05, Math.round(val * 100) / 100) })}
                        min={0.05}
                        max={20}
                        step={0.1}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>mm</span>
                    </div>
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

              {/* Multi-Frame Resize Gap Scaling Mode */}
              <div className={styles.card}>
                <div className={styles.cardTitle} style={{ marginBottom: '8px' }}>
                  Multi-Frame Resize Gap Behavior
                </div>
                <div className={styles.cardSubtitle} style={{ marginBottom: '14px' }}>
                  Determines how the inter-frame gaps behave when resizing a multi-selection group of photos.
                </div>

                <div className={styles.checkboxList}>
                  <label className={styles.checkboxItem}>
                    <input
                      type="radio"
                      name="multiResizeGapMode"
                      value="proportional"
                      checked={multiResizeGapMode === 'proportional'}
                      onChange={() => setMultiResizeGapMode('proportional')}
                    />
                    <div className={styles.checkboxLabel}>
                      <span className={styles.checkboxTitle}>Proportional Visual Gap (Recommended)</span>
                      <span className={styles.checkboxDesc}>
                        Scales inter-frame gaps proportionally with photo dimensions so the white space always looks harmonious and identical in proportion at any size.
                      </span>
                    </div>
                  </label>

                  <label className={styles.checkboxItem}>
                    <input
                      type="radio"
                      name="multiResizeGapMode"
                      value="fixed_gap"
                      checked={multiResizeGapMode === 'fixed_gap'}
                      onChange={() => setMultiResizeGapMode('fixed_gap')}
                    />
                    <div className={styles.checkboxLabel}>
                      <span className={styles.checkboxTitle}>Strict Fixed Physical Gap</span>
                      <span className={styles.checkboxDesc}>
                        Preserves the exact physical millimeter gap spacing between adjacent frames using 2D Topological Neighbor Graph math.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 3. Keyboard Shortcuts Tab */}
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
                    {/* 1. Panels & Navigation */}
                    <tr className={styles.categoryRow}>
                      <td colSpan={2}>1. Panels & Inspector Navigation</td>
                    </tr>
                    <tr>
                      <td>Open Properties Panel</td>
                      <td><kbd className={styles.kbd}>P</kbd></td>
                    </tr>
                    <tr>
                      <td>Open Lock Panel</td>
                      <td><kbd className={styles.kbd}>L</kbd></td>
                    </tr>
                    <tr>
                      <td>Open Smart Layout Panel</td>
                      <td><kbd className={styles.kbd}>G</kbd></td>
                    </tr>
                    <tr>
                      <td>Next / Previous Spread</td>
                      <td><kbd className={styles.kbd}>PageDown</kbd> / <kbd className={styles.kbd}>PageUp</kbd> (<kbd className={styles.kbd}>Alt</kbd>+<kbd className={styles.kbd}>→</kbd>/<kbd className={styles.kbd}>←</kbd>)</td>
                    </tr>
                    <tr>
                      <td>Pan / Hand Tool</td>
                      <td><kbd className={styles.kbd}>Spacebar</kbd> + Drag</td>
                    </tr>
                    <tr>
                      <td>Reset Zoom (Fit to Screen)</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>0</kbd></td>
                    </tr>

                    {/* 2. Locking & Grouping */}
                    <tr className={styles.categoryRow}>
                      <td colSpan={2}>2. Locking & Grouping</td>
                    </tr>
                    <tr>
                      <td>Lock Selected Frame(s)</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>L</kbd></td>
                    </tr>
                    <tr>
                      <td>Unlock Selected Frame(s)</td>
                      <td><kbd className={styles.kbd}>Alt</kbd> + <kbd className={styles.kbd}>L</kbd></td>
                    </tr>
                    <tr>
                      <td>Unlock All Frames on Spread</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>Alt</kbd> + <kbd className={styles.kbd}>L</kbd></td>
                    </tr>
                    <tr>
                      <td>Group Selected Frames</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>G</kbd></td>
                    </tr>
                    <tr>
                      <td>Ungroup Selected Frames</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>Shift</kbd> + <kbd className={styles.kbd}>G</kbd></td>
                    </tr>

                    {/* 3. Canvas Selection & Manipulation */}
                    <tr className={styles.categoryRow}>
                      <td colSpan={2}>3. Canvas Selection & Manipulation</td>
                    </tr>
                    <tr>
                      <td>Select Frame</td>
                      <td><kbd className={styles.kbd}>Click</kbd></td>
                    </tr>
                    <tr>
                      <td>Multi-Select Frames / Photos</td>
                      <td><kbd className={styles.kbd}>Shift</kbd> + Click / Marquee Box Drag</td>
                    </tr>
                    <tr>
                      <td>Select All Frames on Spread</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>A</kbd></td>
                    </tr>
                    <tr>
                      <td>Duplicate Selected Frame(s)</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>D</kbd></td>
                    </tr>
                    <tr>
                      <td>Delete Photo / Frame</td>
                      <td><kbd className={styles.kbd}>Delete</kbd> / <kbd className={styles.kbd}>Backspace</kbd></td>
                    </tr>
                    <tr>
                      <td>Crop Image Mode</td>
                      <td><kbd className={styles.kbd}>Double Click</kbd> on frame</td>
                    </tr>
                    <tr>
                      <td>Exit Crop Mode / Deselect</td>
                      <td><kbd className={styles.kbd}>Esc</kbd> / <kbd className={styles.kbd}>Enter</kbd></td>
                    </tr>

                    {/* 4. Transform, Rotation & Nudge */}
                    <tr className={styles.categoryRow}>
                      <td colSpan={2}>4. Transform, Rotation & Layout</td>
                    </tr>
                    <tr>
                      <td>Swap 2 Selected Photos</td>
                      <td><kbd className={styles.kbd}>S</kbd></td>
                    </tr>
                    <tr>
                      <td>Rotate 90° Clockwise</td>
                      <td><kbd className={styles.kbd}>R</kbd> (<kbd className={styles.kbd}>Shift</kbd>+<kbd className={styles.kbd}>R</kbd> CCW)</td>
                    </tr>
                    <tr>
                      <td>Cycle Smart Layout</td>
                      <td><kbd className={styles.kbd}>Spacebar</kbd> / <kbd className={styles.kbd}>Shift</kbd>+<kbd className={styles.kbd}>Space</kbd></td>
                    </tr>
                    <tr>
                      <td>Shuffle Photo Placements</td>
                      <td><kbd className={styles.kbd}>S</kbd> (when Layout HUD is active)</td>
                    </tr>
                    <tr>
                      <td>Orthogonal Axis-Lock Drag</td>
                      <td>Hold <kbd className={styles.kbd}>Shift</kbd> while dragging frame</td>
                    </tr>
                    <tr>
                      <td>Quick Drag-Duplicate</td>
                      <td>Hold <kbd className={styles.kbd}>Alt</kbd> while dragging frame</td>
                    </tr>
                    <tr>
                      <td>Bypass Magnetic Snapping</td>
                      <td>Hold <kbd className={styles.kbd}>Alt</kbd> while dragging handle</td>
                    </tr>
                    <tr>
                      <td>Fine Position Nudge (1.0mm)</td>
                      <td><kbd className={styles.kbd}>Arrow Keys</kbd></td>
                    </tr>
                    <tr>
                      <td>Fast Movement (5.0mm)</td>
                      <td><kbd className={styles.kbd}>Shift</kbd> + <kbd className={styles.kbd}>Arrow Keys</kbd></td>
                    </tr>

                    {/* 5. Clipboard */}
                    <tr className={styles.categoryRow}>
                      <td colSpan={2}>5. Clipboard (Copy & Paste)</td>
                    </tr>
                    <tr>
                      <td>Copy Selected Frames</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>C</kbd></td>
                    </tr>
                    <tr>
                      <td>Paste Frames</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>V</kbd></td>
                    </tr>
                    <tr>
                      <td>Paste in Place</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>Shift</kbd> + <kbd className={styles.kbd}>V</kbd></td>
                    </tr>
                    <tr>
                      <td>Paste to All Spreads</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>Alt</kbd> + <kbd className={styles.kbd}>V</kbd></td>
                    </tr>

                    {/* 6. Text & Typography */}
                    <tr className={styles.categoryRow}>
                      <td colSpan={2}>6. Text & Typography</td>
                    </tr>
                    <tr>
                      <td>Add Text Box</td>
                      <td><kbd className={styles.kbd}>T</kbd></td>
                    </tr>
                    <tr>
                      <td>Edit Text Inline</td>
                      <td><kbd className={styles.kbd}>Double Click</kbd> on text box</td>
                    </tr>
                    <tr>
                      <td>Bold / Italic / Underline</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd>+<kbd className={styles.kbd}>B</kbd> / <kbd className={styles.kbd}>Ctrl</kbd>+<kbd className={styles.kbd}>I</kbd> / <kbd className={styles.kbd}>Ctrl</kbd>+<kbd className={styles.kbd}>U</kbd></td>
                    </tr>
                    <tr>
                      <td>Commit & Save Text Edit</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>Enter</kbd></td>
                    </tr>

                    {/* 7. Project & File Operations */}
                    <tr className={styles.categoryRow}>
                      <td colSpan={2}>7. Project & File Operations</td>
                    </tr>
                    <tr>
                      <td>Save Project</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>S</kbd></td>
                    </tr>
                    <tr>
                      <td>Save Project As (.afsn)</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>Shift</kbd> + <kbd className={styles.kbd}>S</kbd></td>
                    </tr>
                    <tr>
                      <td>Open Project (.afsn)</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>O</kbd></td>
                    </tr>
                    <tr>
                      <td>New Project</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>N</kbd></td>
                    </tr>
                    <tr>
                      <td>Export High-Resolution Album</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd> + <kbd className={styles.kbd}>E</kbd></td>
                    </tr>
                    <tr>
                      <td>Undo / Redo</td>
                      <td><kbd className={styles.kbd}>Ctrl</kbd>+<kbd className={styles.kbd}>Z</kbd> / <kbd className={styles.kbd}>Ctrl</kbd>+<kbd className={styles.kbd}>Y</kbd></td>
                    </tr>
                    <tr>
                      <td>Open Keyboard Shortcuts</td>
                      <td><kbd className={styles.kbd}>F1</kbd></td>
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
