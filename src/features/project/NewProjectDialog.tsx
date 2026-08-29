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
  const [presetId, setPresetId] = useState<string>('square-8x8');
  const [canvasWidth, setCanvasWidth] = useState(8);
  const [canvasHeight, setCanvasHeight] = useState(8);
  const [canvasUnit, setCanvasUnit] = useState<Unit>('inch');
  const [canvasDpi, setCanvasDpi] = useState(300);

  const [spacingValue, setSpacingValue] = useState(3);
  const [spacingUnit, setSpacingUnit] = useState<Unit>('mm');

  // Request 5: Safe Margin
  const [marginEnabled, setMarginEnabled] = useState(true);
  const [marginValue, setMarginValue] = useState(10);
  const [marginUnit, setMarginUnit] = useState<Unit>('mm');

  // Request 4: Default border is disabled (false)
  const [borderEnabled, setBorderEnabled] = useState(false);
  const [borderWidth, setBorderWidth] = useState(1);
  const [borderUnit, setBorderUnit] = useState<Unit>('mm');
  const [borderColor, setBorderColor] = useState('#FFFFFF');

  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setPresetId('square-8x8');
      setCanvasWidth(8);
      setCanvasHeight(8);
      setCanvasUnit('inch');
      setCanvasDpi(300);
      setSpacingValue(0.12);
      setSpacingUnit('inch');
      setMarginEnabled(true);
      setMarginValue(0.5);
      setMarginUnit('inch');
      setBorderEnabled(false); // Default disabled
      setBorderWidth(0.04);
      setBorderUnit('inch');
      setBorderColor('#FFFFFF');
      setBackgroundColor('#FFFFFF');
      setErrorMessage(null);
      setIsSubmitting(false);
      setIsSavePresetOpen(false);
      setCustomPresetName('');
      setPresetSaveSuccess(null);
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
  if (previewBoxH > 130) {
    previewBoxH = 130;
    previewBoxW = Math.round(130 * previewRatio);
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
      width={720}
      closeOnOverlayClick={false}
      closeOnEscape={false}
    >
      <form onSubmit={handleSubmit}>
        {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}

        <div className={styles.container}>
          {/* Left Column: Configuration Form */}
          <div className={styles.leftColumn}>
            {/* Project Name */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Project Name</label>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Wedding Album 2026"
                autoFocus
              />
            </div>

            {/* Album Page Settings */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Page Dimensions</div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <Select
                    label="Album Preset"
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
                  onClick={() => {
                    setCustomPresetName(`${canvasWidth}×${canvasHeight} ${canvasUnit} Custom`);
                    setIsSavePresetOpen(!isSavePresetOpen);
                  }}
                  title="Save current dimensions and settings as a reusable preset"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '0 10px',
                    fontSize: '11px',
                    fontWeight: 500,
                    borderRadius: '4px',
                    border: '1px solid var(--color-border)',
                    background: isSavePresetOpen ? 'var(--color-surface-hover)' : 'var(--color-surface)',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    height: '32px',
                    marginBottom: '1px',
                  }}
                >
                  ★ Save as Preset
                </button>
                {Boolean(allPresets.find((p) => p.id === presetId)?.isCustom) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomPreset(presetId)}
                    title="Delete this custom preset"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--color-danger, #ef4444)',
                      cursor: 'pointer',
                      height: '32px',
                      marginBottom: '1px',
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>

              {isSavePresetOpen && (
                <div
                  style={{
                    background: 'var(--color-surface-hover, rgba(255,255,255,0.05))',
                    border: '1px solid var(--color-accent)',
                    borderRadius: '6px',
                    padding: '10px',
                    marginBottom: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-accent)' }}>
                    Save Current Configuration as Preset
                  </div>
                  <input
                    type="text"
                    className={styles.input}
                    value={customPresetName}
                    onChange={(e) => setCustomPresetName(e.target.value)}
                    placeholder="Enter preset name (e.g. 10x10 Wedding Standard)"
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
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
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
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-success, #10b981)',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    marginBottom: '8px',
                  }}
                >
                  {presetSaveSuccess}
                </div>
              )}

              {/* Orientation Switcher & Swap */}
              <div className={styles.formGroup}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className={styles.label}>Orientation</label>
                  <button
                    type="button"
                    onClick={handleSwapDimensions}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-accent)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                    }}
                    title="Swap width and height values"
                  >
                    ⇄ Swap W ↔ H
                  </button>
                </div>
                <div className={styles.orientationGroup}>
                  <button
                    type="button"
                    className={`${styles.orientBtn} ${currentOrientation === 'square' ? styles.orientBtnActive : ''}`}
                    onClick={() => handleOrientation('square')}
                  >
                    ◫ Square
                  </button>
                  <button
                    type="button"
                    className={`${styles.orientBtn} ${currentOrientation === 'portrait' ? styles.orientBtnActive : ''}`}
                    onClick={() => handleOrientation('portrait')}
                  >
                    ▯ Portrait
                  </button>
                  <button
                    type="button"
                    className={`${styles.orientBtn} ${currentOrientation === 'landscape' ? styles.orientBtnActive : ''}`}
                    onClick={() => handleOrientation('landscape')}
                  >
                    ▭ Landscape
                  </button>
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.flex1}>
                  <NumberInput
                    label="Page Width"
                    value={canvasWidth}
                    onChange={handleWidthChange}
                    min={1}
                    max={2000}
                    step={canvasUnit === 'inch' ? 0.5 : 1}
                  />
                </div>

                <div className={styles.flex1}>
                  <NumberInput
                    label="Page Height"
                    value={canvasHeight}
                    onChange={handleHeightChange}
                    min={1}
                    max={2000}
                    step={canvasUnit === 'inch' ? 0.5 : 1}
                  />
                </div>

                <div style={{ width: '90px' }}>
                  <Select
                    label="Unit"
                    value={canvasUnit}
                    options={UNIT_OPTIONS}
                    onChange={handleUnitChange}
                  />
                </div>
              </div>

              <div className={styles.row}>
                <div className={styles.flex1}>
                  <NumberInput
                    label="Resolution (DPI)"
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

            {/* Safe Margin */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Safe Zone Margins</div>
              <div style={{ padding: '2px 0 6px 0' }}>
                <Switch
                  checked={marginEnabled}
                  onChange={setMarginEnabled}
                  label="Enable safe margin guides"
                  size="sm"
                />
              </div>

              {marginEnabled && (
                <div className={styles.row}>
                  <div className={styles.flex1}>
                    <NumberInput
                      label="Safe Margin"
                      value={marginValue}
                      onChange={setMarginValue}
                      min={0.1}
                      max={1000}
                      step={canvasUnit === 'inch' ? 0.05 : canvasUnit === 'cm' ? 0.1 : canvasUnit === 'px' ? 5 : 0.5}
                    />
                  </div>
                  <div style={{ width: '90px' }}>
                    <Select
                      label="Unit"
                      value={marginUnit}
                      options={UNIT_OPTIONS}
                      onChange={handleUnitChange}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Photo Spacing */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Photo Spacing & Gap</div>
              <div className={styles.row}>
                <div className={styles.flex1}>
                  <NumberInput
                    label="Spacing"
                    value={spacingValue}
                    onChange={setSpacingValue}
                    min={0}
                    max={500}
                    step={canvasUnit === 'inch' ? 0.025 : canvasUnit === 'cm' ? 0.05 : canvasUnit === 'px' ? 2 : 0.5}
                  />
                </div>
                <div style={{ width: '90px' }}>
                  <Select
                    label="Unit"
                    value={spacingUnit}
                    options={UNIT_OPTIONS}
                    onChange={handleUnitChange}
                  />
                </div>
              </div>
            </div>

            {/* Photo Border (Request 4: Default Nonaktif) */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Photo Border</div>
              <div style={{ padding: '2px 0 6px 0' }}>
                <Switch
                  checked={borderEnabled}
                  onChange={setBorderEnabled}
                  label="Enable photo border"
                  size="sm"
                />
              </div>

              {borderEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <div className={styles.row}>
                    <div className={styles.flex1}>
                      <NumberInput
                        label="Border Width"
                        value={borderWidth}
                        onChange={setBorderWidth}
                        min={0.01}
                        max={500}
                        step={canvasUnit === 'inch' ? 0.01 : canvasUnit === 'cm' ? 0.02 : canvasUnit === 'px' ? 1 : 0.2}
                      />
                    </div>
                    <div style={{ width: '90px' }}>
                      <Select
                        label="Unit"
                        value={borderUnit}
                        options={UNIT_OPTIONS}
                        onChange={handleUnitChange}
                      />
                    </div>
                  </div>

                  <div>
                    <ColorPicker
                      label="Border Color"
                      value={borderColor}
                      onChange={setBorderColor}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Canvas Background */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Spread Background</div>
              <ColorPicker
                label="Background Color"
                value={backgroundColor}
                onChange={setBackgroundColor}
              />
            </div>
          </div>

          {/* Right Column: Live Spread Preview */}
          <div className={styles.rightColumn}>
            <div className={styles.previewTitle}>Live Spread Preview</div>

            <div className={styles.previewCanvas}>
              <div
                className={styles.spreadContainer}
                style={{
                  width: `${previewBoxW}px`,
                  height: `${previewBoxH}px`,
                  backgroundColor: backgroundColor,
                }}
              >
                {/* Left Page */}
                <div className={styles.leftPage}>
                  {marginEnabled && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        bottom: '8px',
                        left: '8px',
                        right: '8px',
                        border: '1px dashed rgba(59, 130, 246, 0.45)',
                        pointerEvents: 'none',
                      }}
                      title="Safe Margin Guide"
                    />
                  )}
                  <div
                    className={styles.samplePhotoBox}
                    style={{
                      borderWidth: borderEnabled ? '1.5px' : '0',
                      borderColor: borderColor,
                    }}
                  />
                </div>

                {/* Center Spine / Gutter */}
                <div className={styles.centerGutter} />

                {/* Right Page */}
                <div className={styles.rightPage}>
                  {marginEnabled && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        bottom: '8px',
                        left: '8px',
                        right: '8px',
                        border: '1px dashed rgba(59, 130, 246, 0.45)',
                        pointerEvents: 'none',
                      }}
                      title="Safe Margin Guide"
                    />
                  )}
                  <div
                    className={styles.samplePhotoBox}
                    style={{
                      borderWidth: borderEnabled ? '1.5px' : '0',
                      borderColor: borderColor,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className={styles.previewSpecs}>
              <div className={styles.specRow}>
                <span>Single Page:</span>
                <span className={styles.specValue}>
                  {formatDimensions(canvasWidth, canvasHeight, canvasUnit)}
                </span>
              </div>
              <div className={styles.specRow}>
                <span>Open Spread:</span>
                <span className={styles.specValue}>
                  {formatDimensions(spreadWidth, spreadHeight, canvasUnit)}
                </span>
              </div>
              <div className={styles.specRow}>
                <span>Print Canvas:</span>
                <span className={styles.specValue}>
                  {spreadPxW} × {spreadPxH} px
                </span>
              </div>
              <div className={styles.specRow}>
                <span>Resolution:</span>
                <span className={styles.specValue}>{canvasDpi} DPI ({megapixels} MP)</span>
              </div>
              <div className={styles.specRow}>
                <span>Safe Margin:</span>
                <span className={styles.specValue}>
                  {marginEnabled ? `${marginValue} ${marginUnit}` : 'None'}
                </span>
              </div>
              <div className={styles.specRow}>
                <span>Photo Gap:</span>
                <span className={styles.specValue}>{spacingValue} {spacingUnit}</span>
              </div>
              <div className={styles.specRow}>
                <span>Photo Border:</span>
                <span className={styles.specValue}>
                  {borderEnabled ? `${borderWidth} ${borderUnit}` : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className={styles.footer}>
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
