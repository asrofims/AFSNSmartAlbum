import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { NumberInput } from '../../components/ui/NumberInput';
import { Switch } from '../../components/ui/Switch';
import { useAppStore } from '../../stores/appStore';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { usePhotoStore } from '../../stores/photoStore';
import { useHistoryStore } from '../../stores/historyStore';
import { useAutoSave } from '../persistence/useAutoSave';
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
import { TemplatesPanel } from '../templates/TemplatesPanel';
import { invoke } from '@tauri-apps/api/core';
import { ExportAlbumDialog, ExportOptions } from '../export/ExportAlbumDialog';
import { ExportProgressModal } from '../export/ExportProgressModal';
import appLogo from '../../assets/app-logo.png';
import styles from './WorkspaceLayout.module.css';

export function WorkspaceLayout() {
  useAutoSave();

  const openAbout = useAppStore((s) => s.openAbout);
  const openSettings = useAppStore((s) => s.openSettings);

  const currentProject = useProjectStore((s) => s.currentProject);
  const openNewProject = useProjectStore((s) => s.openNewProject);
  const closeProject = useProjectStore((s) => s.closeProject);
  const updateProjectSpacing = useProjectStore((s) => s.updateProjectSpacing);
  const updateProjectMargin = useProjectStore((s) => s.updateProjectMargin);
  const updateProjectPhotoInset = useProjectStore((s) => s.updateProjectPhotoInset);
  const saveProject = useProjectStore((s) => s.saveProject);
  const exportProjectAsAfsn = useProjectStore((s) => s.exportProjectAsAfsn);
  const exportCompleteProjectPackageWithPhotos = useProjectStore((s) => s.exportCompleteProjectPackageWithPhotos);
  const importProjectFromAfsn = useProjectStore((s) => s.importProjectFromAfsn);

  const currentAlbum = useAlbumStore((s) => s.currentAlbum);
  const activeSpreadId = useAlbumStore((s) => s.activeSpreadId);
  const showGutterGuide = useAlbumStore((s) => s.showGutterGuide);
  const showBleedGuide = useAlbumStore((s) => s.showBleedGuide);
  const showSafeAreaGuide = useAlbumStore((s) => s.showSafeAreaGuide);
  const toggleGuide = useAlbumStore((s) => s.toggleGuide);
  const updateGutterWidth = useAlbumStore((s) => s.updateGutterWidth);
  const updateBleed = useAlbumStore((s) => s.updateBleed);
  const updateSafeArea = useAlbumStore((s) => s.updateSafeArea);
  const updatePhotoInset = useAlbumStore((s) => s.updatePhotoInset);
  const saveStatus = useAlbumStore((s) => s.saveStatus);
  const lastSavedAt = useAlbumStore((s) => s.lastSavedAt);
  const saveAlbumToDb = useAlbumStore((s) => s.saveAlbumToDb);
  const undo = useAlbumStore((s) => s.undo);
  const redo = useAlbumStore((s) => s.redo);

  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);

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

  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isRatioLocked, setIsRatioLocked] = useState<boolean>(true);
  const [customGapValue, setCustomGapValue] = useState<number>(currentProject?.spacingValue ?? 5);
  const [inspectorTab, setInspectorTab] = useState<'properties' | 'smart_layout'>('properties');

  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Export Dialog & Progress Modal State
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExportProgressOpen, setIsExportProgressOpen] = useState(false);
  const [activeExportDir, setActiveExportDir] = useState('');

  const handleStartExport = async (options: ExportOptions) => {
    if (!currentProject) return;
    setActiveExportDir(options.outputDir);
    setIsExportProgressOpen(true);
    try {
      await saveAlbumToDb();
      await invoke('export_album_high_res', {
        projectId: currentProject.id,
        options,
      });
    } catch (err: any) {
      console.error('Export failed:', err);
      setIsExportProgressOpen(false);
      alert(`Export could not be completed: ${err?.message || err}`);
    }
  };

  // Unsaved Changes Protection Dialog State
  const [pendingSafeAction, setPendingSafeAction] = useState<(() => void | Promise<void>) | null>(null);

  const confirmSafeAction = useCallback((action: () => void | Promise<void>) => {
    if (saveStatus === 'unsaved') {
      setPendingSafeAction(() => action);
    } else {
      action();
    }
  }, [saveStatus]);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setIsFileMenuOpen(false);
      }
    };
    if (isFileMenuOpen) {
      window.addEventListener('mousedown', onMouseDown);
    }
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [isFileMenuOpen]);

  // Window BeforeUnload Warning when modifications are unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'unsaved') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  // Collapsible Right Properties & Bottom Filmstrip
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [isFilmstripOpen, setIsFilmstripOpen] = useState(true);
  const [isInsetExpanded, setIsInsetExpanded] = useState(false);

  useTauriInfo();

  // Initialize or load album structure and photos from SQLite DB on project load
  useEffect(() => {
    if (currentProject) {
      const albumStore = useAlbumStore.getState();
      const existingAlbum = albumStore.currentAlbum;

      // Ensure photos & folders for this project are loaded in photoStore
      import('../../stores/photoStore').then(({ usePhotoStore }) => {
        usePhotoStore.getState().loadPhotos(currentProject.id);
        usePhotoStore.getState().loadFolders(currentProject.id);
      });

      if (!existingAlbum || existingAlbum.projectId !== currentProject.id) {
        albumStore.loadAlbumFromDb(currentProject.id).then((loaded) => {
          if (!loaded) {
            albumStore.initializeAlbum(currentProject);
          }
        });
      }
    }
  }, [currentProject]);

  // Global Keyboard Shortcuts for Undo (Ctrl+Z), Redo (Ctrl+Y), Save (Ctrl+S), Save As (Ctrl+Shift+S), Open (Ctrl+O), New (Ctrl+N)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (!cmdOrCtrl) return;

      // Ignore when typing inside input / textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (e.shiftKey) {
          // Save As (.afsn)
          exportProjectAsAfsn().then((path) => {
            if (path) showToast(`✓ Project saved to: ${path.split(/[\\/]/).pop() || path}`);
          });
        } else {
          // Save
          saveProject().then((res) => {
            if (res.success) {
              if (res.filePath) {
                showToast(`✓ Project saved to: ${res.filePath.split(/[\\/]/).pop() || res.filePath}`);
              } else {
                showToast('✓ Project saved to database');
              }
            }
          });
        }
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (currentProject) {
          setIsExportDialogOpen(true);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;

        e.preventDefault();

        // If hovering over filmstrip, select all photos
        const isHoveredOnFilmstrip = Boolean(document.querySelector('[aria-label="Photo Library Filmstrip"]:hover'));
        if (isHoveredOnFilmstrip) {
          usePhotoStore.getState().selectAll();
          useEditorStore.getState().clearSelection();
        } else {
          // Select all frames on active spread
          const album = useAlbumStore.getState().currentAlbum;
          const activeSpreadId = useAlbumStore.getState().activeSpreadId;
          const spreads = album ? getAllAlbumSpreads(album) : [];
          const activeSpread = spreads.find((s) => s.id === activeSpreadId) || spreads[0];
          if (activeSpread && activeSpread.elements && activeSpread.elements.length > 0) {
            useEditorStore.getState().selectFrames(activeSpread.elements.map((f) => f.id));
            usePhotoStore.getState().clearSelection();
          }
        }
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        confirmSafeAction(async () => {
          await importProjectFromAfsn();
        });
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        confirmSafeAction(() => openNewProject());
      }
    },
    [undo, redo, saveProject, exportProjectAsAfsn, importProjectFromAfsn, openNewProject, confirmSafeAction, showToast]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
              <img src={appLogo} alt="AFSN" style={{ width: 18, height: 18, objectFit: 'contain' }} />
            </span>
            <span>AFSNSmartAlbum</span>
          </div>

          <div className={styles.toolbarSeparator} />

          {/* Professional File Menu Dropdown */}
          <div className={styles.menuContainer} ref={fileMenuRef}>
            <Button
              variant={isFileMenuOpen ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
              title="File Menu"
            >
              <span>File ▾</span>
            </Button>

            {isFileMenuOpen && (
              <div className={styles.dropdownMenu}>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setIsFileMenuOpen(false);
                    confirmSafeAction(() => openNewProject());
                  }}
                >
                  <span>+ New Project...</span>
                  <span className={styles.shortcutText}>Ctrl+N</span>
                </button>

                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setIsFileMenuOpen(false);
                    confirmSafeAction(async () => {
                      const ok = await importProjectFromAfsn();
                      if (ok) showToast('✓ Project opened successfully');
                    });
                  }}
                >
                  <span>📂 Open Project</span>
                  <span className={styles.shortcutText}>Ctrl+O</span>
                </button>

                {currentProject && (
                  <>
                    <div className={styles.menuDivider} />

                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={async () => {
                        setIsFileMenuOpen(false);
                        const res = await saveProject();
                        if (res.success) {
                          if (res.filePath) {
                            showToast(`✓ Project saved to: ${res.filePath.split(/[\\/]/).pop() || res.filePath}`);
                          } else {
                            showToast('✓ Project saved to database');
                          }
                        }
                      }}
                    >
                      <span>💾 Save</span>
                      <span className={styles.shortcutText}>Ctrl+S</span>
                    </button>

                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={async () => {
                        setIsFileMenuOpen(false);
                        const path = await exportProjectAsAfsn();
                        if (path) showToast(`✓ Project saved to: ${path.split(/[\\/]/).pop() || path}`);
                      }}
                    >
                      <span>📑 Save As (.afsn)...</span>
                      <span className={styles.shortcutText}>Ctrl+Shift+S</span>
                    </button>

                    <div className={styles.menuDivider} />

                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => {
                        setIsFileMenuOpen(false);
                        setIsExportDialogOpen(true);
                      }}
                    >
                      <span>📤 Export Album...</span>
                      <span className={styles.shortcutText}>Ctrl+E</span>
                    </button>

                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={async () => {
                        setIsFileMenuOpen(false);
                        const path = await exportCompleteProjectPackageWithPhotos();
                        if (path) showToast(`✓ Complete package exported to: ${path}`);
                      }}
                    >
                      <span>📦 Export Packaged (.zip)...</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => confirmSafeAction(() => openNewProject())}
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
                onClick={() => confirmSafeAction(() => closeProject())}
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

              {/* Undo / Redo & Save Action Stack */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <button
                  type="button"
                  className={styles.historyBtn}
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.historyBtn}
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Y)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 7v6h-6" />
                    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.historyBtn}
                  onClick={async () => {
                    const res = await saveProject();
                    if (res.success) {
                      if (res.filePath) {
                        showToast(`✓ Project saved to: ${res.filePath.split(/[\\/]/).pop() || res.filePath}`);
                      } else {
                        showToast('✓ Project saved to database');
                      }
                    }
                  }}
                  title="Save Project (Ctrl+S)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.historyBtn}
                  onClick={async () => {
                    const path = await exportCompleteProjectPackageWithPhotos();
                    if (path) showToast(`✓ Complete package exported to: ${path}`);
                  }}
                  title="Export Packaged (.zip)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              </div>

              {/* Auto-Save Status Badge */}
              <div
                className={`${styles.saveBadge} ${
                  saveStatus === 'saved'
                    ? styles.saveBadgeSaved
                    : saveStatus === 'saving'
                    ? styles.saveBadgeSaving
                    : styles.saveBadgeUnsaved
                }`}
                title={
                  saveStatus === 'saved'
                    ? `All changes saved to database${lastSavedAt ? ` (${lastSavedAt})` : ''}`
                    : saveStatus === 'saving'
                    ? 'Saving changes to database...'
                    : 'Unsaved modifications (auto-saving...)'
                }
                onClick={() => {
                  if (saveStatus === 'unsaved') saveAlbumToDb();
                }}
                style={{ cursor: saveStatus === 'unsaved' ? 'pointer' : 'default' }}
              >
                {saveStatus === 'saved' && <span>✓ Saved</span>}
                {saveStatus === 'saving' && <span>↻ Saving...</span>}
                {saveStatus === 'unsaved' && <span>● Unsaved</span>}
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
              {/* High-Resolution Print Export Button */}
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsExportDialogOpen(true)}
                title="Export Album for Print (Ctrl+E)"
                style={{ backgroundColor: '#2563eb', borderColor: '#3b82f6', color: '#ffffff' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>Export</span>
              </Button>

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
            onClick={() => openSettings()}
            title="Application & Tool Settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Settings
          </Button>

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
                onZoomChange={setZoomLevel}
              />
              <FrameToolbar />
            </>
          )}
        </main>

        {/* Page & Spread Navigation Bar spanning full width of the editor */}
        {currentProject && <PageNavigator />}
      </div>

      {/* Right Panel: Collapsible Properties & Smart Layout */}
      {isPropertiesOpen && (
        <aside className={styles.rightPanel}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setInspectorTab('properties')}
                style={{
                  background: inspectorTab === 'properties' ? 'var(--color-bg-secondary)' : 'transparent',
                  border: inspectorTab === 'properties' ? '1px solid var(--color-border)' : '1px solid transparent',
                  color: inspectorTab === 'properties' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>⚙ Properties</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('smart_layout')}
                style={{
                  background: inspectorTab === 'smart_layout' ? 'var(--color-bg-secondary)' : 'transparent',
                  border: inspectorTab === 'smart_layout' ? '1px solid var(--color-border)' : '1px solid transparent',
                  color: inspectorTab === 'smart_layout' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>✨ Smart Layout</span>
              </button>
            </div>
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
              title="Collapse Panel"
            >
              ▶
            </button>
          </div>

          {!currentProject ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '12px' }}>
              No project open
            </div>
          ) : inspectorTab === 'smart_layout' ? (
            <TemplatesPanel onApplyToast={(msg) => showToast(msg)} />
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
                              precision={currentProject.canvasUnit === 'inch' || currentProject.canvasUnit === 'cm' ? 2 : 1}
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
                              precision={1}
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
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentProject.canvasUnit}</span>
                      </div>

                      {/* W & H Inputs with Compact Chain Link Button */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Width (W)</div>
                          <NumberInput
                            value={selectedFrame.width}
                            onChange={(newW) => {
                              if (newW <= 0) return;
                              const updates: Partial<PhotoFrameElement> = { width: newW };
                              if (isRatioLocked && selectedFrame.width > 0 && selectedFrame.height > 0) {
                                const ratio = selectedFrame.width / selectedFrame.height;
                                updates.height = Number((newW / ratio).toFixed(currentProject.canvasUnit === 'inch' || currentProject.canvasUnit === 'cm' ? 2 : 1));
                              }
                              updateFrameGeometry(activeSpread.id, selectedFrame.id, updates);
                            }}
                            min={0.1}
                            max={2000}
                            step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 1}
                            precision={currentProject.canvasUnit === 'inch' || currentProject.canvasUnit === 'cm' ? 2 : 1}
                          />
                        </div>

                        {/* Aspect Ratio Chain Link Button (Adobe / Figma style) */}
                        <button
                          type="button"
                          onClick={() => setIsRatioLocked(!isRatioLocked)}
                          style={{
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isRatioLocked ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                            border: isRatioLocked ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid var(--color-border)',
                            color: isRatioLocked ? 'var(--color-accent)' : 'var(--color-text-muted)',
                            cursor: 'pointer',
                            marginBottom: '1px',
                            transition: 'all 0.15s ease',
                          }}
                          title={isRatioLocked ? 'Constrain Proportions: ON (Lock aspect ratio)' : 'Constrain Proportions: OFF (Unlock aspect ratio)'}
                        >
                          {isRatioLocked ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6">
                              <path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="m5.16 11.75-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                              <line x1="2" x2="22" y1="2" y2="22" strokeWidth="2" />
                            </svg>
                          )}
                        </button>

                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Height (H)</div>
                          <NumberInput
                            value={selectedFrame.height}
                            onChange={(newH) => {
                              if (newH <= 0) return;
                              const updates: Partial<PhotoFrameElement> = { height: newH };
                              if (isRatioLocked && selectedFrame.width > 0 && selectedFrame.height > 0) {
                                const ratio = selectedFrame.width / selectedFrame.height;
                                updates.width = Number((newH * ratio).toFixed(currentProject.canvasUnit === 'inch' || currentProject.canvasUnit === 'cm' ? 2 : 1));
                              }
                              updateFrameGeometry(activeSpread.id, selectedFrame.id, updates);
                            }}
                            min={0.1}
                            max={2000}
                            step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 1}
                            precision={currentProject.canvasUnit === 'inch' || currentProject.canvasUnit === 'cm' ? 2 : 1}
                          />
                        </div>
                      </div>

                      {/* X & Y Position Inputs in 2 columns */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Position X</div>
                          <NumberInput
                            value={selectedFrame.x}
                            onChange={(newX) => updateFrameGeometry(activeSpread.id, selectedFrame.id, { x: newX })}
                            step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 1}
                            precision={currentProject.canvasUnit === 'inch' || currentProject.canvasUnit === 'cm' ? 2 : 1}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>Position Y</div>
                          <NumberInput
                            value={selectedFrame.y}
                            onChange={(newY) => updateFrameGeometry(activeSpread.id, selectedFrame.id, { y: newY })}
                            step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 1}
                            precision={currentProject.canvasUnit === 'inch' || currentProject.canvasUnit === 'cm' ? 2 : 1}
                          />
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
                              precision={0}
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

                      {/* Safe Margin Alignment Grid for Single Frame */}
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>Align to Safe Margin</span>
                          <span style={{ fontSize: '9px', color: 'rgba(59, 130, 246, 0.9)', fontWeight: 500 }}>Blue Guides</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'left')} title="Align Left to Blue Safe Margin">⇤ Left</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'center')} title="Align Center Horizontal to Page Center">⇥⇤ Center H</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'right')} title="Align Right to Blue Safe Margin">⇥ Right</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'top')} title="Align Top to Blue Safe Margin">⤒ Top</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'middle')} title="Align Middle Vertical to Page Middle">⤓⤒ Center V</button>
                          <button type="button" className={styles.multiActionBtn} onClick={() => alignSelectedFrames(activeSpread.id, 'bottom')} title="Align Bottom to Blue Safe Margin">⤓ Bottom</button>
                        </div>
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
                        onChange={(val) => {
                          updateSafeArea(val);
                          updateProjectMargin(val);
                        }}
                        min={0}
                        max={999}
                        step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                      />
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentProject.canvasUnit}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }} title="Additional breathing room distance of photos inside the blue safe area margin">
                        Inner Safe Inset
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '110px' }}>
                        <NumberInput
                          value={activeSpread?.photoInset ?? (currentProject.photoInset || 0)}
                          onChange={(val) => {
                            updatePhotoInset(val, 'all');
                            updateProjectPhotoInset(val);
                          }}
                          min={0}
                          max={999}
                          step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                        />
                        <button
                          type="button"
                          onClick={() => setIsInsetExpanded(!isInsetExpanded)}
                          title="Toggle 4-side individual edge insets (Top, Bottom, Left, Right)"
                          style={{
                            background: isInsetExpanded ? 'var(--color-accent)' : 'transparent',
                            color: isInsetExpanded ? '#fff' : 'var(--color-text-muted)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '3px',
                            padding: '2px 4px',
                            fontSize: '9px',
                            cursor: 'pointer',
                          }}
                        >
                          4S
                        </button>
                      </div>
                    </div>

                    {isInsetExpanded && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '6px',
                          background: 'rgba(0,0,0,0.15)',
                          padding: '6px',
                          borderRadius: '4px',
                          marginTop: '2px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Top</span>
                          <NumberInput
                            value={activeSpread?.photoInsetTop ?? activeSpread?.photoInset ?? 0}
                            onChange={(val) => updatePhotoInset(val, 'top')}
                            min={0}
                            max={999}
                            step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Bottom</span>
                          <NumberInput
                            value={activeSpread?.photoInsetBottom ?? activeSpread?.photoInset ?? 0}
                            onChange={(val) => updatePhotoInset(val, 'bottom')}
                            min={0}
                            max={999}
                            step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Left</span>
                          <NumberInput
                            value={activeSpread?.photoInsetLeft ?? activeSpread?.photoInset ?? 0}
                            onChange={(val) => updatePhotoInset(val, 'left')}
                            min={0}
                            max={999}
                            step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Right</span>
                          <NumberInput
                            value={activeSpread?.photoInsetRight ?? activeSpread?.photoInset ?? 0}
                            onChange={(val) => updatePhotoInset(val, 'right')}
                            min={0}
                            max={999}
                            step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Bleed Allowance</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '110px' }}>
                      <NumberInput
                        value={activeSpread?.bleed ?? 3}
                        onChange={(val) => updateBleed(val)}
                        min={0}
                        max={999}
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

                {/* Smart Snapping Switch & Granular Config Link */}
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Smart Magnetic Snapping</span>
                    <Switch checked={snapEnabled} onChange={toggleSnap} size="sm" />
                  </div>
                  <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => openSettings('snapping')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-accent)',
                        fontSize: '10px',
                        cursor: 'pointer',
                        padding: '2px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        textDecoration: 'none',
                      }}
                      title="Configure Granular Snapping Targets in Settings"
                    >
                      <span>⚙ Configure Snapping Targets...</span>
                    </button>
                  </div>
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

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className={styles.toastBanner}>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Unsaved Changes Confirmation Dialog */}
      <ConfirmDialog
        isOpen={pendingSafeAction !== null}
        title="Unsaved Changes"
        message={`You have unsaved changes in "${currentProject?.name}". Do you want to save them before leaving?`}
        detail="If you leave without saving, your recent page layouts and edits since the last save will be lost."
        confirmText="Save & Continue"
        secondaryText="Don't Save"
        cancelText="Cancel"
        variant="warning"
        onConfirm={async () => {
          await saveAlbumToDb();
          const act = pendingSafeAction;
          setPendingSafeAction(null);
          if (act) await act();
        }}
        onSecondary={async () => {
          const act = pendingSafeAction;
          setPendingSafeAction(null);
          if (act) await act();
        }}
        onCancel={() => setPendingSafeAction(null)}
      />

      {/* Phase 8: High-Resolution Print Export Dialog */}
      <ExportAlbumDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onStartExport={handleStartExport}
      />

      {/* Phase 8: Export Progress Modal */}
      <ExportProgressModal
        isOpen={isExportProgressOpen}
        outputDir={activeExportDir}
        onClose={() => setIsExportProgressOpen(false)}
      />
    </div>
  );
}
