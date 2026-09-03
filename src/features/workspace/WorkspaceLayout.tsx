import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { NumberInput } from '../../components/ui/NumberInput';
import { Switch } from '../../components/ui/Switch';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { useAppStore } from '../../stores/appStore';
import { useProjectStore } from '../../stores/projectStore';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { usePhotoStore } from '../../stores/photoStore';
import { useHistoryStore } from '../../stores/historyStore';
import { useAutoSave } from '../persistence/useAutoSave';
import { useTauriInfo } from '../../hooks/useTauriInfo';
import { WelcomeScreen } from './WelcomeScreen';
import { formatDimensions, convertUnit } from '../../domain/units';
import { getAllAlbumSpreads } from '../../domain/album';
import { clampCropTransform, zoomCropAtPoint, PhotoFrameElement } from '../../domain/editor';
import { FilmstripTray } from '../photos/FilmstripTray';
import { RelinkDialog } from '../photos/RelinkDialog';
import { KonvaEditorCanvas } from '../editor/KonvaEditorCanvas';
import { FrameToolbar } from '../editor/FrameToolbar';
import { TypographyPanel } from '../editor/TypographyPanel';
import { TextNodeElement } from '../../domain/text';
import { PageNavigator } from '../album/PageNavigator';
import { TemplatesPanel } from '../templates/TemplatesPanel';
import { LockedPhotosPanel } from '../editor/LockedPhotosPanel';
import { invoke } from '@tauri-apps/api/core';
import { ExportAlbumDialog, ExportOptions } from '../export/ExportAlbumDialog';
import { ExportProgressModal } from '../export/ExportProgressModal';
import styles from './WorkspaceLayout.module.css';

export function WorkspaceLayout() {
  useAutoSave();

  const openAbout = useAppStore((s) => s.openAbout);
  const openSettings = useAppStore((s) => s.openSettings);

  const currentProject = useProjectStore((s) => s.currentProject);
  const openNewProject = useProjectStore((s) => s.openNewProject);
  const closeProject = useProjectStore((s) => s.closeProject);
  const updateProjectName = useProjectStore((s) => s.updateProjectName);
  const updateProjectBackgroundColor = useProjectStore((s) => s.updateProjectBackgroundColor);
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
  const updateBleed = useAlbumStore((s) => s.updateBleed);
  const updateSpreadSpacing = useAlbumStore((s) => s.updateSpreadSpacing);
  const updateSafeArea = useAlbumStore((s) => s.updateSafeArea);
  const updateSpreadBackgroundColor = useAlbumStore((s) => s.updateSpreadBackgroundColor);
  const applyBackgroundColorToAllSpreads = useAlbumStore((s) => s.applyBackgroundColorToAllSpreads);
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
  const resetSelectedRatio = useEditorStore((s) => s.resetSelectedRatio);
  const resetCrop = useEditorStore((s) => s.resetCrop);
  const resetSelectedCrop = useEditorStore((s) => s.resetSelectedCrop);
  const rotateSelectedFrames = useEditorStore((s) => s.rotateSelectedFrames);
  const selectionGroupRotation = useEditorStore((s) => s.selectionGroupRotation);
  const editingCropFrameId = useEditorStore((s) => s.editingCropFrameId);
  const enterCropMode = useEditorStore((s) => s.enterCropMode);
  const exitCropMode = useEditorStore((s) => s.exitCropMode);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const alignSelectedFrames = useEditorStore((s) => s.alignSelectedFrames);
  const distributeSelectedFrames = useEditorStore((s) => s.distributeSelectedFrames);
  const applyFixedGapToSelected = useEditorStore((s) => s.applyFixedGapToSelected);
  const matchSelectedDimensions = useEditorStore((s) => s.matchSelectedDimensions);
  const toggleLockSelectedFrames = useEditorStore((s) => s.toggleLockSelectedFrames);
  const addTextToSpread = useEditorStore((s) => s.addTextToSpread);
  const setEditingTextElementId = useEditorStore((s) => s.setEditingTextElementId);

  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isRatioLocked, setIsRatioLocked] = useState<boolean>(true);
  const [customGapValue, setCustomGapValue] = useState<number>(currentProject?.spacingValue ?? 5);
  const [inspectorTab, setInspectorTab] = useState<'properties' | 'smart_layout' | 'locks'>('properties');
  const [bgScope, setBgScope] = useState<'spread' | 'left' | 'right'>('spread');
  const [isMarginExpanded, setIsMarginExpanded] = useState<boolean>(false);

  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const propertyListRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Auto-scroll Properties Panel smoothly to the very top whenever any frame (photo or text) or selection changes
  useEffect(() => {
    if (selectedFrameIds.length > 0) {
      if (inspectorTab !== 'properties') {
        setInspectorTab('properties');
      }
      if (!isPropertiesOpen) {
        setIsPropertiesOpen(true);
      }
      // Smoothly scroll the entire property list to the top so the full card and all properties are completely visible
      const timer = setTimeout(() => {
        if (propertyListRef.current) {
          propertyListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedFrameIds]);

  // Inline Project Rename State (Top Bar & Inspector)
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [isEditingInspectorName, setIsEditingInspectorName] = useState(false);
  const [editingInspectorName, setEditingInspectorName] = useState('');

  const handleCommitProjectName = async () => {
    const clean = editingProjectName.trim();
    if (clean && currentProject && clean !== currentProject.name) {
      try {
        await updateProjectName(clean);
        showToast(`Renamed project to: ${clean}`);
      } catch (err: any) {
        showToast(`⚠️ ${err?.message || err || 'Failed to rename project'}`);
      }
    }
    setIsEditingProjectName(false);
  };

  const handleCommitInspectorName = async () => {
    const clean = editingInspectorName.trim();
    if (clean && currentProject && clean !== currentProject.name) {
      try {
        await updateProjectName(clean);
        showToast(`Renamed project to: ${clean}`);
      } catch (err: any) {
        showToast(`⚠️ ${err?.message || err || 'Failed to rename project'}`);
      }
    }
    setIsEditingInspectorName(false);
  };

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
      const errStr = String(err?.message || err || '');
      if (errStr.toLowerCase().includes('cancel')) {
        // User intentionally cancelled; modal displays cancellation state
        return;
      }
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

  const allSpreads = currentAlbum ? getAllAlbumSpreads(currentAlbum) : [];
  const activeSpread = allSpreads.find((s) => s.id === activeSpreadId) || allSpreads[0];

  // Global Keyboard Shortcuts for App
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when typing inside input / textarea / select / contentEditable
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 0. F1 or ? -> Open Keyboard Shortcuts Dialog
      if (e.key === 'F1' || (!cmdOrCtrl && !e.altKey && e.key === '?')) {
        e.preventDefault();
        openSettings('shortcuts');
        return;
      }

      // 1. Single Key: P -> Open Properties Panel
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setIsPropertiesOpen(true);
        setInspectorTab('properties');
        showToast('📋 Properties Panel');
        return;
      }

      // 2. Single Key: L -> Open Lock Panel
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        setIsPropertiesOpen(true);
        setInspectorTab('locks');
        showToast('🔒 Locked Photos & Elements Panel');
        return;
      }

      // 3. Single Key: G -> Open Smart Layout Panel
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        setIsPropertiesOpen(true);
        setInspectorTab('smart_layout');
        showToast('✨ Smart Layout Panel');
        return;
      }

      // 3. Ctrl + Alt + L -> Unlock all items on spread
      if (cmdOrCtrl && e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (activeSpread) {
          const lockedCount = (activeSpread.elements || []).filter((el) => el.locked).length;
          if (lockedCount > 0) {
            useEditorStore.getState().unlockAllFramesOnSpread(activeSpread.id);
            showToast(`🔓 Unlocked all ${lockedCount} element(s) on spread`);
          } else {
            showToast('⚠️ No locked elements found on spread');
          }
        }
        return;
      }

      // 4. Ctrl + L -> Lock selected images / texts
      if (cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (activeSpread) {
          if (selectedFrameIds.length > 0) {
            toggleLockSelectedFrames(activeSpread.id, true);
            showToast(`🔒 Locked ${selectedFrameIds.length} selected element(s)`);
          } else {
            showToast('⚠️ Select photo(s) or text(s) to lock (Ctrl+L)');
          }
        }
        return;
      }

      // 5. Alt + L (or Ctrl + Shift + L) -> Unlock selected images / texts
      if ((e.altKey && (e.key === 'l' || e.key === 'L')) || (cmdOrCtrl && e.shiftKey && (e.key === 'l' || e.key === 'L'))) {
        e.preventDefault();
        if (activeSpread) {
          if (selectedFrameIds.length > 0) {
            toggleLockSelectedFrames(activeSpread.id, false);
            showToast(`🔓 Unlocked ${selectedFrameIds.length} selected element(s)`);
          } else {
            const lockedCount = (activeSpread.elements || []).filter((el) => el.locked).length;
            if (lockedCount > 0) {
              useEditorStore.getState().unlockAllFramesOnSpread(activeSpread.id);
              showToast(`🔓 Unlocked all ${lockedCount} element(s) on spread`);
            } else {
              showToast('⚠️ No locked elements found on spread');
            }
          }
        }
        return;
      }

      // 5. Single Key: T -> Add Text Box to Spread
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey && (e.key === 't' || e.key === 'T')) {
        if (activeSpreadId) {
          e.preventDefault();
          const newId = addTextToSpread(activeSpreadId);
          if (newId) {
            setEditingTextElementId(newId);
            showToast('✓ Added Text Box. Double-click or type to edit.');
          }
        }
        return;
      }

      // Below shortcuts require cmdOrCtrl:
      if (!cmdOrCtrl) return;

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
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        // If hovering over filmstrip, select all photos
        const isHoveredOnFilmstrip = Boolean(document.querySelector('[aria-label="Photo Library Filmstrip"]:hover'));
        if (isHoveredOnFilmstrip) {
          usePhotoStore.getState().selectAll();
          useEditorStore.getState().clearSelection();
        } else {
          // Select all frames on active spread
          const album = useAlbumStore.getState().currentAlbum;
          const curSpreadId = useAlbumStore.getState().activeSpreadId;
          const spreads = album ? getAllAlbumSpreads(album) : [];
          const curSpread = spreads.find((s) => s.id === curSpreadId) || spreads[0];
          if (curSpread && curSpread.elements && curSpread.elements.length > 0) {
            useEditorStore.getState().selectFrames(curSpread.elements.map((f) => f.id));
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
    [undo, redo, saveProject, exportProjectAsAfsn, importProjectFromAfsn, openNewProject, confirmSafeAction, showToast, activeSpreadId, activeSpread, selectedFrameIds, toggleLockSelectedFrames, addTextToSpread, setEditingTextElementId, currentProject]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const spreadW = currentProject ? currentProject.canvasWidth * 2 : 16;
  const spreadH = currentProject ? currentProject.canvasHeight : 8;

  return (
    <div className={styles.workspace}>
      {/* Top Main Toolbar */}
      <header className={styles.toolbar} data-tauri-drag-region>
        {/* Left Section: File Actions & Menus */}
        <div className={styles.toolbarSection}>
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

                    <div className={styles.menuDivider} />

                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => {
                        setIsFileMenuOpen(false);
                        openSettings('shortcuts');
                      }}
                    >
                      <span>⌨️ Keyboard Shortcuts...</span>
                      <span className={styles.shortcutText}>F1</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {currentProject && (
            <div className={styles.activeProjectBadge}>
              {isEditingProjectName ? (
                <input
                  type="text"
                  className={styles.projectNameInput}
                  value={editingProjectName}
                  autoFocus
                  onChange={(e) => setEditingProjectName(e.target.value)}
                  onBlur={handleCommitProjectName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitProjectName();
                    if (e.key === 'Escape') setIsEditingProjectName(false);
                  }}
                />
              ) : (
                <span
                  className={styles.projectNameText}
                  onClick={() => {
                    setEditingProjectName(currentProject.name);
                    setIsEditingProjectName(true);
                  }}
                  title="Click to rename project"
                >
                  {currentProject.name} <span style={{ fontSize: '10px', opacity: 0.6 }}>✏️</span>
                </span>
              )}
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
                  className={`${styles.historyBtn} ${
                    saveStatus === 'unsaved'
                      ? styles.historyBtnUnsaved
                      : saveStatus === 'saving'
                      ? styles.historyBtnSaving
                      : ''
                  }`}
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
                  title={
                    saveStatus === 'unsaved'
                      ? 'Unsaved changes (Click to Save / Ctrl+S)'
                      : saveStatus === 'saving'
                      ? 'Saving changes...'
                      : `All changes saved${lastSavedAt ? ` (${lastSavedAt})` : ''} (Ctrl+S)`
                  }
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

              <div className={styles.toolbarSeparator} />

              {/* Add Text Tool Button */}
              <button
                type="button"
                className={styles.toolButton}
                onClick={() => {
                  if (!activeSpreadId) return;
                  const newId = addTextToSpread(activeSpreadId);
                  if (newId) {
                    setEditingTextElementId(newId);
                    showToast('✓ Added Text Box. Double-click or type to edit.');
                  }
                }}
                title="Add Text Box (T)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 8px',
                  fontWeight: 600,
                  fontSize: '12px',
                  color: 'var(--color-accent, #3b82f6)',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line x1="9" y1="20" x2="15" y2="20" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
                <span>Add Text</span>
              </button>

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
            onClick={() => openSettings('snapping')}
            title="Open Settings"
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
                onToast={showToast}
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
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {/* Tab 1: Properties */}
              <button
                type="button"
                onClick={() => setInspectorTab('properties')}
                style={{
                  width: '32px',
                  height: '30px',
                  background: inspectorTab === 'properties' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                  border: inspectorTab === 'properties' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                  color: inspectorTab === 'properties' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                title="Properties — Frame, Spread & Margin Settings (P)"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14" />
                  <line x1="4" y1="10" x2="4" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12" y2="3" />
                  <line x1="20" y1="21" x2="20" y2="16" />
                  <line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" />
                  <line x1="9" y1="8" x2="15" y2="8" />
                  <line x1="17" y1="16" x2="23" y2="16" />
                </svg>
              </button>

              {/* Tab 2: Smart Layout */}
              <button
                type="button"
                onClick={() => setInspectorTab('smart_layout')}
                style={{
                  width: '32px',
                  height: '30px',
                  background: inspectorTab === 'smart_layout' ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                  border: inspectorTab === 'smart_layout' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                  color: inspectorTab === 'smart_layout' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                title="Smart Layout — Adaptive Templates & Dynamic Variations (G)"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                </svg>
              </button>

              {/* Tab 3: Locked Photos Management */}
              <button
                type="button"
                onClick={() => setInspectorTab('locks')}
                style={{
                  width: '32px',
                  height: '30px',
                  background: inspectorTab === 'locks' ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
                  border: inspectorTab === 'locks' ? '1px solid #f59e0b' : '1px solid transparent',
                  color: inspectorTab === 'locks' ? '#fbbf24' : 'var(--color-text-muted)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
                title="Locked Photos & Elements — Fixed Frames Management (L)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {(() => {
                  const lockCount = (activeSpread?.elements || []).filter((f) => f.locked).length;
                  if (lockCount === 0) return null;
                  return (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        background: '#f59e0b',
                        color: '#000000',
                        fontSize: '9px',
                        fontWeight: 800,
                        minWidth: '14px',
                        height: '14px',
                        padding: '0 3px',
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 6px rgba(0,0,0,0.5)',
                      }}
                    >
                      {lockCount}
                    </span>
                  );
                })()}
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
          ) : inspectorTab === 'locks' ? (
            <LockedPhotosPanel onToast={(msg) => showToast(msg)} />
          ) : (
            <div ref={propertyListRef} className={styles.propertyList}>
              {/* Selected Photo Frame Properties / Multi-Selection Controls (Placed at TOP when active) */}
              {(() => {
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
                      {(() => {
                        const selectedElements = (activeSpread?.elements || []).filter((f) => selectedFrameIds.includes(f.id));
                        const hasUnlocked = selectedElements.some((f) => !f.locked);
                        const isAllLocked = selectedElements.length > 0 && selectedElements.every((f) => f.locked);

                        return (
                          <div className={styles.propTitle} style={{ color: isAllLocked ? '#f59e0b' : 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', marginBottom: '12px' }}>
                            <span>Multi-Selection ({selectedFrameIds.length} Frames)</span>
                            <button
                              type="button"
                              onClick={() => {
                                toggleLockSelectedFrames(activeSpread.id);
                                showToast(hasUnlocked ? `🔒 Locked ${selectedFrameIds.length} frames` : `🔓 Unlocked ${selectedFrameIds.length} frames`);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                fontSize: '10px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                background: isAllLocked ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                                border: isAllLocked ? '1px solid #f59e0b' : '1px solid var(--color-border)',
                                color: isAllLocked ? '#fbbf24' : 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              title={hasUnlocked ? 'Lock selected frames (Ctrl+L)' : 'Unlock selected frames (Alt+L)'}
                            >
                              <span>{isAllLocked ? '🔒' : '🔓'}</span>
                              <span>{isAllLocked ? 'Locked' : hasUnlocked ? 'Lock' : 'Unlock'}</span>
                            </button>
                          </div>
                        );
                      })()}

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

                      {/* Multi-Frame Rotation & Transform */}
                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                          Rotation & Transform
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                          <button
                            type="button"
                            className={styles.multiActionBtn}
                            onClick={() => rotateSelectedFrames(activeSpread.id, 'ccw')}
                            title="Rotate all selected frames 90° Counter-Clockwise (Shift+R)"
                          >
                            ↺ 90° CCW
                          </button>
                          <button
                            type="button"
                            className={styles.multiActionBtn}
                            onClick={() => rotateSelectedFrames(activeSpread.id, 'cw')}
                            title="Rotate all selected frames 90° Clockwise (R)"
                          >
                            ↻ 90° CW
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <NumberInput
                              value={
                                selectionGroupRotation ??
                                (selectedFrameIds.length > 0
                                  ? ((activeSpread.elements || []).find((f) => f.id === selectedFrameIds[0])?.rotation || 0)
                                  : 0)
                              }
                              onChange={(newRot) =>
                                rotateSelectedFrames(activeSpread.id, newRot, true)
                              }
                              min={-360}
                              max={360}
                              step={1}
                              precision={0}
                            />
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>°</span>
                          </div>
                          <button
                            type="button"
                            className={styles.multiActionBtn}
                            onClick={() => rotateSelectedFrames(activeSpread.id, 0, true)}
                            title="Reset rotation of all selected frames to 0°"
                            style={{ padding: '4px 10px' }}
                          >
                            ↺ 0°
                          </button>
                        </div>

                        {/* Multi-Selection Dual Entity Reset */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <button
                            type="button"
                            className={styles.multiActionBtn}
                            onClick={() => resetSelectedRatio(activeSpread.id)}
                            title="Restore original photo aspect ratios (3:2 / 4:3) for all selected frames"
                          >
                            ↺ Reset Ratio
                          </button>
                          <button
                            type="button"
                            className={styles.multiActionBtn}
                            onClick={() => resetSelectedCrop(activeSpread.id)}
                            title="Reset pan/zoom crop to 1.0x centered for all selected frames"
                          >
                            ↺ Reset Crop
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // SINGLE FRAME OR TEXT ELEMENT SELECTION MODE
                const selectedFrame = (activeSpread?.elements || []).find((f) => f.id === selectedFrameIds[0]);
                if (!selectedFrame) return null;

                if (selectedFrame.type === 'text') {
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
                      <div className={styles.propTitle} style={{ color: selectedFrame.locked ? '#f59e0b' : 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', marginBottom: '12px' }}>
                        <span>Selected Text Box</span>
                        <button
                          type="button"
                          onClick={() => {
                            toggleLockSelectedFrames(activeSpread.id);
                            showToast(selectedFrame.locked ? '🔓 Text unlocked' : '🔒 Text locked');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontWeight: 600,
                            borderRadius: '4px',
                            background: selectedFrame.locked ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                            border: selectedFrame.locked ? '1px solid #f59e0b' : '1px solid var(--color-border)',
                            color: selectedFrame.locked ? '#fbbf24' : 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          title={selectedFrame.locked ? 'Unlock Text (Alt+L)' : 'Lock Text (Ctrl+L)'}
                        >
                          <span>{selectedFrame.locked ? '🔒' : '🔓'}</span>
                          <span>{selectedFrame.locked ? 'Locked' : 'Lock'}</span>
                        </button>
                      </div>

                      <TypographyPanel element={selectedFrame as TextNodeElement} onToast={showToast} />
                    </div>
                  );
                }

                const isEditingCrop = editingCropFrameId === selectedFrame.id;
                const cropTransform = clampCropTransform(selectedFrame as PhotoFrameElement);

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
                    <div className={styles.propTitle} style={{ color: selectedFrame.locked ? '#f59e0b' : 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', marginBottom: '12px' }}>
                      <span>Selected Photo Frame</span>
                      <button
                        type="button"
                        onClick={() => {
                          toggleLockSelectedFrames(activeSpread.id);
                          showToast(selectedFrame.locked ? '🔓 Photo unlocked' : '🔒 Photo locked');
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          fontSize: '10px',
                          fontWeight: 600,
                          borderRadius: '4px',
                          background: selectedFrame.locked ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                          border: selectedFrame.locked ? '1px solid #f59e0b' : '1px solid var(--color-border)',
                          color: selectedFrame.locked ? '#fbbf24' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title={selectedFrame.locked ? 'Unlock Photo (Alt+L)' : 'Lock Photo (Ctrl+L)'}
                      >
                        <span>{selectedFrame.locked ? '🔒' : '🔓'}</span>
                        <span>{selectedFrame.locked ? 'Locked' : 'Lock'}</span>
                      </button>
                    </div>

                    {/* Locked Notice Banner */}
                    {selectedFrame.locked && (
                      <div
                        style={{
                          marginBottom: '10px',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '11px',
                          color: '#fbbf24',
                        }}
                      >
                        <span style={{ fontSize: '13px' }}>🔒</span>
                        <span>This photo frame is locked against movements, smart layouts, shuffling, and deletion.</span>
                      </div>
                    )}

                    {/* Photo Crop Section */}
                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: isEditingCrop ? '#818cf8' : 'var(--color-text-secondary)' }}>
                          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
                        </svg>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: isEditingCrop ? '#818cf8' : 'var(--color-text-primary)' }}>
                          Photo Crop
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => (isEditingCrop ? exitCropMode() : enterCropMode(selectedFrame.id))}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          fontSize: '10px',
                          fontWeight: 700,
                          borderRadius: '999px',
                          background: isEditingCrop ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(255, 255, 255, 0.06)',
                          border: isEditingCrop ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--color-border)',
                          color: isEditingCrop ? '#ffffff' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          boxShadow: isEditingCrop ? '0 2px 8px rgba(99, 102, 241, 0.35)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                        title={isEditingCrop ? 'Finish Crop Mode (Enter / Esc)' : 'Edit photo crop'}
                      >
                        {isEditingCrop ? (
                          <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Done</span>
                          </>
                        ) : (
                          <span>Edit</span>
                        )}
                      </button>
                    </div>

                    {isEditingCrop && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginBottom: '10px',
                          padding: '10px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                          backgroundColor: 'rgba(99, 102, 241, 0.06)',
                        }}
                      >
                        {/* Zoom Header with % Pill */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          <span style={{ fontWeight: 600 }}>Zoom</span>
                          <span
                            style={{
                              padding: '2px 6px',
                              background: 'rgba(0, 0, 0, 0.35)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '4px',
                              color: '#f1f5f9',
                              fontSize: '10px',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {Math.round(cropTransform.cropScale * 100)}%
                          </span>
                        </div>

                        {/* Interactive Zoom Controls: [-] Slider [+] */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() =>
                              updateCrop(
                                activeSpread.id,
                                selectedFrame.id,
                                zoomCropAtPoint(
                                  selectedFrame,
                                  { x: selectedFrame.width / 2, y: selectedFrame.height / 2 },
                                  cropTransform.cropScale - 0.01
                                )
                              )
                            }
                            disabled={cropTransform.cropScale <= 1.0}
                            style={{
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              backgroundColor: 'rgba(255, 255, 255, 0.04)',
                              color: '#cbd5e1',
                              cursor: cropTransform.cropScale <= 1.0 ? 'not-allowed' : 'pointer',
                              opacity: cropTransform.cropScale <= 1.0 ? 0.35 : 1,
                              padding: 0,
                            }}
                            title="Zoom Out (−1%)"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </button>

                          <input
                            type="range"
                            min={1}
                            max={3.5}
                            step={0.01}
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
                            style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }}
                          />

                          <button
                            type="button"
                            onClick={() =>
                              updateCrop(
                                activeSpread.id,
                                selectedFrame.id,
                                zoomCropAtPoint(
                                  selectedFrame,
                                  { x: selectedFrame.width / 2, y: selectedFrame.height / 2 },
                                  cropTransform.cropScale + 0.01
                                )
                              )
                            }
                            disabled={cropTransform.cropScale >= 3.5}
                            style={{
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '50%',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              backgroundColor: 'rgba(255, 255, 255, 0.04)',
                              color: '#cbd5e1',
                              cursor: cropTransform.cropScale >= 3.5 ? 'not-allowed' : 'pointer',
                              opacity: cropTransform.cropScale >= 3.5 ? 0.35 : 1,
                              padding: 0,
                            }}
                            title="Zoom In (+1%)"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </button>
                        </div>

                        {/* Reset Action Button */}
                        <div style={{ marginTop: '2px' }}>
                          <button
                            type="button"
                            onClick={() => resetCrop(activeSpread.id, selectedFrame.id)}
                            style={{
                              width: '100%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '5px 8px',
                              fontSize: '10px',
                              fontWeight: 600,
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-secondary)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title="Reset Crop Position & Scale (Center Fit)"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <path d="M3 3v5h5" />
                            </svg>
                            <span>Reset Position & Scale</span>
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
                              value={selectedFrame.borderWidth || (currentProject.canvasUnit === 'inch' ? 0.04 : currentProject.canvasUnit === 'cm' ? 0.1 : 1)}
                              onChange={(val) => updateFrameGeometry(activeSpread.id, selectedFrame.id, { borderWidth: val })}
                              min={currentProject.canvasUnit === 'inch' ? 0.01 : currentProject.canvasUnit === 'cm' ? 0.01 : 0.1}
                              max={currentProject.canvasUnit === 'inch' ? 2 : currentProject.canvasUnit === 'cm' ? 5 : 50}
                              step={currentProject.canvasUnit === 'inch' ? 0.01 : currentProject.canvasUnit === 'cm' ? 0.05 : 0.5}
                              precision={currentProject.canvasUnit === 'inch' || currentProject.canvasUnit === 'cm' ? 2 : 1}
                            />
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentProject.canvasUnit}</span>
                          </div>
                        </div>

                        {/* Border Color */}
                        <div style={{ marginTop: '8px' }}>
                          <ColorPicker
                            value={selectedFrame.borderColor || '#FFFFFF'}
                            onChange={(newColor) => updateFrameGeometry(activeSpread.id, selectedFrame.id, { borderColor: newColor })}
                            label="Border Color"
                          />
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
                              onChange={(newRot) => rotateSelectedFrames(activeSpread.id, newRot, true)}
                              min={-360}
                              max={360}
                              step={1}
                              precision={0}
                            />
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>°</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => rotateSelectedFrames(activeSpread.id, 0, true)}
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
                <div className={styles.propTitle}>Project Details</div>
                <div className={styles.propRow}>
                  <span>Name</span>
                  {isEditingInspectorName ? (
                    <input
                      type="text"
                      className={styles.projectNameInput}
                      style={{ width: '130px', textAlign: 'right' }}
                      value={editingInspectorName}
                      autoFocus
                      onChange={(e) => setEditingInspectorName(e.target.value)}
                      onBlur={handleCommitInspectorName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitInspectorName();
                        if (e.key === 'Escape') setIsEditingInspectorName(false);
                      }}
                    />
                  ) : (
                    <div
                      className={styles.propNameRow}
                      onClick={() => {
                        setEditingInspectorName(currentProject.name);
                        setIsEditingInspectorName(true);
                      }}
                      title="Click to edit project name"
                    >
                      <span className={styles.propValue} style={{ cursor: 'pointer' }}>
                        {currentProject.name}
                      </span>
                      <button
                        type="button"
                        className={styles.propEditBtn}
                        title="Edit project name"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingInspectorName(currentProject.name);
                          setIsEditingInspectorName(true);
                        }}
                      >
                        ✏️
                      </button>
                    </div>
                  )}
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

              {/* Background Color Section */}
              {(() => {
                const activeSpreadBg = activeSpread?.backgroundColor || currentProject?.backgroundColor || '#FFFFFF';
                const currentScopeColor =
                  bgScope === 'left'
                    ? (activeSpread?.leftPage?.backgroundColor || activeSpreadBg)
                    : bgScope === 'right'
                    ? (activeSpread?.rightPage?.backgroundColor || activeSpreadBg)
                    : activeSpreadBg;

                return (
                  <div className={styles.propSection}>
                    <div className={styles.propTitle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Background Color</span>
                    </div>

                    {/* Scope Selector (Full Spread, Left Page, Right Page) */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '4px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '3px',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '10px',
                      }}
                    >
                      <button
                        type="button"
                        style={{
                          padding: '5px 4px',
                          fontSize: '11px',
                          fontWeight: bgScope === 'spread' ? 600 : 400,
                          color: bgScope === 'spread' ? '#ffffff' : 'var(--color-text-secondary)',
                          backgroundColor: bgScope === 'spread' ? 'var(--color-accent)' : 'transparent',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => setBgScope('spread')}
                        title="Apply background color to the entire canvas (both pages & spine)"
                      >
                        ◫ Spread
                      </button>
                      <button
                        type="button"
                        style={{
                          padding: '5px 4px',
                          fontSize: '11px',
                          fontWeight: bgScope === 'left' ? 600 : 400,
                          color: bgScope === 'left' ? '#ffffff' : 'var(--color-text-secondary)',
                          backgroundColor: bgScope === 'left' ? 'var(--color-accent)' : 'transparent',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => setBgScope('left')}
                        title="Apply background color to Left Page only"
                      >
                        ◧ Left
                      </button>
                      <button
                        type="button"
                        style={{
                          padding: '5px 4px',
                          fontSize: '11px',
                          fontWeight: bgScope === 'right' ? 600 : 400,
                          color: bgScope === 'right' ? '#ffffff' : 'var(--color-text-secondary)',
                          backgroundColor: bgScope === 'right' ? 'var(--color-accent)' : 'transparent',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => setBgScope('right')}
                        title="Apply background color to Right Page only"
                      >
                        ◨ Right
                      </button>
                    </div>

                    {/* Color Swatch, Hex, Eyedropper & Palette */}
                    <div style={{ marginBottom: '12px' }}>
                      <ColorPicker
                        value={currentScopeColor}
                        onChange={(newColor) => {
                          if (activeSpread) {
                            updateSpreadBackgroundColor(activeSpread.id, newColor, bgScope);
                          }
                        }}
                        presetColors={[
                          '#FFFFFF', '#F8FAFC', '#FDFBF7', '#E2E8F0', '#CBD5E1', '#94A3B8',
                          '#64748B', '#475569', '#334155', '#1E293B', '#0F172A', '#000000'
                        ]}
                      />
                    </div>

                    {/* Quick Propagation Actions */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <button
                        type="button"
                        className={styles.toolBtn}
                        style={{
                          fontSize: '10px',
                          padding: '5px 6px',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        }}
                        onClick={() => {
                          applyBackgroundColorToAllSpreads(currentScopeColor);
                          showToast(`Applied ${currentScopeColor} to all spreads`);
                        }}
                        title="Apply current color to all spreads in the album"
                      >
                        Apply to All Spreads
                      </button>
                      <button
                        type="button"
                        className={styles.toolBtn}
                        style={{
                          fontSize: '10px',
                          padding: '5px 6px',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          color: 'var(--color-accent)',
                        }}
                        onClick={async () => {
                          await updateProjectBackgroundColor(currentScopeColor);
                          showToast(`Set ${currentScopeColor} as project default`);
                        }}
                        title="Set this color as default for newly created spreads & project settings"
                      >
                        Set as Default
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Photo Spacing & Default Gap Section (Interactive rule for Project Spacing) */}
              <div className={styles.propSection}>
                <div className={styles.propTitle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Photo Spacing</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Photo Gap</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100px' }}>
                      <NumberInput
                        value={activeSpread?.spacingValue ?? currentProject.spacingValue}
                        onChange={(val) => {
                          const num = Math.max(0, val);
                          const unit = activeSpread?.spacingUnit ?? currentProject.spacingUnit;
                          updateSpreadSpacing(num, unit);
                          setCustomGapValue(num);
                        }}
                        min={0}
                        max={100}
                        step={(activeSpread?.spacingUnit ?? currentProject.spacingUnit) === 'inch' ? 0.05 : (activeSpread?.spacingUnit ?? currentProject.spacingUnit) === 'cm' ? 0.1 : 0.5}
                        precision={(activeSpread?.spacingUnit ?? currentProject.spacingUnit) === 'inch' || (activeSpread?.spacingUnit ?? currentProject.spacingUnit) === 'cm' ? 2 : 1}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', minWidth: '24px' }}>
                        {activeSpread?.spacingUnit ?? currentProject.spacingUnit}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action to apply spread spacing to currently selected frames */}
                  {selectedFrameIds.length >= 2 && activeSpread && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                      <button
                        type="button"
                        className={styles.toolBtn}
                        style={{ flex: 1, fontSize: '10px', padding: '4px 6px', justifyContent: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-accent)' }}
                        onClick={() => {
                          const spreadGap = activeSpread.spacingValue ?? currentProject.spacingValue;
                          const spreadUnit = activeSpread.spacingUnit ?? currentProject.spacingUnit;
                          const gapInMm = convertUnit(spreadGap, spreadUnit, 'mm');
                          applyFixedGapToSelected(activeSpread.id, 'horizontal', gapInMm);
                        }}
                        title={`Apply gap (${activeSpread.spacingValue ?? currentProject.spacingValue} ${activeSpread.spacingUnit ?? currentProject.spacingUnit}) horizontally`}
                      >
                        ⇿ Apply Gap H
                      </button>
                      <button
                        type="button"
                        className={styles.toolBtn}
                        style={{ flex: 1, fontSize: '10px', padding: '4px 6px', justifyContent: 'center', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-accent)' }}
                        onClick={() => {
                          const spreadGap = activeSpread.spacingValue ?? currentProject.spacingValue;
                          const spreadUnit = activeSpread.spacingUnit ?? currentProject.spacingUnit;
                          const gapInMm = convertUnit(spreadGap, spreadUnit, 'mm');
                          applyFixedGapToSelected(activeSpread.id, 'vertical', gapInMm);
                        }}
                        title={`Apply gap (${activeSpread.spacingValue ?? currentProject.spacingValue} ${activeSpread.spacingUnit ?? currentProject.spacingUnit}) vertically`}
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

                {/* Modern Guide Overlay Visibility Toggles */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '4px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '3px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '12px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleGuide('safeArea')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '5px 4px',
                      fontSize: '10px',
                      fontWeight: showSafeAreaGuide ? 600 : 400,
                      color: showSafeAreaGuide ? '#ffffff' : 'var(--color-text-muted)',
                      backgroundColor: showSafeAreaGuide ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                      border: showSafeAreaGuide ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Toggle Blue Safe Zone Margin guide visibility"
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap' }}>Safe Zone</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleGuide('bleed')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '5px 4px',
                      fontSize: '10px',
                      fontWeight: showBleedGuide ? 600 : 400,
                      color: showBleedGuide ? '#ffffff' : 'var(--color-text-muted)',
                      backgroundColor: showBleedGuide ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
                      border: showBleedGuide ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid transparent',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Toggle Red Bleed Line guide visibility"
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap' }}>Bleed Cut</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleGuide('gutter')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      padding: '5px 4px',
                      fontSize: '10px',
                      fontWeight: showGutterGuide ? 600 : 400,
                      color: showGutterGuide ? '#ffffff' : 'var(--color-text-muted)',
                      backgroundColor: showGutterGuide ? 'rgba(129, 140, 248, 0.25)' : 'transparent',
                      border: showGutterGuide ? '1px solid rgba(129, 140, 248, 0.5)' : '1px solid transparent',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Toggle Center Spine Crease Guide visibility"
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#818cf8', display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap' }}>Spine Line</span>
                  </button>
                </div>

                {/* Safe Margin Card with Sleek 4S Multi-Directional Switcher */}
                <div
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0 }}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <rect x="7" y="7" width="10" height="10" strokeDasharray="3 2" />
                      </svg>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)' }} title="Safe margins protecting layout from print trimming">
                        Safe Margin
                      </span>
                    </div>

                    {/* Segmented Pill Switcher: All Sides vs 4 Sides */}
                    <div
                      style={{
                        display: 'inline-flex',
                        background: 'rgba(255, 255, 255, 0.06)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px',
                        gap: '2px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setIsMarginExpanded(false)}
                        style={{
                          padding: '3px 7px',
                          fontSize: '10px',
                          fontWeight: !isMarginExpanded ? 600 : 400,
                          color: !isMarginExpanded ? '#ffffff' : 'var(--color-text-muted)',
                          backgroundColor: !isMarginExpanded ? 'var(--color-accent)' : 'transparent',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title="Uniform safe margin for all sides (Linked)"
                      >
                        All Sides
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsMarginExpanded(true)}
                        style={{
                          padding: '3px 7px',
                          fontSize: '10px',
                          fontWeight: isMarginExpanded ? 600 : 400,
                          color: isMarginExpanded ? '#ffffff' : 'var(--color-text-muted)',
                          backgroundColor: isMarginExpanded ? 'var(--color-accent)' : 'transparent',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title="Individual 4-sided margins (Top, Bottom, Outside, Spine)"
                      >
                        4 Sides
                      </button>
                    </div>
                  </div>

                  {/* Margin Body */}
                  {!isMarginExpanded ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        Uniform Margin
                      </span>
                      <div style={{ width: '110px' }}>
                        <NumberInput
                          value={activeSpread?.safeArea ?? (currentProject.marginValue || 10)}
                          onChange={(val) => updateSafeArea(val, 'all')}
                          min={0}
                          max={999}
                          step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                          suffix={currentProject.canvasUnit}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '2px' }}>
                      {/* Top Margin */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase' }}>⤒ Top</span>
                        </div>
                        <NumberInput
                          value={activeSpread?.safeAreaTop ?? activeSpread?.safeArea ?? (currentProject.marginTop || 10)}
                          onChange={(val) => updateSafeArea(val, 'top')}
                          min={0}
                          max={999}
                          step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                          suffix={currentProject.canvasUnit}
                        />
                      </div>

                      {/* Bottom Margin */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase' }}>⤓ Bottom</span>
                        </div>
                        <NumberInput
                          value={activeSpread?.safeAreaBottom ?? activeSpread?.safeArea ?? (currentProject.marginBottom || 10)}
                          onChange={(val) => updateSafeArea(val, 'bottom')}
                          min={0}
                          max={999}
                          step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                          suffix={currentProject.canvasUnit}
                        />
                      </div>

                      {/* Outside Margin */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }} title="Outer trim margin (protected from paper cutting)">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase' }}>⇤ Outside</span>
                        </div>
                        <NumberInput
                          value={activeSpread?.safeAreaOutside ?? activeSpread?.safeArea ?? (currentProject.marginOutside || 10)}
                          onChange={(val) => updateSafeArea(val, 'outside')}
                          min={0}
                          max={999}
                          step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                          suffix={currentProject.canvasUnit}
                        />
                      </div>

                      {/* Spine Margin */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }} title="Spine crease margin. Set to 0 for seamless continuous layout across pages 1 and 2">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase' }}>⇥ Spine</span>
                        </div>
                        <NumberInput
                          value={activeSpread?.safeAreaSpine ?? activeSpread?.safeArea ?? (currentProject.marginSpine || 10)}
                          onChange={(val) => updateSafeArea(val, 'spine')}
                          min={0}
                          max={999}
                          step={currentProject.canvasUnit === 'inch' ? 0.05 : currentProject.canvasUnit === 'cm' ? 0.1 : 0.5}
                          suffix={currentProject.canvasUnit}
                        />
                      </div>
                    </div>
                  )}

                  {isMarginExpanded && (activeSpread?.safeAreaSpine === 0 || (!activeSpread && currentProject.marginSpine === 0)) && (
                    <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', padding: '5px 8px', borderRadius: '4px' }}>
                      ✓ Seamless Spread: Pages 1 & 2 connect continuously across spine (0 gap)
                    </div>
                  )}
                </div>

                {/* Bleed Allowance Card */}
                <div
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 12px',
                    marginBottom: '10px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Bleed Cut
                      </span>
                    </div>
                    <div style={{ width: '110px' }}>
                      <NumberInput
                        value={activeSpread?.bleed ?? currentProject.bleed ?? (currentProject.canvasUnit === 'inch' ? 0.125 : currentProject.canvasUnit === 'cm' ? 0.3 : 3.0)}
                        onChange={(val) => updateBleed(val)}
                        min={0}
                        max={999}
                        step={currentProject.canvasUnit === 'inch' ? 0.025 : currentProject.canvasUnit === 'cm' ? 0.05 : 0.5}
                        suffix={currentProject.canvasUnit}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Standard print bleed: {currentProject.canvasUnit === 'inch' ? '0.125 in (3.2 mm)' : currentProject.canvasUnit === 'cm' ? '0.3 cm (3 mm)' : '3 mm'}
                  </div>
                </div>

                {/* Smart Snapping Card & Granular Config Button */}
                <div className={styles.snappingCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={snapEnabled ? 'var(--color-accent)' : 'var(--color-text-muted)'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ transition: 'stroke 0.2s ease' }}
                      >
                        <path d="m6 15-3-3 6.36-6.36a3 3 0 0 1 4.24 0l1.41 1.41a3 3 0 0 1 0 4.24L8.65 17.65a3 3 0 0 1-4.24 0l-1.41-1.41" />
                        <path d="m15 6 3 3" />
                        <path d="m9 12 3 3" />
                      </svg>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        Smart Snapping
                      </span>
                    </div>
                    <Switch checked={snapEnabled} onChange={toggleSnap} size="sm" />
                  </div>

                  <button
                    type="button"
                    onClick={() => openSettings('snapping')}
                    className={styles.snappingConfigBtn}
                    title="Configure Granular Snapping Targets & Tolerance in Settings"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>Configure Snapping...</span>
                    </div>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
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
