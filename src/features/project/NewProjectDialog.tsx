import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { NumberInput } from '../../components/ui/NumberInput';
import { Select } from '../../components/ui/Select';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { Switch } from '../../components/ui/Switch';
import { useProjectStore } from '../../stores/projectStore';
import { Unit, UNIT_OPTIONS, convertUnit, formatDimensions, toPixels } from '../../domain/units';
import {
  AlbumPreset,
  CUSTOM_PRESET_ID,
  findMatchingPreset,
  getPresetById,
  getAllPresets,
  saveCustomPreset,
  deleteCustomPreset,
} from '../../domain/presets';
import { validateProjectSettings } from '../../domain/project';
import styles from './NewProjectDialog.module.css';

export function NewProjectDialog() {
  const isOpen = useProjectStore((s) => s.isNewProjectOpen);
  const closeNewProject = useProjectStore((s) => s.closeNewProject);
  const createNewProject = useProjectStore((s) => s.createNewProject);

  const [allPresets, setAllPresets] = useState<AlbumPreset[]>([]);
  const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);
  const [customPresetName, setCustomPresetName] = useState('');
  const [presetSaveSuccess, setPresetSaveSuccess] = useState<string | null>(null);

  const [name, setName] = useState('Untitled Album');
  const [presetId, setPresetId] = useState<string>('square-20x20-cm');
  const [canvasWidth, setCanvasWidth] = useState(20);
  const [canvasHeight, setCanvasHeight] = useState(20);
  const [canvasUnit, setCanvasUnit] = useState<Unit>('cm');
  const [canvasDpi, setCanvasDpi] = useState(300);

  const [spacingValue, setSpacingValue] = useState(2);
  const [spacingUnit, setSpacingUnit] = useState<Unit>('cm');

  // Safe Margin
  const [marginEnabled, setMarginEnabled] = useState(true);
  const [isMargin4S, setIsMargin4S] = useState(false);
  const [marginValue, setMarginValue] = useState(2);
  const [marginTop, setMarginTop] = useState(2);
  const [marginBottom, setMarginBottom] = useState(2);
  const [marginOutside, setMarginOutside] = useState(2);
  const [marginSpine, setMarginSpine] = useState(2);
  const [marginUnit, setMarginUnit] = useState<Unit>('cm');

  // Border
  const [borderEnabled, setBorderEnabled] = useState(false);
  const [borderWidth, setBorderWidth] = useState(0.1);
  const [borderUnit, setBorderUnit] = useState<Unit>('cm');
  const [borderColor, setBorderColor] = useState('#FFFFFF');

  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<'page' | 'margins' | 'appearance'>('page');

  // Helper to round values cleanly based on unit
  const roundUnit = (val: number, unit: Unit): number => {
    if (unit === 'inch') return Math.round(val * 100) / 100;
    if (unit === 'cm') return Math.round(val * 100) / 100;
    if (unit === 'mm') return Math.round(val * 10) / 10;
    return Math.round(val);
  };

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      const presets = getAllPresets();
      setAllPresets(presets);
      setName('Untitled Album');
      setPresetId('square-20x20-cm');
      setCanvasWidth(20);
      setCanvasHeight(20);
      setCanvasUnit('cm');
      setCanvasDpi(300);
      setSpacingValue(2);
      setSpacingUnit('cm');
      setMarginEnabled(true);
      setIsMargin4S(false);
      setMarginValue(2);
      setMarginTop(2);
      setMarginBottom(2);
      setMarginOutside(2);
      setMarginSpine(2);
      setMarginUnit('cm');
      setBorderEnabled(false); // Default disabled
      setBorderWidth(0.1);
      setBorderUnit('cm');
      setBorderColor('#FFFFFF');
      setBackgroundColor('#FFFFFF');
      setErrorMessage(null);
      setIsSubmitting(false);
      setIsSavePresetOpen(false);
      setCustomPresetName('');
      setPresetSaveSuccess(null);
      setActiveTab('page');
    }
  }, [isOpen]);

  // Preset Selection with full unit synchronization and custom settings loading
  const handlePresetSelect = (id: string) => {
    setPresetId(id);
    if (id === CUSTOM_PRESET_ID) return;

    const preset = allPresets.find((p) => p.id === id) || getPresetById(id);
    if (preset) {
      setCanvasWidth(preset.width);
      setCanvasHeight(preset.height);
      setCanvasDpi(preset.dpi);

      const targetUnit = preset.unit;
      if (targetUnit !== canvasUnit) {
        setCanvasUnit(targetUnit);
      }

      if (preset.isCustom) {
        if (preset.spacingValue !== undefined) setSpacingValue(preset.spacingValue);
        if (preset.spacingUnit) setSpacingUnit(preset.spacingUnit);
        if (preset.marginEnabled !== undefined) setMarginEnabled(preset.marginEnabled);
        if (preset.marginValue !== undefined) setMarginValue(preset.marginValue);
        if (preset.marginUnit) setMarginUnit(preset.marginUnit);
        if (preset.borderEnabled !== undefined) setBorderEnabled(preset.borderEnabled);
        if (preset.borderWidth !== undefined) setBorderWidth(preset.borderWidth);
        if (preset.borderUnit) setBorderUnit(preset.borderUnit);
        if (preset.borderColor) setBorderColor(preset.borderColor);
        if (preset.backgroundColor) setBackgroundColor(preset.backgroundColor);
      } else {
        if (targetUnit !== canvasUnit) {
          setMarginValue(roundUnit(convertUnit(marginValue, marginUnit, targetUnit, preset.dpi), targetUnit));
          setMarginUnit(targetUnit);
          setSpacingValue(roundUnit(convertUnit(spacingValue, spacingUnit, targetUnit, preset.dpi), targetUnit));
          setSpacingUnit(targetUnit);
          setBorderWidth(roundUnit(convertUnit(borderWidth, borderUnit, targetUnit, preset.dpi), targetUnit));
          setBorderUnit(targetUnit);
        }
      }
    }
  };

  // Save current settings as a reusable custom preset
  const handleSaveCustomPreset = () => {
    const trimmed = customPresetName.trim();
    if (!trimmed) return;

    const newPreset: AlbumPreset = {
      id: `custom-${Date.now()}`,
      name: trimmed,
      width: canvasWidth,
      height: canvasHeight,
      unit: canvasUnit,
      dpi: canvasDpi,
      isCustom: true,
      spacingValue,
      spacingUnit,
      marginEnabled,
      marginValue,
      marginUnit,
      borderEnabled,
      borderWidth,
      borderUnit,
      borderColor,
      backgroundColor,
    };

    const updated = saveCustomPreset(newPreset);
    setAllPresets(updated);
    setPresetId(newPreset.id);
    setIsSavePresetOpen(false);
    setCustomPresetName('');
    setPresetSaveSuccess(`Preset "${trimmed}" saved!`);
    setTimeout(() => setPresetSaveSuccess(null), 3500);
  };

  // Delete a saved custom preset
  const handleDeleteCustomPreset = (idToDelete: string) => {
    const updated = deleteCustomPreset(idToDelete);
    setAllPresets(updated);
    setPresetId('square-8x8');
    handlePresetSelect('square-8x8');
  };

  // Synchronize all units across the entire project dialog with automatic mathematical conversion
  const handleUnitChange = (newUnitStr: string) => {
    const newUnit = newUnitStr as Unit;
    if (newUnit === canvasUnit) return;

    // Convert Page Dimensions
    const convertedW = roundUnit(convertUnit(canvasWidth, canvasUnit, newUnit, canvasDpi), newUnit);
    const convertedH = roundUnit(convertUnit(canvasHeight, canvasUnit, newUnit, canvasDpi), newUnit);
    setCanvasWidth(convertedW);
    setCanvasHeight(convertedH);
    setCanvasUnit(newUnit);

    // Convert Safe Margin
    const convertedMargin = roundUnit(convertUnit(marginValue, marginUnit, newUnit, canvasDpi), newUnit);
    setMarginValue(convertedMargin);
    setMarginTop(roundUnit(convertUnit(marginTop, marginUnit, newUnit, canvasDpi), newUnit));
    setMarginBottom(roundUnit(convertUnit(marginBottom, marginUnit, newUnit, canvasDpi), newUnit));
    setMarginOutside(roundUnit(convertUnit(marginOutside, marginUnit, newUnit, canvasDpi), newUnit));
    setMarginSpine(roundUnit(convertUnit(marginSpine, marginUnit, newUnit, canvasDpi), newUnit));
    setMarginUnit(newUnit);

    // Convert Spacing
    const convertedSpacing = roundUnit(convertUnit(spacingValue, spacingUnit, newUnit, canvasDpi), newUnit);
    setSpacingValue(convertedSpacing);
    setSpacingUnit(newUnit);

    // Convert Border
    const convertedBorder = roundUnit(convertUnit(borderWidth, borderUnit, newUnit, canvasDpi), newUnit);
    setBorderWidth(convertedBorder);
    setBorderUnit(newUnit);

    const matched = findMatchingPreset(convertedW, convertedH, newUnit);
    setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
  };

  // Width & Height changes
  const handleWidthChange = (val: number) => {
    setCanvasWidth(val);
    const matched = findMatchingPreset(val, canvasHeight, canvasUnit);
    setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
  };

  const handleHeightChange = (val: number) => {
    setCanvasHeight(val);
    const matched = findMatchingPreset(canvasWidth, val, canvasUnit);
    setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
  };

  // Orientation Selector
  const handleOrientation = (mode: 'square' | 'portrait' | 'landscape') => {
    if (mode === 'square') {
      const size = canvasWidth;
      setCanvasWidth(size);
      setCanvasHeight(size);
      const matched = findMatchingPreset(size, size, canvasUnit);
      setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
    } else if (mode === 'portrait') {
      if (canvasWidth > canvasHeight) {
        const w = canvasHeight;
        const h = canvasWidth;
        setCanvasWidth(w);
        setCanvasHeight(h);
        const matched = findMatchingPreset(w, h, canvasUnit);
        setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
      } else if (Math.abs(canvasWidth - canvasHeight) < 0.001) {
        const h = Math.round(canvasWidth * 1.25 * 10) / 10;
        setCanvasHeight(h);
        const matched = findMatchingPreset(canvasWidth, h, canvasUnit);
        setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
      }
    } else if (mode === 'landscape') {
      if (canvasHeight > canvasWidth) {
        const w = canvasHeight;
        const h = canvasWidth;
        setCanvasWidth(w);
        setCanvasHeight(h);
        const matched = findMatchingPreset(w, h, canvasUnit);
        setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
      } else if (Math.abs(canvasWidth - canvasHeight) < 0.001) {
        const w = Math.round(canvasHeight * 1.25 * 10) / 10;
        setCanvasWidth(w);
        const matched = findMatchingPreset(w, canvasHeight, canvasUnit);
        setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
      }
    }
  };

  // Swap Width & Height
  const handleSwapDimensions = () => {
    const nextW = canvasHeight;
    const nextH = canvasWidth;
    setCanvasWidth(nextW);
    setCanvasHeight(nextH);
    const matched = findMatchingPreset(nextW, nextH, canvasUnit);
    setPresetId(matched ? matched.id : CUSTOM_PRESET_ID);
  };

  const currentOrientation =
    Math.abs(canvasWidth - canvasHeight) < 0.01
      ? 'square'
      : canvasWidth < canvasHeight
      ? 'portrait'
      : 'landscape';

  // Calculate spread dimensions (Spread = 2 pages side-by-side)
  const spreadWidth = canvasWidth * 2;
  const spreadHeight = canvasHeight;

  // Pixel calculations
  const spreadPxW = Math.round(toPixels(spreadWidth, canvasUnit, canvasDpi));
  const spreadPxH = Math.round(toPixels(spreadHeight, canvasUnit, canvasDpi));
  const megapixels = ((spreadPxW * spreadPxH) / 1_000_000).toFixed(1);

  // Live preview aspect ratio box calculation
  const previewRatio = spreadWidth / spreadHeight;
  let previewBoxW = 200;
  let previewBoxH = Math.round(200 / previewRatio);
  if (previewBoxH > 115) {
    previewBoxH = 115;
    previewBoxW = Math.round(115 * previewRatio);
  }
  if (previewBoxW > 220) {
    previewBoxW = 220;
    previewBoxH = Math.round(220 / previewRatio);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const settings = {
      name: name.trim() || 'Untitled Album',
      canvas: {
        width: canvasWidth,
        height: canvasHeight,
        unit: canvasUnit,
        dpi: canvasDpi,
      },
      spacing: {
        value: spacingValue,
        unit: spacingUnit,
      },
      margin: {
        enabled: marginEnabled,
        value: marginValue,
        unit: marginUnit,
        top: isMargin4S ? marginTop : marginValue,
        bottom: isMargin4S ? marginBottom : marginValue,
        outside: isMargin4S ? marginOutside : marginValue,
        spine: isMargin4S ? marginSpine : marginValue,
      },
      border: {
        enabled: borderEnabled,
        width: borderWidth,
        unit: borderUnit,
        color: borderColor,
      },
      background: {
        type: 'solid' as const,
        color: backgroundColor,
      },
    };

    const validationErrors = validateProjectSettings(settings);
    if (validationErrors.length > 0) {
      setErrorMessage(validationErrors[0]!.message);
      return;
    }

    try {
      setIsSubmitting(true);
      await createNewProject(settings);
    } catch (err) {
      console.error('[AFSN] Error creating project:', err);
      setErrorMessage(`Failed to create project: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={closeNewProject}
      title="New Album Project"
      width={840}
      closeOnOverlayClick={false}
      closeOnEscape={false}
    >
      <form onSubmit={handleSubmit} onContextMenu={(e) => e.preventDefault()}>
        {errorMessage && (
          <div className={styles.errorBanner}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className={styles.dialogContainer}>
          {/* Left Column: Form Configuration */}
          <div className={styles.leftColumn}>
            {/* Compact Project Name Input */}
            <div className={styles.nameRow}>
              <span className={styles.nameIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                  <path d="M6 6h10" />
                  <path d="M6 10h10" />
                </svg>
              </span>
              <input
                type="text"
                className={styles.nameInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Album Project Name (e.g. Wedding Album 2026)"
                autoFocus
              />
            </div>

            {/* Category Navigation Tabs */}
            <div className={styles.tabsNav}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'page' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('page')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 3H3v18h18V3z" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
                <span>Page & Canvas</span>
              </button>

              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'margins' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('margins')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M7 7h10v10H7z" strokeDasharray="2 2" />
                </svg>
                <span>Margins & Gap</span>
              </button>

              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'appearance' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('appearance')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a7 7 0 1 0 7 7" />
                </svg>
                <span>Appearance</span>
              </button>
            </div>

            {/* TAB 1: Page Dimensions & Canvas Settings */}
            {activeTab === 'page' && (
              <div className={styles.tabContent}>
                {/* Album Preset Selection Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                      Album Presets
                    </span>
                    <span className={styles.cardSubtitle}>Standard & Custom Sizes</span>
                  </div>

                  <div className={styles.presetRow}>
                    <div className={styles.presetSelectWrapper}>
                      <Select
                        label="Preset Template"
                        value={presetId}
                        options={[
                          ...allPresets.map((p) => ({
                            value: p.id,
                            label: p.isCustom ? `★ ${p.name}` : p.name,
                          })),
                          { value: CUSTOM_PRESET_ID, label: 'Custom Dimensions' },
                        ]}
                        onChange={handlePresetSelect}
                      />
                    </div>

                    <button
                      type="button"
                      className={styles.presetActionBtn}
                      onClick={() => {
                        setCustomPresetName(`${canvasWidth}×${canvasHeight} ${canvasUnit} Custom`);
                        setIsSavePresetOpen(!isSavePresetOpen);
                      }}
                      title="Save current dimensions as reusable preset"
                    >
                      <span>★</span>
                      <span>Save Preset</span>
                    </button>

                    {Boolean(allPresets.find((p) => p.id === presetId)?.isCustom) && (
                      <button
                        type="button"
                        className={styles.presetDeleteBtn}
                        onClick={() => handleDeleteCustomPreset(presetId)}
                        title="Delete this custom preset"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {isSavePresetOpen && (
                    <div className={styles.savePresetDrawer}>
                      <div className={styles.savePresetTitle}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Save Configuration as Custom Preset
                      </div>
                      <input
                        type="text"
                        className={styles.savePresetInput}
                        value={customPresetName}
                        onChange={(e) => setCustomPresetName(e.target.value)}
                        placeholder="Preset Name (e.g. 10x10 Wedding Standard)"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveCustomPreset();
                          } else if (e.key === 'Escape') {
                            setIsSavePresetOpen(false);
                          }
                        }}
                      />
                      <div className={styles.savePresetActions}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsSavePresetOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={handleSaveCustomPreset}
                          disabled={!customPresetName.trim()}
                        >
                          Save Preset
                        </Button>
                      </div>
                    </div>
                  )}

                  {presetSaveSuccess && (
                    <div className={styles.seamlessSpineBadge}>
                      ✓ {presetSaveSuccess}
                    </div>
                  )}
                </div>

                {/* Dimensions & Orientation Card */}
                <div className={styles.card}>
                  <div className={styles.orientationHeader}>
                    <span className={styles.cardTitle}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                        <path d="M2 12h20" />
                      </svg>
                      Page Geometry & Orientation
                    </span>
                    <button
                      type="button"
                      className={styles.swapBtn}
                      onClick={handleSwapDimensions}
                      title="Swap Width and Height"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m16 3 4 4-4 4" />
                        <path d="M20 7H4" />
                        <path d="m8 21-4-4 4-4" />
                        <path d="M4 17h16" />
                      </svg>
                      <span>Swap W ↔ H</span>
                    </button>
                  </div>

                  {/* Visual Orientation Tiles */}
                  <div className={styles.orientationGrid}>
                    <button
                      type="button"
                      className={`${styles.orientTile} ${currentOrientation === 'square' ? styles.orientTileActive : ''}`}
                      onClick={() => handleOrientation('square')}
                    >
                      <div className={styles.orientIconBox}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                      </div>
                      <span className={styles.orientLabel}>Square</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.orientTile} ${currentOrientation === 'portrait' ? styles.orientTileActive : ''}`}
                      onClick={() => handleOrientation('portrait')}
                    >
                      <div className={styles.orientIconBox}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="6" y="3" width="12" height="18" rx="2" />
                        </svg>
                      </div>
                      <span className={styles.orientLabel}>Portrait</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.orientTile} ${currentOrientation === 'landscape' ? styles.orientTileActive : ''}`}
                      onClick={() => handleOrientation('landscape')}
                    >
                      <div className={styles.orientIconBox}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="6" width="18" height="12" rx="2" />
                        </svg>
                      </div>
                      <span className={styles.orientLabel}>Landscape</span>
                    </button>
                  </div>

                  {/* Physical Dimensions & Resolution */}
                  <div className={styles.inputRow}>
                    <div className={styles.flex1}>
                      <NumberInput
                        label="Width"
                        value={canvasWidth}
                        onChange={handleWidthChange}
                        min={1}
                        max={2000}
                        step={canvasUnit === 'inch' ? 0.5 : 1}
                      />
                    </div>

                    <div className={styles.flex1}>
                      <NumberInput
                        label="Height"
                        value={canvasHeight}
                        onChange={handleHeightChange}
                        min={1}
                        max={2000}
                        step={canvasUnit === 'inch' ? 0.5 : 1}
                      />
                    </div>

                    <div style={{ width: '85px' }}>
                      <Select
                        label="Unit"
                        value={canvasUnit}
                        options={UNIT_OPTIONS}
                        onChange={handleUnitChange}
                      />
                    </div>

                    <div style={{ width: '100px' }}>
                      <NumberInput
                        label="Resolution"
                        value={canvasDpi}
                        onChange={setCanvasDpi}
                        min={72}
                        max={1200}
                        step={50}
                        suffix="DPI"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Margins & Spacing Settings */}
            {activeTab === 'margins' && (
              <div className={styles.tabContent}>
                {/* Safe Zone Margins Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={styles.cardTitle}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="18" x="3" y="3" rx="2" />
                          <path d="M7 7h10v10H7z" strokeDasharray="2 2" />
                        </svg>
                        Safe Zone Margins
                      </span>
                    </div>

                    {marginEnabled && (
                      <div className={styles.segmentedGroup}>
                        <button
                          type="button"
                          className={`${styles.segmentBtn} ${!isMargin4S ? styles.segmentBtnActive : ''}`}
                          onClick={() => setIsMargin4S(false)}
                          title="Uniform margin on all sides"
                        >
                          Uniform
                        </button>
                        <button
                          type="button"
                          className={`${styles.segmentBtn} ${isMargin4S ? styles.segmentBtnActive : ''}`}
                          onClick={() => setIsMargin4S(true)}
                          title="Independent 4-sided margins"
                        >
                          4-Sided
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '2px 0 4px 0' }}>
                    <Switch
                      checked={marginEnabled}
                      onChange={setMarginEnabled}
                      label="Enable safe margin guide lines"
                      size="sm"
                    />
                  </div>

                  {marginEnabled && !isMargin4S && (
                    <div className={styles.inputRow}>
                      <div className={styles.flex1}>
                        <NumberInput
                          label="Safe Margin (All Sides)"
                          value={marginValue}
                          onChange={setMarginValue}
                          min={0.1}
                          max={1000}
                          step={canvasUnit === 'inch' ? 0.05 : canvasUnit === 'cm' ? 0.1 : canvasUnit === 'px' ? 5 : 0.5}
                        />
                      </div>
                      <div className={styles.unitSelectBox}>
                        <Select
                          label="Unit"
                          value={marginUnit}
                          options={UNIT_OPTIONS}
                          onChange={handleUnitChange}
                        />
                      </div>
                    </div>
                  )}

                  {marginEnabled && isMargin4S && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className={styles.margin4sGrid}>
                        <div>
                          <NumberInput
                            label="Top (⤒)"
                            value={marginTop}
                            onChange={setMarginTop}
                            min={0}
                            max={1000}
                            step={canvasUnit === 'inch' ? 0.05 : canvasUnit === 'cm' ? 0.1 : canvasUnit === 'px' ? 5 : 0.5}
                          />
                        </div>
                        <div>
                          <NumberInput
                            label="Bottom (⤓)"
                            value={marginBottom}
                            onChange={setMarginBottom}
                            min={0}
                            max={1000}
                            step={canvasUnit === 'inch' ? 0.05 : canvasUnit === 'cm' ? 0.1 : canvasUnit === 'px' ? 5 : 0.5}
                          />
                        </div>
                        <div title="Outer trim margin protected from paper cutting">
                          <NumberInput
                            label="Outside Trim (⇤)"
                            value={marginOutside}
                            onChange={setMarginOutside}
                            min={0}
                            max={1000}
                            step={canvasUnit === 'inch' ? 0.05 : canvasUnit === 'cm' ? 0.1 : canvasUnit === 'px' ? 5 : 0.5}
                          />
                        </div>
                        <div title="Spine crease margin. Set to 0 for seamless continuous layout across pages 1 and 2">
                          <NumberInput
                            label="Spine Fold (⇥)"
                            value={marginSpine}
                            onChange={setMarginSpine}
                            min={0}
                            max={1000}
                            step={canvasUnit === 'inch' ? 0.05 : canvasUnit === 'cm' ? 0.1 : canvasUnit === 'px' ? 5 : 0.5}
                          />
                        </div>
                      </div>

                      {marginSpine === 0 && (
                        <div className={styles.seamlessSpineBadge}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Seamless Spread: Pages 1 & 2 connect continuously across spine crease</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Photo Spacing Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="7" height="18" x="3" y="3" rx="1" />
                        <rect width="7" height="18" x="14" y="3" rx="1" />
                      </svg>
                      Photo Spacing & Gap
                    </span>
                    <span className={styles.cardSubtitle}>Inter-frame distance</span>
                  </div>

                  <div className={styles.inputRow}>
                    <div className={styles.flex1}>
                      <NumberInput
                        label="Default Frame Spacing"
                        value={spacingValue}
                        onChange={setSpacingValue}
                        min={0}
                        max={500}
                        step={canvasUnit === 'inch' ? 0.025 : canvasUnit === 'cm' ? 0.05 : canvasUnit === 'px' ? 2 : 0.5}
                      />
                    </div>
                    <div className={styles.unitSelectBox}>
                      <Select
                        label="Unit"
                        value={spacingUnit}
                        options={UNIT_OPTIONS}
                        onChange={() => {}}
                        disabled
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Appearance & Styling Settings */}
            {activeTab === 'appearance' && (
              <div className={styles.tabContent}>
                {/* Spread Background Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                        <path d="M3 9h18" />
                      </svg>
                      Spread Background Color
                    </span>
                    <span className={styles.cardSubtitle}>Canvas solid fill</span>
                  </div>

                  <ColorPicker
                    label="Background Color"
                    value={backgroundColor}
                    onChange={setBackgroundColor}
                  />
                </div>

                {/* Photo Border Card */}
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                      </svg>
                      Photo Frame Border
                    </span>
                  </div>

                  <div style={{ padding: '2px 0 4px 0' }}>
                    <Switch
                      checked={borderEnabled}
                      onChange={setBorderEnabled}
                      label="Add border stroke to photo frames"
                      size="sm"
                    />
                  </div>

                  {borderEnabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
                      <div className={styles.inputRow}>
                        <div className={styles.flex1}>
                          <NumberInput
                            label="Border Stroke Width"
                            value={borderWidth}
                            onChange={setBorderWidth}
                            min={0.01}
                            max={500}
                            step={canvasUnit === 'inch' ? 0.01 : canvasUnit === 'cm' ? 0.02 : canvasUnit === 'px' ? 1 : 0.2}
                          />
                        </div>
                        <div className={styles.unitSelectBox}>
                          <Select
                            label="Unit"
                            value={borderUnit}
                            options={UNIT_OPTIONS}
                            onChange={handleUnitChange}
                          />
                        </div>
                      </div>

                      <ColorPicker
                        label="Border Stroke Color"
                        value={borderColor}
                        onChange={setBorderColor}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Studio Live Spread Preview & Print Specs */}
          <div className={styles.rightColumn}>
            <div className={styles.previewHeader}>
              <span className={styles.previewHeading}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Live Spread Preview
              </span>
              <span className={styles.aspectBadge}>
                {currentOrientation.toUpperCase()} · {(canvasWidth / canvasHeight).toFixed(2)}:1
              </span>
            </div>

            {/* Realistic 3D Mockup Stage */}
            <div className={styles.mockupStage}>
              <div
                className={styles.albumSpread}
                style={{
                  width: `${previewBoxW}px`,
                  height: `${previewBoxH}px`,
                  backgroundColor: backgroundColor,
                }}
              >
                {/* Left Album Page */}
                <div className={styles.albumPageLeft}>
                  {marginEnabled && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        bottom: '8px',
                        left: '12px',
                        right: isMargin4S && marginSpine === 0 ? '0px' : '8px',
                        border: '1px dashed rgba(56, 189, 248, 0.55)',
                        borderRight: isMargin4S && marginSpine === 0 ? 'none' : '1px dashed rgba(56, 189, 248, 0.55)',
                        pointerEvents: 'none',
                      }}
                      title="Safe Margin Guide"
                    />
                  )}
                  <div
                    className={styles.photoPlaceholder}
                    style={{
                      borderWidth: borderEnabled ? '1.5px' : '0',
                      borderColor: borderColor,
                    }}
                  />
                  <span className={styles.pageNumberBadge}>1</span>
                </div>

                {/* 3D Center Spine Crease */}
                <div className={styles.albumSpine} />

                {/* Right Album Page */}
                <div className={styles.albumPageRight}>
                  {marginEnabled && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        bottom: '8px',
                        left: isMargin4S && marginSpine === 0 ? '0px' : '8px',
                        right: '12px',
                        border: '1px dashed rgba(56, 189, 248, 0.55)',
                        borderLeft: isMargin4S && marginSpine === 0 ? 'none' : '1px dashed rgba(56, 189, 248, 0.55)',
                        pointerEvents: 'none',
                      }}
                      title="Safe Margin Guide"
                    />
                  )}
                  <div
                    className={styles.photoPlaceholder}
                    style={{
                      borderWidth: borderEnabled ? '1.5px' : '0',
                      borderColor: borderColor,
                    }}
                  />
                  <span className={styles.pageNumberBadge}>2</span>
                </div>
              </div>
            </div>

            {/* Studio Print Specifications */}
            <div className={styles.specsCard}>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Single Page:</span>
                <span className={styles.specValue}>
                  {formatDimensions(canvasWidth, canvasHeight, canvasUnit)}
                </span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Open Spread:</span>
                <span className={styles.specValue}>
                  {formatDimensions(spreadWidth, spreadHeight, canvasUnit)}
                </span>
              </div>
              <div className={styles.specDivider} />
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Print Canvas:</span>
                <span className={styles.specValueHighlight}>
                  {spreadPxW} × {spreadPxH} px
                </span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Resolution:</span>
                <span className={styles.specValue}>{canvasDpi} DPI ({megapixels} MP)</span>
              </div>
              <div className={styles.specDivider} />
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Safe Margins:</span>
                <span className={styles.specValue}>
                  {marginEnabled
                    ? isMargin4S
                      ? `T:${marginTop} B:${marginBottom} O:${marginOutside} S:${marginSpine} ${marginUnit}`
                      : `${marginValue} ${marginUnit}`
                    : 'None'}
                </span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Photo Gap:</span>
                <span className={styles.specValue}>{spacingValue} {spacingUnit}</span>
              </div>
              <div className={styles.specRow}>
                <span className={styles.specLabel}>Photo Border:</span>
                <span className={styles.specValue}>
                  {borderEnabled ? `${borderWidth} ${borderUnit}` : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dialog Footer Actions */}
        <div className={styles.dialogFooter}>
          <Button
            type="button"
            variant="ghost"
            onClick={closeNewProject}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Project...' : 'Create Album Project'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
