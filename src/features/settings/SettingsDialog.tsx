import React, { useState, useMemo } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Switch } from '../../components/ui/Switch';
import { NumberInput } from '../../components/ui/NumberInput';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import { useProjectStore } from '../../stores/projectStore';
import { getMaxGapForUnit } from '../../domain/units';
import styles from './SettingsDialog.module.css';

// ---------------------------------------------------------------------------
// Keyboard Shortcuts Data
// ---------------------------------------------------------------------------
interface ShortcutDef {
  id: string;
  category: string;
  action: string;
  combos: Array<string[]>;
  note?: string;
  keywords?: string;
}

const SHORTCUT_CATEGORIES = [
  'All',
  'Panels & Navigation',
  'Canvas & Selection',
  'Transform & Layout',
  'Locking & Grouping',
  'Clipboard',
  'Text & Typography',
  'File & Project',
] as const;

const SHORTCUTS: ShortcutDef[] = [
  // 1. Panels & Inspector Navigation
  {
    id: 'nav-props',
    category: 'Panels & Navigation',
    action: 'Toggle Properties Panel',
    combos: [['P']],
    keywords: 'inspector sidebar properties',
  },
  {
    id: 'nav-lock',
    category: 'Panels & Navigation',
    action: 'Toggle Lock Panel',
    combos: [['L']],
    keywords: 'lock protect sidebar',
  },
  {
    id: 'nav-smart-layout',
    category: 'Panels & Navigation',
    action: 'Open Smart Layout Templates Panel',
    combos: [['G']],
    keywords: 'grid templates smart layout auto',
  },
  {
    id: 'nav-spread-next',
    category: 'Panels & Navigation',
    action: 'Next / Previous Spread',
    combos: [['PageDown'], ['PageUp']],
    note: 'or Alt + → / ←',
    keywords: 'next previous page spread navigation flip',
  },
  {
    id: 'nav-pan-tool',
    category: 'Panels & Navigation',
    action: 'Pan / Hand Tool',
    combos: [['Spacebar', '+ Drag']],
    keywords: 'hand pan move canvas view scroll',
  },
  {
    id: 'nav-reset-zoom',
    category: 'Panels & Navigation',
    action: 'Fit Spread to Screen',
    combos: [['Ctrl', '0']],
    keywords: 'zoom reset view fit 100 percent',
  },

  // 2. Canvas Selection & Manipulation
  {
    id: 'canvas-select',
    category: 'Canvas & Selection',
    action: 'Select Frame or Element',
    combos: [['Click']],
    keywords: 'pick select highlight target',
  },
  {
    id: 'canvas-multi-select',
    category: 'Canvas & Selection',
    action: 'Multi-Select Photos / Frames',
    combos: [['Shift', '+ Click']],
    note: 'or Marquee Drag',
    keywords: 'multiple select add range box marquee',
  },
  {
    id: 'canvas-select-all',
    category: 'Canvas & Selection',
    action: 'Select All Frames on Spread',
    combos: [['Ctrl', 'A']],
    keywords: 'all select spread entire',
  },
  {
    id: 'canvas-duplicate',
    category: 'Canvas & Selection',
    action: 'Duplicate Selected Frame(s)',
    combos: [['Ctrl', 'D']],
    keywords: 'duplicate copy clone make copy',
  },
  {
    id: 'canvas-delete',
    category: 'Canvas & Selection',
    action: 'Delete Frame / Photo',
    combos: [['Delete'], ['Backspace']],
    keywords: 'remove trash clear delete',
  },
  {
    id: 'canvas-crop-enter',
    category: 'Canvas & Selection',
    action: 'Enter Pan & Zoom Crop Mode',
    combos: [['Double Click']],
    note: 'on photo frame',
    keywords: 'crop pan zoom scale image photo inside frame',
  },
  {
    id: 'canvas-crop-exit',
    category: 'Canvas & Selection',
    action: 'Exit Crop Mode / Deselect',
    combos: [['Esc'], ['Enter']],
    keywords: 'done exit finish crop deselect escape',
  },

  // 3. Transform, Rotation & Layout
  {
    id: 'transform-swap',
    category: 'Transform & Layout',
    action: 'Swap 2 Selected Photos',
    combos: [['S']],
    keywords: 'swap switch exchange replace photo images positions',
  },
  {
    id: 'transform-rotate',
    category: 'Transform & Layout',
    action: 'Rotate Frame 90° Clockwise',
    combos: [['R']],
    note: 'Shift + R for CCW',
    keywords: 'rotate 90 orientation landscape portrait turn angle',
  },
  {
    id: 'transform-cycle-layout',
    category: 'Transform & Layout',
    action: 'Cycle Next Smart Layout',
    combos: [['Spacebar']],
    note: 'Shift + Space for previous',
    keywords: 'cycle layout template shuffle arrange smart',
  },
  {
    id: 'transform-shuffle',
    category: 'Transform & Layout',
    action: 'Shuffle Photo Placement',
    combos: [['S']],
    note: 'when Smart Layout HUD is active',
    keywords: 'shuffle positions random smart layout rearrange',
  },
  {
    id: 'transform-axis-lock',
    category: 'Transform & Layout',
    action: 'Orthogonal Axis-Lock Drag',
    combos: [['Shift', '+ Drag']],
    keywords: 'axis lock straight horizontal vertical constrain 45 90 drag',
  },
  {
    id: 'transform-drag-dup',
    category: 'Transform & Layout',
    action: 'Quick Drag-Duplicate',
    combos: [['Alt', '+ Drag']],
    keywords: 'quick duplicate drag copy instant clone',
  },
  {
    id: 'transform-bypass-snap',
    category: 'Transform & Layout',
    action: 'Bypass Magnetic Snapping',
    combos: [['Alt', '+ Drag']],
    keywords: 'bypass snap magnet ignore disable temporarily align',
  },
  {
    id: 'transform-nudge',
    category: 'Transform & Layout',
    action: 'Precision Nudge (1.0 mm)',
    combos: [['Arrow Keys']],
    keywords: 'nudge move 1mm fine arrow precision position',
  },
  {
    id: 'transform-nudge-fast',
    category: 'Transform & Layout',
    action: 'Fast Nudge Movement (5.0 mm)',
    combos: [['Shift', '+ Arrows']],
    keywords: 'fast nudge 5mm arrow step jump',
  },

  // 4. Locking & Grouping
  {
    id: 'lock-frame',
    category: 'Locking & Grouping',
    action: 'Lock Selected Frame(s)',
    combos: [['Ctrl', 'L']],
    keywords: 'lock protect secure freeze movement position',
  },
  {
    id: 'unlock-frame',
    category: 'Locking & Grouping',
    action: 'Unlock Selected Frame(s)',
    combos: [['Alt', 'L']],
    keywords: 'unlock unfreeze release',
  },
  {
    id: 'unlock-all',
    category: 'Locking & Grouping',
    action: 'Unlock All Frames on Spread',
    combos: [['Ctrl', 'Alt', 'L']],
    keywords: 'unlock all frames spread entire',
  },
  {
    id: 'group-frames',
    category: 'Locking & Grouping',
    action: 'Group Selected Frames',
    combos: [['Ctrl', 'G']],
    keywords: 'group combine bind cluster',
  },
  {
    id: 'ungroup-frames',
    category: 'Locking & Grouping',
    action: 'Ungroup Selected Frames',
    combos: [['Ctrl', 'Shift', 'G']],
    keywords: 'ungroup separate split isolate',
  },

  // 5. Clipboard
  {
    id: 'clip-copy',
    category: 'Clipboard',
    action: 'Copy Selected Frame(s)',
    combos: [['Ctrl', 'C']],
    keywords: 'copy clipboard duplicate memory',
  },
  {
    id: 'clip-paste',
    category: 'Clipboard',
    action: 'Paste Frames',
    combos: [['Ctrl', 'V']],
    keywords: 'paste insert place frame',
  },
  {
    id: 'clip-paste-in-place',
    category: 'Clipboard',
    action: 'Paste in Place',
    combos: [['Ctrl', 'Shift', 'V']],
    keywords: 'paste in place exact coordinate alignment original',
  },
  {
    id: 'clip-paste-all-spreads',
    category: 'Clipboard',
    action: 'Paste to All Spreads',
    combos: [['Ctrl', 'Alt', 'V']],
    keywords: 'paste all spreads repeat bulk batch header footer',
  },

  // 6. Text & Typography
  {
    id: 'text-add',
    category: 'Text & Typography',
    action: 'Add New Text Box',
    combos: [['T']],
    keywords: 'text box typography caption heading font',
  },
  {
    id: 'text-edit',
    category: 'Text & Typography',
    action: 'Edit Text Content Inline',
    combos: [['Double Click']],
    note: 'on text element',
    keywords: 'edit type write double click inline rich text',
  },
  {
    id: 'text-format-bold',
    category: 'Text & Typography',
    action: 'Bold / Italic / Underline',
    combos: [['Ctrl', 'B'], ['Ctrl', 'I'], ['Ctrl', 'U']],
    keywords: 'bold italic underline style typography font weight',
  },
  {
    id: 'text-commit',
    category: 'Text & Typography',
    action: 'Commit & Save Text Changes',
    combos: [['Ctrl', 'Enter']],
    keywords: 'commit done finish save text exit edit',
  },

  // 7. File & Project Operations
  {
    id: 'file-save',
    category: 'File & Project',
    action: 'Save Project',
    combos: [['Ctrl', 'S']],
    keywords: 'save disk project write store',
  },
  {
    id: 'file-save-as',
    category: 'File & Project',
    action: 'Save Project As (.afsn)',
    combos: [['Ctrl', 'Shift', 'S']],
    keywords: 'save as afsn new file copy backup',
  },
  {
    id: 'file-open',
    category: 'File & Project',
    action: 'Open Project',
    combos: [['Ctrl', 'O']],
    keywords: 'open file load project afsn browse',
  },
  {
    id: 'file-new',
    category: 'File & Project',
    action: 'Create New Project',
    combos: [['Ctrl', 'N']],
    keywords: 'new project wizard create fresh album',
  },
  {
    id: 'file-export',
    category: 'File & Project',
    action: 'Export High-Resolution Album',
    combos: [['Ctrl', 'E']],
    keywords: 'export print jpg pdf high res render dpi output',
  },
  {
    id: 'file-undo',
    category: 'File & Project',
    action: 'Undo Action',
    combos: [['Ctrl', 'Z']],
    keywords: 'undo revert step back history',
  },
  {
    id: 'file-redo',
    category: 'File & Project',
    action: 'Redo Action',
    combos: [['Ctrl', 'Y']],
    note: 'or Ctrl + Shift + Z',
    keywords: 'redo forward repeat history',
  },
  {
    id: 'file-shortcuts',
    category: 'File & Project',
    action: 'Open Keyboard Shortcuts Help',
    combos: [['F1']],
    keywords: 'help shortcuts hotkeys f1 cheat sheet',
  },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function SettingsDialog() {
  const isOpen = useAppStore((s) => s.isSettingsOpen);
  const closeSettings = useAppStore((s) => s.closeSettings);
  const activeTab = useAppStore((s) => s.settingsActiveTab);
  const setActiveTab = useAppStore((s) => s.setSettingsActiveTab);
  const appInfo = useAppStore((s) => s.appInfo);
  const openUpdateModal = useAppStore((s) => s.openUpdateModal);

  const {
    snappingConfig,
    updateSnappingConfig,
    multiResizeGapMode,
    setMultiResizeGapMode,
  } = useEditorStore();
  const { currentProject, updateProjectSpacing } = useProjectStore();

  // Shortcuts search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Filter shortcuts
  const filteredShortcuts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return SHORTCUTS.filter((s) => {
      const matchesCategory = categoryFilter === 'All' || s.category === categoryFilter;
      if (!matchesCategory) return false;
      if (!query) return true;
      const matchAction = s.action.toLowerCase().includes(query);
      const matchCat = s.category.toLowerCase().includes(query);
      const matchKeywords = s.keywords?.toLowerCase().includes(query) ?? false;
      const matchKeys = s.combos.some((combo) =>
        combo.some((k) => k.toLowerCase().includes(query))
      );
      return matchAction || matchCat || matchKeywords || matchKeys;
    });
  }, [searchQuery, categoryFilter]);

  // Group filtered shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, ShortcutDef[]> = {};
    for (const s of filteredShortcuts) {
      let group = groups[s.category];
      if (!group) {
        group = [];
        groups[s.category] = group;
      }
      group.push(s);
    }
    return groups;
  }, [filteredShortcuts]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={closeSettings}
      title="Preferences"
      width={780}
      height={580}
      noPadding
    >
      <div className={styles.container}>
        {/* Left Navigation Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarNav}>
            <div className={styles.sidebarHeader}>Preferences</div>

            {/* Tab 1: General & App */}
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'general' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <span className={styles.tabIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
              <span>General & App</span>
            </button>

            {/* Tab 2: Canvas & Snapping */}
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'snapping' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('snapping')}
            >
              <span className={styles.tabIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14a8 8 0 0 1 16 0v7a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-7a2 2 0 0 0-4 0v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7Z" />
                  <line x1="4" y1="18" x2="8" y2="18" />
                  <line x1="16" y1="18" x2="20" y2="18" />
                </svg>
              </span>
              <span>Canvas & Snapping</span>
            </button>

            {/* Tab 3: Layout & Spacing */}
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'layout' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('layout')}
            >
              <span className={styles.tabIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </span>
              <span>Layout & Spacing</span>
            </button>

            {/* Tab 4: Keyboard Shortcuts */}
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'shortcuts' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('shortcuts')}
            >
              <span className={styles.tabIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
                </svg>
              </span>
              <span>Shortcuts</span>
            </button>
          </div>

          {/* Sidebar Footer */}
          <div className={styles.sidebarFooter}>
            <div className={styles.versionBadge}>
              <span>AFSNSmartAlbum</span>
              <span className={styles.versionPill}>{appInfo.version}</span>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className={styles.contentPane}>
          {/* ================================================================ */}
          {/* 1. General & App Tab                                              */}
          {/* ================================================================ */}
          {activeTab === 'general' && (
            <div className={styles.tabContent}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>General & Application</div>
                <div className={styles.sectionSubtitle}>
                  System preferences, data integrity safeguards, and software version status.
                </div>
              </div>

              {/* Software Updates Card */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div style={{ flex: 1 }}>
                    <div className={styles.cardTitle}>
                      <span>Software Updates</span>
                      <span className={styles.statusBadgeActive}>Up to date</span>
                    </div>
                    <div className={styles.cardSubtitle}>
                      AFSNSmartAlbum automatic offline update engine with cryptographic signature verification.
                    </div>
                  </div>
                </div>

                <div className={styles.thresholdSection}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Installed Release</span>
                    <span className={styles.infoValue}>
                      <span className={styles.versionPill}>{appInfo.version}</span>
                    </span>
                  </div>
                  <div className={styles.infoRow} style={{ paddingTop: '8px' }}>
                    <span className={styles.infoLabel}>Update Status</span>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => {
                        openUpdateModal();
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                      Check for Updates
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Protection & Recovery Card */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitle}>
                      <span>Data Protection & Crash Recovery</span>
                      <span className={styles.statusBadgeActive}>Protected</span>
                    </div>
                    <div className={styles.cardSubtitle}>
                      Embedded SQLite transactional database with Write-Ahead Logging (WAL) and automatic state snapshots.
                    </div>
                  </div>
                </div>

                <div className={styles.thresholdSection}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Crash Guard Architecture</span>
                    <span className={styles.infoValue}>
                      Atomic Multi-Spread Transactions (SQLite)
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>State Persistence</span>
                    <span className={styles.infoValue}>
                      Continuous Local Project Sync
                    </span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Offline Guarantee</span>
                    <span className={styles.infoValue}>
                      Zero Cloud Dependency (100% Air-Gapped Capable)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 2. Canvas & Snapping Tab                                          */}
          {/* ================================================================ */}
          {activeTab === 'snapping' && (
            <div className={styles.tabContent}>
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
                    <div className={styles.cardTitle}>
                      <span>Enable Magnetic Snapping</span>
                      <span className={snappingConfig.enabled ? styles.statusBadgeActive : styles.statusBadgeMuted}>
                        {snappingConfig.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
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
                  <div className={styles.cardSubtitle} style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Snapping Distance Threshold
                  </div>
                  <div className={styles.cardSubtitle} style={{ marginTop: 0 }}>
                    Magnet pull distance in physical project units (0.1 mm is subtle, 2.0 mm is strong).
                  </div>

                  <div className={styles.thresholdControls}>
                    <div className={styles.presetGroup}>
                      {[
                        { label: '0.1mm Subtle', val: 0.1, title: 'Ultra Soft / Minimal Magnet (0.1mm)' },
                        { label: '0.5mm Soft', val: 0.5, title: 'Soft Snapping (0.5mm)' },
                        { label: '1.0mm Standard', val: 1.0, title: 'Standard Professional (1.0mm)' },
                        { label: '2.0mm Strong', val: 2.0, title: 'Strong Magnet (2.0mm)' },
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

                    <div style={{ width: '84px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <NumberInput
                        value={snappingConfig.threshold}
                        onChange={(val) => updateSnappingConfig({ threshold: Math.max(0.05, Math.round(val * 100) / 100) })}
                        min={0.05}
                        max={20}
                        step={0.1}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>mm</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Granular Snapping Targets Card */}
              <div className={styles.card}>
                <div className={styles.cardTitle} style={{ marginBottom: '14px' }}>
                  Snapping Reference Targets
                </div>

                <div className={styles.targetList}>
                  {/* 1. Page & Spine Edges */}
                  <div
                    className={`${styles.targetItem} ${!snappingConfig.enabled ? styles.targetItemDisabled : ''}`}
                    onClick={() => snappingConfig.enabled && updateSnappingConfig({ snapToPageEdges: !snappingConfig.snapToPageEdges })}
                  >
                    <div className={styles.targetInfo}>
                      <div className={styles.targetIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="18" rx="2" />
                          <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="3 3" />
                        </svg>
                      </div>
                      <div className={styles.targetText}>
                        <span className={styles.targetTitle}>Page & Spine Edges</span>
                        <span className={styles.targetDesc}>
                          Outer spread boundary edges (Top, Bottom, Left, Right) and center gutter / spine crease lines.
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={snappingConfig.snapToPageEdges}
                      onChange={(checked) => updateSnappingConfig({ snapToPageEdges: checked })}
                      disabled={!snappingConfig.enabled}
                      size="sm"
                    />
                  </div>

                  {/* 2. Page Centers */}
                  <div
                    className={`${styles.targetItem} ${!snappingConfig.enabled ? styles.targetItemDisabled : ''}`}
                    onClick={() => snappingConfig.enabled && updateSnappingConfig({ snapToPageCenters: !snappingConfig.snapToPageCenters })}
                  >
                    <div className={styles.targetInfo}>
                      <div className={styles.targetIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          <line x1="12" y1="3" x2="12" y2="21" />
                          <line x1="3" y1="12" x2="21" y2="12" />
                        </svg>
                      </div>
                      <div className={styles.targetText}>
                        <span className={styles.targetTitle}>Page Optical Centerlines</span>
                        <span className={styles.targetDesc}>
                          Center axes of the Left Facing Page, Right Facing Page, and full Open Spread.
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={snappingConfig.snapToPageCenters}
                      onChange={(checked) => updateSnappingConfig({ snapToPageCenters: checked })}
                      disabled={!snappingConfig.enabled}
                      size="sm"
                    />
                  </div>

                  {/* 3. Safe Zone Margins */}
                  <div
                    className={`${styles.targetItem} ${!snappingConfig.enabled ? styles.targetItemDisabled : ''}`}
                    onClick={() => snappingConfig.enabled && updateSnappingConfig({ snapToMargins: !snappingConfig.snapToMargins })}
                  >
                    <div className={styles.targetInfo}>
                      <div className={styles.targetIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="20" rx="2" />
                          <rect x="6" y="6" width="12" height="12" rx="1" strokeDasharray="2 2" />
                        </svg>
                      </div>
                      <div className={styles.targetText}>
                        <span className={styles.targetTitle}>Safe Zone Margins</span>
                        <span className={styles.targetDesc}>
                          Safe area cut allowance guides (Blue dashed boundary lines).
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={snappingConfig.snapToMargins}
                      onChange={(checked) => updateSnappingConfig({ snapToMargins: checked })}
                      disabled={!snappingConfig.enabled}
                      size="sm"
                    />
                  </div>

                  {/* 4. Adjacent Photo Frames */}
                  <div
                    className={`${styles.targetItem} ${!snappingConfig.enabled ? styles.targetItemDisabled : ''}`}
                    onClick={() => snappingConfig.enabled && updateSnappingConfig({ snapToFrames: !snappingConfig.snapToFrames })}
                  >
                    <div className={styles.targetInfo}>
                      <div className={styles.targetIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="9" height="16" rx="1.5" />
                          <rect x="13" y="4" width="9" height="16" rx="1.5" />
                        </svg>
                      </div>
                      <div className={styles.targetText}>
                        <span className={styles.targetTitle}>Adjacent Photo Frames</span>
                        <span className={styles.targetDesc}>
                          Align to collinear edges (Left, Top, Right, Bottom) and centerlines of other photos on the spread.
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={snappingConfig.snapToFrames}
                      onChange={(checked) => updateSnappingConfig({ snapToFrames: checked })}
                      disabled={!snappingConfig.enabled}
                      size="sm"
                    />
                  </div>

                  {/* 5. Equidistant Gap Spacing */}
                  <div
                    className={`${styles.targetItem} ${!snappingConfig.enabled ? styles.targetItemDisabled : ''}`}
                    onClick={() => snappingConfig.enabled && updateSnappingConfig({ snapToEqualGaps: !snappingConfig.snapToEqualGaps })}
                  >
                    <div className={styles.targetInfo}>
                      <div className={styles.targetIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="3" y1="12" x2="21" y2="12" />
                          <polyline points="7 8 3 12 7 16" />
                          <polyline points="17 8 21 12 17 16" />
                          <line x1="12" y1="7" x2="12" y2="17" />
                        </svg>
                      </div>
                      <div className={styles.targetText}>
                        <span className={styles.targetTitle}>Equidistant Gap Spacing</span>
                        <span className={styles.targetDesc}>
                          Automatically detect equal inter-frame gap distances and render dynamic gap indicator HUD lines.
                        </span>
                      </div>
                    </div>
                    <Switch
                      checked={snappingConfig.snapToEqualGaps}
                      onChange={(checked) => updateSnappingConfig({ snapToEqualGaps: checked })}
                      disabled={!snappingConfig.enabled}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 3. Layout & Spacing Tab                                           */}
          {/* ================================================================ */}
          {activeTab === 'layout' && (
            <div className={styles.tabContent}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Layout & Spacing Rules</div>
                <div className={styles.sectionSubtitle}>
                  Set project default gap distance and multi-selection canvas interaction rules.
                </div>
              </div>

              {/* Default Photo Spacing Card */}
              <div className={styles.card}>
                <div className={styles.cardTitle} style={{ marginBottom: '6px' }}>
                  Default Photo Spacing
                </div>
                <div className={styles.cardSubtitle} style={{ marginBottom: '16px' }}>
                  The physical millimeter gap distance applied between adjacent photo frames across layouts.
                </div>

                {currentProject ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className={styles.thresholdControls}>
                      <div className={styles.presetGroup}>
                        {[
                          { label: '0mm Seamless', val: 0 },
                          { label: '2mm Modern', val: 2 },
                          { label: '4mm Spacious', val: 4 },
                          { label: '6mm Classic', val: 6 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            className={`${styles.presetBtn} ${Math.abs(currentProject.spacingValue - preset.val) < 0.01 ? styles.presetBtnActive : ''}`}
                            onClick={() => updateProjectSpacing(preset.val, currentProject.spacingUnit)}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <div style={{ width: '90px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <NumberInput
                          value={currentProject.spacingValue}
                          onChange={(val) => {
                            const maxGap = getMaxGapForUnit(currentProject.spacingUnit);
                            updateProjectSpacing(Math.max(0, Math.min(val, maxGap)), currentProject.spacingUnit);
                          }}
                          min={0}
                          max={getMaxGapForUnit(currentProject.spacingUnit)}
                          step={currentProject.spacingUnit === 'inch' ? 0.05 : currentProject.spacingUnit === 'cm' ? 0.1 : currentProject.spacingUnit === 'px' ? 1 : 0.5}
                          precision={currentProject.spacingUnit === 'px' ? 0 : currentProject.spacingUnit === 'inch' || currentProject.spacingUnit === 'cm' ? 2 : 1}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                          {currentProject.spacingUnit}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Open or create a project to configure active spacing rules.
                  </div>
                )}
              </div>

              {/* Multi-Frame Resize Gap Mode (2-Card Selector) */}
              <div className={styles.card}>
                <div className={styles.cardTitle} style={{ marginBottom: '6px' }}>
                  Multi-Frame Resize Gap Behavior
                </div>
                <div className={styles.cardSubtitle} style={{ marginBottom: '14px' }}>
                  Determines how the inter-frame gaps behave when resizing a multi-selection group of photos.
                </div>

                <div className={styles.modeGrid}>
                  {/* Mode 1: Proportional */}
                  <div
                    className={`${styles.modeCard} ${multiResizeGapMode === 'proportional' ? styles.modeCardActive : ''}`}
                    onClick={() => setMultiResizeGapMode('proportional')}
                  >
                    <div className={styles.modeCardHeader}>
                      <div className={styles.modeIcon}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        </svg>
                      </div>
                      <div className={`${styles.radioIndicator} ${multiResizeGapMode === 'proportional' ? styles.radioIndicatorActive : ''}`}>
                        {multiResizeGapMode === 'proportional' && <div className={styles.radioDot} />}
                      </div>
                    </div>

                    <div className={styles.modeTitle}>Proportional Visual Gap</div>

                    <div>
                      <span className={styles.modeBadge}>Recommended</span>
                    </div>

                    <div className={styles.modeDesc}>
                      Scales inter-frame gaps proportionally with photo dimensions so the white space always looks harmonious and identical in visual proportion at any size.
                    </div>
                  </div>

                  {/* Mode 2: Fixed Gap */}
                  <div
                    className={`${styles.modeCard} ${multiResizeGapMode === 'fixed_gap' ? styles.modeCardActive : ''}`}
                    onClick={() => setMultiResizeGapMode('fixed_gap')}
                  >
                    <div className={styles.modeCardHeader}>
                      <div className={styles.modeIcon}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <line x1="9" y1="3" x2="9" y2="21" />
                          <line x1="15" y1="3" x2="15" y2="21" />
                        </svg>
                      </div>
                      <div className={`${styles.radioIndicator} ${multiResizeGapMode === 'fixed_gap' ? styles.radioIndicatorActive : ''}`}>
                        {multiResizeGapMode === 'fixed_gap' && <div className={styles.radioDot} />}
                      </div>
                    </div>

                    <div className={styles.modeTitle}>Strict Fixed Physical Gap</div>

                    <div>
                      <span className={styles.modeBadge} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                        2D Topological Graph
                      </span>
                    </div>

                    <div className={styles.modeDesc}>
                      Preserves the exact physical millimeter gap spacing between adjacent frames using 2D Topological Neighbor Graph math across all dimensions.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 4. Keyboard Shortcuts Tab                                         */}
          {/* ================================================================ */}
          {activeTab === 'shortcuts' && (
            <div className={styles.tabContent}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>Keyboard Shortcuts</div>
                <div className={styles.sectionSubtitle}>
                  Essential desktop hotkeys for lightning-fast layout design and album production.
                </div>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div className={styles.shortcutsToolbar}>
                <div className={styles.searchBox}>
                  <span className={styles.searchIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search shortcuts by action, key or category (e.g. crop, lock, duplicate)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className={styles.clearSearchBtn}
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className={styles.chipList}>
                  {SHORTCUT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`${styles.chipBtn} ${categoryFilter === cat ? styles.chipBtnActive : ''}`}
                      onClick={() => setCategoryFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shortcut Items Grid */}
              {Object.keys(groupedShortcuts).length > 0 ? (
                Object.entries(groupedShortcuts).map(([category, items]) => (
                  <div key={category} className={styles.shortcutCategory}>
                    <div className={styles.categoryTitle}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      {category}
                    </div>

                    <div className={styles.shortcutGrid}>
                      {items.map((item) => (
                        <div key={item.id} className={styles.shortcutRow}>
                          <div className={styles.shortcutAction}>
                            {item.action}
                            {item.note && (
                              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                                ({item.note})
                              </span>
                            )}
                          </div>

                          <div className={styles.shortcutKeys}>
                            {item.combos.map((combo, comboIdx) => (
                              <React.Fragment key={comboIdx}>
                                {comboIdx > 0 && (
                                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0 2px' }}>
                                    /
                                  </span>
                                )}
                                {combo.map((keyToken, tokenIdx) => (
                                  <React.Fragment key={tokenIdx}>
                                    {keyToken.startsWith('+') ? (
                                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', margin: '0 2px' }}>
                                        {keyToken}
                                      </span>
                                    ) : (
                                      <kbd className={styles.kbd}>{keyToken}</kbd>
                                    )}
                                  </React.Fragment>
                                ))}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptySearch}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <div className={styles.emptySearchTitle}>No shortcuts found</div>
                  <div className={styles.emptySearchDesc}>
                    No keyboard shortcuts match &quot;{searchQuery}&quot;. Try a different keyword or select &apos;All&apos;.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
