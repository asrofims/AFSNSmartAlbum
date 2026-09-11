import { TextPreviewCanvas } from '../editor/TextPreviewCanvas';
import React, { useState, useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useAlbumStore } from '../../stores/albumStore';
import { useEditorStore } from '../../stores/editorStore';
import { usePhotoStore } from '../../stores/photoStore';
import { useProjectStore } from '../../stores/projectStore';
import { getAllAlbumSpreads, mergeFramePhotoAsset, Spread, getSpreadPageLabel, getSpreadLabel, getSpreadNumberLabel } from '../../domain/album';
import { PhotoFrameElement, calculateImageOffset, getCornerRadii, getPhotoAspect } from '../../domain/editor';
import { TextNodeElement } from '../../domain/text';
import { getProjectDimensionsInCanvasUnit } from '../../domain/templates';
import { Project } from '../../domain/project';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ContextMenu, ContextMenuItem } from '../../components/ui';
import styles from './PageNavigator.module.css';

function safeConvertFileSrc(filePath: string, version = ''): string {
  try {
    return `${convertFileSrc(filePath)}?v=${encodeURIComponent(version)}`;
  } catch {
    return filePath;
  }
}

export { getSpreadPageLabel, getSpreadLabel, getSpreadNumberLabel };

interface MiniSpreadPreviewProps {
  spread: Spread;
  project: Project;
}

function MiniSpreadPreview({ spread, project }: MiniSpreadPreviewProps) {
  const photos = usePhotoStore((s) => s.photos);
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));

  const dims = getProjectDimensionsInCanvasUnit(project);
  const totalPhysicalW = (spread.leftPage?.width || dims.pageWidth) + (spread.rightPage?.width || dims.pageWidth) + (spread.gutterWidth ?? dims.gutterWidth ?? 0);
  const totalPhysicalH = spread.leftPage?.height || dims.pageHeight || 200;

  // Mini thumbnail box dimensions inside preview container
  const previewBoxW = 136;
  const previewBoxH = 54;
  const scale = Math.min(previewBoxW / (totalPhysicalW || 400), previewBoxH / (totalPhysicalH || 200));

  const actualSpreadW = Math.round(totalPhysicalW * scale);
  const actualSpreadH = Math.round(totalPhysicalH * scale);
  const spineX = (spread.leftPage ? spread.leftPage.width : totalPhysicalW / 2) * scale;
  const spreadBgColor = spread.backgroundColor || project.backgroundColor || '#FFFFFF';
  const leftPageBg = spread.leftPage?.backgroundColor || spreadBgColor;
  const rightPageBg = spread.rightPage?.backgroundColor || spreadBgColor;

  return (
    <div
      className={styles.miniSpread}
      style={{
        position: 'relative',
        width: `${actualSpreadW}px`,
        height: `${actualSpreadH}px`,
        backgroundColor: spreadBgColor,
        overflow: 'hidden',
      }}
    >
      {/* Left Page Background */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${spineX}px`,
          backgroundColor: leftPageBg,
        }}
      />

      {/* Right Page Background */}
      <div
        style={{
          position: 'absolute',
          left: `${spineX}px`,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: rightPageBg,
        }}
      />

      {/* Spine / Gutter Guide */}
      <div
        style={{
          position: 'absolute',
          left: `${spineX}px`,
          top: 0,
          bottom: 0,
          width: '1px',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          zIndex: 1,
        }}
      />

      {/* Real-time Rendered Photo & Text Elements */}
      {(spread.elements || []).map((el) => {
        const x = el.x * scale;
        const y = el.y * scale;
        const w = el.width * scale;
        const h = el.height * scale;
        const rot = el.rotation || 0;

        if (el.type === 'text') {
          const textEl = el as TextNodeElement;
          return (
            <div
              key={textEl.id}
              style={{
                position: 'absolute',
                left: `${x}px`,
                top: `${y}px`,
                width: `${w}px`,
                height: `${h}px`,
                transform: rot ? `rotate(${rot}deg)` : undefined,
                transformOrigin: '0 0',
                overflow: 'hidden',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: textEl.zIndex || 2,
              }}
            >
              <TextPreviewCanvas element={textEl} unit={dims.unit} dpi={dims.dpi} width={w} height={h} />
            </div>
          );
        }

        const photoEl = el as PhotoFrameElement;
        const hydratedElement = mergeFramePhotoAsset(photoEl, photoEl.photoId ? photoById.get(photoEl.photoId) : null);
        const isCachePath = (p?: string | null) => {
          if (!p) return false;
          const norm = p.replace(/\\/g, '/').toLowerCase();
          return norm.includes('/thumbnails/') || norm.includes('/previews/');
        };
        const safeThumb = isCachePath(hydratedElement.thumbnailPath) ? hydratedElement.thumbnailPath : null;
        const safePreview = isCachePath(hydratedElement.previewPath) ? hydratedElement.previewPath : null;
        const imgSrc = (hydratedElement.photoId && !hydratedElement.isMissing)
          ? (safeThumb || safePreview || null)
          : null;

        const photoMeta = photoEl.photoId ? photoById.get(photoEl.photoId) : null;

        const photoAspect = getPhotoAspect(hydratedElement);

        const { offsetX, offsetY, width: imgPhysicalW, height: imgPhysicalH } = calculateImageOffset(
          photoEl.width,
          photoEl.height,
          photoAspect,
          Math.max(1.0, photoEl.cropScale || 1.0),
          photoEl.cropX || 0,
          photoEl.cropY || 0
        );

        const imgLeftPct = (offsetX / photoEl.width) * 100;
        const imgTopPct = (offsetY / photoEl.height) * 100;
        const imgWidthPct = (imgPhysicalW / photoEl.width) * 100;
        const imgHeightPct = (imgPhysicalH / photoEl.height) * 100;
        const cropRot = photoEl.cropRotation || 0;

        const [crTl, crTr, crBr, crBl] = getCornerRadii(photoEl);
        const maxRPx = Math.min(w, h) / 2;
        const rTlPx = Math.min(crTl * scale, maxRPx);
        const rTrPx = Math.min(crTr * scale, maxRPx);
        const rBrPx = Math.min(crBr * scale, maxRPx);
        const rBlPx = Math.min(crBl * scale, maxRPx);
        const hasR = rTlPx > 0.5 || rTrPx > 0.5 || rBrPx > 0.5 || rBlPx > 0.5;

        return (
          <div
            key={photoEl.id}
            style={{
              position: 'absolute',
              left: `${x}px`,
              top: `${y}px`,
              width: `${w}px`,
              height: `${h}px`,
              transform: rot ? `rotate(${rot}deg)` : undefined,
              transformOrigin: '0 0',
              overflow: 'hidden',
              background: imgSrc ? '#ffffff' : 'linear-gradient(135deg, #334155, #1e293b)',
              opacity: photoEl.opacity ?? 1,
              boxSizing: 'border-box',
              border: photoEl.borderEnabled && photoEl.borderWidth
                ? `${Math.max(1, Math.round(photoEl.borderWidth * scale))}px solid ${photoEl.borderColor || '#ffffff'}`
                : 'none',
              borderRadius: hasR ? `${rTlPx}px ${rTrPx}px ${rBrPx}px ${rBlPx}px` : undefined,
              zIndex: photoEl.zIndex || 2,
            }}
          >
            {imgSrc && (
              <img
                key={`${photoEl.id}_${imgSrc}_${photoMeta?.updatedAt || ''}_${photoEl.cropScale || 1}_${photoEl.cropX || 0}_${photoEl.cropY || 0}_${cropRot}`}
                src={safeConvertFileSrc(imgSrc, photoMeta?.updatedAt)}
                alt=""
                style={{
                  position: 'absolute',
                  left: `${imgLeftPct}%`,
                  top: `${imgTopPct}%`,
                  width: `${imgWidthPct}%`,
                  height: `${imgHeightPct}%`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transform: cropRot ? `rotate(${cropRot}deg)` : undefined,
                  transformOrigin: 'center center',
                  objectFit: 'fill',
                  display: 'block',
                  pointerEvents: 'none',
                  opacity: 0,
                  transition: 'opacity 0.15s ease',
                  color: 'transparent',
                }}
                loading="lazy"
                onLoad={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                onError={(e) => {
                  e.currentTarget.style.opacity = '0';
                  if (photoEl.photoId) {
                    void usePhotoStore.getState().healThumbnail(photoEl.photoId);
                  }
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PageNavigator() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const {
    currentAlbum,
    activeSpreadId,
    activeSpreadIndex,
    selectedSpreadIds,
    isSpreadDrawerOpen,
    setActiveSpread,
    nextSpread,
    prevSpread,
    addSpread,
    deleteSpread,
    deleteSpreads,
    duplicateSpread,
    moveSpread,
    reorderSpread,
    setSpreadDrawerOpen,
    toggleSpreadDrawer,
    setSelectedSpreadIds,
    toggleSpreadSelection,
    selectAllSpreads,
    clearSpreadSelection,
  } = useAlbumStore();

  const [spreadsToDelete, setSpreadsToDelete] = useState<Spread[] | null>(null);
  const [draggedSpreadIndex, setDraggedSpreadIndex] = useState<number | null>(null);
  const [dragOverSpreadIndex, setDragOverSpreadIndex] = useState<number | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const isDrawerHoveredRef = useRef(false);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    targetSpread: Spread | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    targetSpread: null,
  });

  // Keyboard navigation & multi-selection shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      // Ignore if in input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowRight')) {
        e.preventDefault();
        nextSpread();
      } else if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        prevSpread();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && isSpreadDrawerOpen) {
        const isTargetInside = isDrawerHoveredRef.current || (drawerRef.current && drawerRef.current.contains(e.target as Node));
        if (isTargetInside) {
          e.preventDefault();
          e.stopImmediatePropagation();
          selectAllSpreads();
        }
      } else if (e.key === 'Escape') {
        if (contextMenu.isOpen) {
          setContextMenu((prev) => ({ ...prev, isOpen: false }));
        } else if (selectedSpreadIds.length > 1) {
          clearSpreadSelection();
        }
      } else if (e.key === 'Delete' && isSpreadDrawerOpen && selectedSpreadIds.length > 0) {
        const targetElement = e.target as HTMLElement;
        const isFocusedInDrawer = Boolean(targetElement?.closest('[data-spread-drawer="true"]'));
        const isTargetInside = isDrawerHoveredRef.current || isFocusedInDrawer || (drawerRef.current && drawerRef.current.contains(targetElement));

        // If the user hasn't explicitly focused/hovered the drawer, AND they have canvas objects selected, skip spread deletion (let canvas handle it)
        const { selectedFrameIds } = useEditorStore.getState();
        if (!isTargetInside && selectedFrameIds.length > 0) {
          return;
        }

        // Only delete spreads if the spread drawer is hovered/focused OR multiple spreads are selected
        if (!isTargetInside && selectedSpreadIds.length <= 1) {
          return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();
        const { currentAlbum: album } = useAlbumStore.getState();
        if (!album) return;
        const spreads = getAllAlbumSpreads(album);
        const selected = spreads.filter((s) => selectedSpreadIds.includes(s.id));
        if (selected.length === 0) return;

        const hasElements = selected.some((s) => (s.elements || []).length > 0);
        // If single spread, completely empty, and more than 1 spread exists in album, delete immediately
        if (selected.length === 1 && !hasElements && spreads.length > 1) {
          deleteSpread(selected[0]!.id);
        } else {
          setSpreadsToDelete(selected);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSpread, prevSpread, isSpreadDrawerOpen, selectAllSpreads, contextMenu.isOpen, selectedSpreadIds, clearSpreadSelection, deleteSpread]);

  if (!currentProject || !currentAlbum) return null;

  const allSpreads = getAllAlbumSpreads(currentAlbum);
  const hasPrev = activeSpreadIndex > 0;
  const hasNext = activeSpreadIndex < allSpreads.length - 1;

  const handleAddSpread = () => {
    addSpread(currentProject);
  };

  const handleDuplicateSpread = (e: React.MouseEvent, spread: Spread) => {
    e.stopPropagation();
    duplicateSpread(spread.id, currentProject);
  };

  const handleDeleteRequest = (e: React.MouseEvent, targetSpreads: Spread[]) => {
    e.stopPropagation();
    if (targetSpreads.length === 0) return;

    useEditorStore.getState().clearSelection();

    const allSpreads = getAllAlbumSpreads(currentAlbum);
    // Check if any spread has elements
    const hasElements = targetSpreads.some((s) => (s.elements || []).length > 0);

    // If single spread and completely empty, and more than 1 spread exists, delete immediately without modal
    if (targetSpreads.length === 1 && !hasElements && allSpreads.length > 1) {
      deleteSpread(targetSpreads[0]!.id);
      return;
    }

    // Spread has elements, multiple spreads selected, or deleting only remaining spread -> prompt confirmation dialog
    setSpreadsToDelete(targetSpreads);
  };

  const handleConfirmDelete = () => {
    if (spreadsToDelete && spreadsToDelete.length > 0) {
      useEditorStore.getState().clearSelection();
      if (spreadsToDelete.length === 1 && allSpreads.length > 1) {
        deleteSpread(spreadsToDelete[0]!.id);
      } else {
        deleteSpreads(spreadsToDelete.map((s) => s.id));
      }
      setSpreadsToDelete(null);
    }
  };

  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu.targetSpread) return [];

    const isMulti = selectedSpreadIds.length > 1 && selectedSpreadIds.includes(contextMenu.targetSpread.id);
    const selectedSpreads = allSpreads.filter((s) => selectedSpreadIds.includes(s.id));

    if (isMulti) {
      return [
        {
          id: 'header-multi',
          label: `${selectedSpreadIds.length} Spreads Selected`,
          header: true,
        },
        {
          id: 'delete-selected',
          label: `Delete Selected Spreads (${selectedSpreadIds.length})`,
          icon: '🗑️',
          shortcut: 'Delete',
          danger: true,
          onClick: () => {
            useEditorStore.getState().clearSelection();
            setSpreadsToDelete(selectedSpreads);
          },
        },
        {
          id: 'duplicate-selected',
          label: `Duplicate Selected Spreads (${selectedSpreadIds.length})`,
          icon: '📋',
          onClick: () => {
            selectedSpreads.forEach((s) => duplicateSpread(s.id, currentProject));
          },
        },
        { divider: true, id: 'div-1', label: '' },
        {
          id: 'select-all',
          label: 'Select All Spreads',
          shortcut: 'Ctrl+A',
          onClick: selectAllSpreads,
        },
        {
          id: 'clear-selection',
          label: 'Deselect Others',
          onClick: () => {
            if (contextMenu.targetSpread) {
              setSelectedSpreadIds([contextMenu.targetSpread.id]);
              setActiveSpread(contextMenu.targetSpread.id);
            }
          },
        },
      ];
    }

    const spread = contextMenu.targetSpread;
    const index = allSpreads.findIndex((s) => s.id === spread.id);
    const isFirst = index === 0;
    const isLast = index === allSpreads.length - 1;

    return [
      {
        id: 'header-single',
        label: getSpreadLabel(spread),
        header: true,
      },
      {
        id: 'duplicate-single',
        label: 'Duplicate Spread',
        icon: '📋',
        onClick: () => duplicateSpread(spread.id, currentProject),
      },
      {
        id: 'move-left',
        label: 'Move Left (Earlier)',
        icon: '◀',
        disabled: isFirst,
        onClick: () => moveSpread(spread.id, 'left'),
      },
      {
        id: 'move-right',
        label: 'Move Right (Later)',
        icon: '▶',
        disabled: isLast,
        onClick: () => moveSpread(spread.id, 'right'),
      },
      { divider: true, id: 'div-1', label: '' },
      {
        id: 'select-all',
        label: 'Select All Spreads',
        shortcut: 'Ctrl+A',
        onClick: selectAllSpreads,
      },
      { divider: true, id: 'div-2', label: '' },
      {
        id: 'delete-single',
        label: allSpreads.length <= 1 ? 'Delete & Reset Spread' : 'Delete Spread',
        icon: '🗑️',
        danger: true,
        onClick: () => {
          useEditorStore.getState().clearSelection();
          if (allSpreads.length <= 1 || (spread.elements && spread.elements.length > 0)) {
            setSpreadsToDelete([spread]);
          } else {
            deleteSpread(spread.id);
          }
        },
      },
    ];
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedSpreadIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSpreadIndex !== index) {
      setDragOverSpreadIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverSpreadIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData('text/plain');
    const sourceIndex = sourceIndexStr ? parseInt(sourceIndexStr, 10) : draggedSpreadIndex;
    setDraggedSpreadIndex(null);
    setDragOverSpreadIndex(null);

    if (sourceIndex !== null && !isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      reorderSpread(sourceIndex, targetIndex);
    }
  };

  const handleDragEnd = () => {
    setDraggedSpreadIndex(null);
    setDragOverSpreadIndex(null);
  };

  return (
    <div
      className={styles.navigatorContainer}
      onMouseDownCapture={() => {
        usePhotoStore.getState().clearSelection();
      }}
    >
      {/* Spread Thumbnail Drawer (Collapsible with Hardware-Accelerated Smooth Slide) */}
      <div
        ref={drawerRef}
        data-spread-drawer="true"
        className={`${styles.drawerWrapper} ${!isSpreadDrawerOpen ? styles.drawerWrapperCollapsed : ''}`}
        onMouseEnter={() => {
          isDrawerHoveredRef.current = true;
        }}
        onMouseLeave={() => {
          isDrawerHoveredRef.current = false;
        }}
      >
        <div className={styles.drawerInner}>
          <div className={styles.drawerHeader}>
            <span className={styles.drawerTitle}>Album Spreads ({allSpreads.length})</span>
            <button
              type="button"
              className={styles.drawerCloseBtn}
              onClick={() => setSpreadDrawerOpen(false)}
              title="Close Spread Drawer"
            >
              ✕
            </button>
          </div>

          <div className={styles.drawerList}>
            {allSpreads.map((spread, index) => {
              const isActive = activeSpreadId === spread.id;
              const isSelected = selectedSpreadIds.includes(spread.id);
              const isDragging = draggedSpreadIndex === index;
              const isDragOver = dragOverSpreadIndex === index;
              const isFirst = index === 0;
              const isLast = index === allSpreads.length - 1;

              let dragOverClass = '';
              if (isDragOver && draggedSpreadIndex !== null && draggedSpreadIndex !== index) {
                dragOverClass = (draggedSpreadIndex < index ? styles.dragOverRight : styles.dragOverLeft) || '';
              }

              return (
                <div
                  key={spread.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  tabIndex={0}
                  className={`${styles.thumbnailCard} ${isActive ? styles.cardActive : ''} ${isSelected && !isActive ? styles.cardSelected : ''} ${isDragging ? styles.draggingCard : ''} ${dragOverClass}`}
                  onClick={(e) => {
                    usePhotoStore.getState().clearSelection();
                    const isMulti = Boolean(e.ctrlKey || e.metaKey);
                    const isRange = Boolean(e.shiftKey);
                    toggleSpreadSelection(spread.id, isMulti, isRange);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // If right-clicked card is NOT already selected, select only this card
                    if (!selectedSpreadIds.includes(spread.id)) {
                      toggleSpreadSelection(spread.id, false, false);
                    }

                    setContextMenu({
                      isOpen: true,
                      x: e.clientX,
                      y: e.clientY,
                      targetSpread: spread,
                    });
                  }}
                  title={`${getSpreadLabel(spread)} (Ctrl+Click multi-select, Right-click for options)`}
                >
                  {/* Miniature Spread Preview inside centered container */}
                  <div className={styles.previewContainer}>
                    <MiniSpreadPreview spread={spread} project={currentProject} />
                  </div>

                  {/* Card Bottom: Clean Spread Label on Left, Permanent Action Buttons on Right */}
                  <div className={styles.cardFooter}>
                    <span className={styles.spreadBadge}>
                      {getSpreadNumberLabel(spread)}
                    </span>

                    {/* Quick Actions (Reorder ◀ ▶ / Duplicate / Delete) */}
                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.cardActionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSpread(spread.id, 'left');
                        }}
                        disabled={isFirst}
                        title={isFirst ? 'First position (cannot move left)' : 'Move spread left (earlier)'}
                        aria-label="Move spread left"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={styles.cardActionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSpread(spread.id, 'right');
                        }}
                        disabled={isLast}
                        title={isLast ? 'Last position (cannot move right)' : 'Move spread right (later)'}
                        aria-label="Move spread right"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`${styles.cardActionBtn} ${styles.cardActionBtnDuplicate}`}
                        onClick={(e) => handleDuplicateSpread(e, spread)}
                        title="Duplicate this spread"
                        aria-label="Duplicate spread"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`${styles.cardActionBtn} ${styles.cardActionBtnDanger}`}
                        onClick={(e) => handleDeleteRequest(e, [spread])}
                        disabled={allSpreads.length <= 1}
                        title={allSpreads.length <= 1 ? 'Cannot delete the only spread' : 'Delete this spread'}
                        aria-label="Delete spread"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Spread Button inside Drawer */}
            <button
              type="button"
              className={styles.drawerAddBtn}
              onClick={handleAddSpread}
              title="Add a new spread to album"
            >
              <span className={styles.drawerAddIcon}>+</span>
              <span>New Spread</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Main Navigation Bar */}
      <div className={styles.navigationBar}>
        {/* Left: Thumbnail Drawer Toggle */}
        <button
          type="button"
          className={`${styles.navBtn} ${isSpreadDrawerOpen ? styles.navBtnActive : ''}`}
          onClick={toggleSpreadDrawer}
          title={isSpreadDrawerOpen ? 'Hide Spread Thumbnails' : 'Show All Spread Thumbnails'}
        >
          <span className={styles.drawerIcon}>⊞</span>
          <span>Spreads ({allSpreads.length})</span>
        </button>

        <div className={styles.divider} />

        {/* Center: Previous Button, Dropdown Selector, Next Button */}
        <div className={styles.centerControls}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={prevSpread}
            disabled={!hasPrev}
            title="Previous Spread (PageUp or Alt+Left)"
          >
            ◀ Prev
          </button>

          {/* Spread Dropdown Selector */}
          <select
            className={styles.spreadSelect}
            value={activeSpreadId || ''}
            onChange={(e) => setActiveSpread(e.target.value)}
            title="Jump to Spread"
          >
            {allSpreads.map((s) => (
              <option key={s.id} value={s.id}>
                {getSpreadLabel(s)}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.navBtn}
            onClick={nextSpread}
            disabled={!hasNext}
            title="Next Spread (PageDown or Alt+Right)"
          >
            Next ▶
          </button>
        </div>

        <div className={styles.divider} />

        {/* Right: Quick + Add Spread */}
        <button
          type="button"
          className={`${styles.navBtn} ${styles.addSpreadBtn}`}
          onClick={handleAddSpread}
          title="Add a new spread with 2 facing pages"
        >
          <span>+ Add Spread</span>
        </button>
      </div>

      {/* Right-Click Context Menu for Spread Cards */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={getContextMenuItems()}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Confirm Delete Spread Dialog (single or multi-spread batch) */}
      <ConfirmDialog
        isOpen={spreadsToDelete !== null && spreadsToDelete.length > 0}
        title={
          spreadsToDelete && spreadsToDelete.length > 1
            ? spreadsToDelete.length === allSpreads.length
              ? `Delete All ${spreadsToDelete.length} Album Spreads?`
              : `Delete ${spreadsToDelete.length} Album Spreads?`
            : allSpreads.length === 1
              ? 'Delete Album Spread & Reset?'
              : 'Delete Album Spread?'
        }
        message={
          spreadsToDelete && spreadsToDelete.length > 1
            ? spreadsToDelete.length === allSpreads.length
              ? `Are you sure you want to delete all ${spreadsToDelete.length} spreads? All contents will be removed and the album will reset with a new blank spread.`
              : `Are you sure you want to delete ${spreadsToDelete.length} selected spreads?`
            : allSpreads.length === 1
              ? `Are you sure you want to delete "${spreadsToDelete?.[0]?.name}"? The album will reset with a new blank spread.`
              : `Are you sure you want to delete "${spreadsToDelete?.[0]?.name}"?`
        }
        detail={(() => {
          if (!spreadsToDelete || spreadsToDelete.length === 0) return '';

          const isDeletingAll = spreadsToDelete.length === allSpreads.length;
          const allElements = spreadsToDelete.flatMap((s) => s.elements || []);
          const photoCount = allElements.filter(
            (el) => el.type === 'photo' && Boolean(el.photoId || el.filePath)
          ).length;
          const textCount = allElements.filter((el) => el.type === 'text').length;
          const emptyFrameCount = allElements.filter(
            (el) => el.type === 'photo' && !el.photoId && !el.filePath
          ).length;

          const parts: string[] = [];
          if (photoCount > 0) parts.push(`${photoCount} photo(s)`);
          if (textCount > 0) parts.push(`${textCount} text element(s)`);
          if (emptyFrameCount > 0) parts.push(`${emptyFrameCount} placeholder frame(s)`);

          const summary = parts.length > 0 ? parts.join(', ') : `${allElements.length} element(s)`;

          if (isDeletingAll) {
            return `All ${spreadsToDelete.length} spreads containing ${summary} will be removed. A new empty spread will be created so you can continue designing immediately. (You can undo this with Ctrl+Z).`;
          }
          if (spreadsToDelete.length > 1) {
            return `These ${spreadsToDelete.length} spreads contain a total of ${summary}. Deleting them will permanently remove all their contents from your album.`;
          }
          return `This spread still contains ${summary}. Deleting it will permanently remove this spread and all its contents from your album.`;
        })()}
        confirmText={
          spreadsToDelete && spreadsToDelete.length > 1
            ? spreadsToDelete.length === allSpreads.length
              ? `Delete All & Reset`
              : `Delete ${spreadsToDelete.length} Spreads`
            : allSpreads.length === 1
              ? 'Delete & Reset'
              : 'Delete Spread'
        }
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setSpreadsToDelete(null)}
      />
    </div>
  );
}
