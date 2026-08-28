import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Button } from '../../components/ui/Button';
import { NumberInput } from '../../components/ui/NumberInput';
import { Select } from '../../components/ui/Select';
import { ColorPicker } from '../../components/ui/ColorPicker';
import { useProjectStore } from '../../stores/projectStore';
import { Unit, UNIT_OPTIONS, convertUnit, formatDimensions, toPixels } from '../../domain/units';
import { ALBUM_PRESETS, CUSTOM_PRESET_ID, findMatchingPreset, getPresetById } from '../../domain/presets';
import { validateProjectSettings } from '../../domain/project';
import styles from './NewProjectDialog.module.css';

const PRESET_OPTIONS = [
  ...ALBUM_PRESETS.map((p) => ({ value: p.id, label: p.name })),
  { value: CUSTOM_PRESET_ID, label: 'Custom Dimensions' },
];

export function NewProjectDialog() {
  const isOpen = useProjectStore((s) => s.isNewProjectOpen);
  const closeNewProject = useProjectStore((s) => s.closeNewProject);
  const createNewProject = useProjectStore((s) => s.createNewProject);

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

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName('Untitled Album');
      setPresetId('square-8x8');
      setCanvasWidth(8);
      setCanvasHeight(8);
      setCanvasUnit('inch');
      setCanvasDpi(300);
      setSpacingValue(3);
      setSpacingUnit('mm');
      setMarginEnabled(true);
      setMarginValue(10);
      setMarginUnit('mm');
      setBorderEnabled(false); // Default nonaktif
      setBorderWidth(1);
      setBorderUnit('mm');
      setBorderColor('#FFFFFF');
      setBackgroundColor('#FFFFFF');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Preset Selection
  const handlePresetSelect = (id: string) => {
    setPresetId(id);
    if (id === CUSTOM_PRESET_ID) return;

    const preset = getPresetById(id);
    if (preset) {
      setCanvasWidth(preset.width);
      setCanvasHeight(preset.height);
      setCanvasUnit(preset.unit);
      setCanvasDpi(preset.dpi);
    }
  };

  // Unit Change with automatic mathematical conversion
  const handleUnitChange = (newUnitStr: string) => {
    const newUnit = newUnitStr as Unit;
    if (newUnit === canvasUnit) return;

    const convertedW = convertUnit(canvasWidth, canvasUnit, newUnit, canvasDpi);
    const convertedH = convertUnit(canvasHeight, canvasUnit, newUnit, canvasDpi);

    setCanvasWidth(convertedW);
    setCanvasHeight(convertedH);
    setCanvasUnit(newUnit);

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

              <Select
                label="Album Preset"
                value={presetId}
                options={PRESET_OPTIONS}
                onChange={handlePresetSelect}
              />

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

            {/* Safe Margin / Batas Tepi (Request 5) */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Safe Margin (Batas Tepi Aman)</div>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={marginEnabled}
                  onChange={(e) => setMarginEnabled(e.target.checked)}
                />
                <span className={styles.checkboxLabel}>Enable safe margin guides</span>
              </label>

              {marginEnabled && (
                <div className={styles.row}>
                  <div className={styles.flex1}>
                    <NumberInput
                      label="Margin Tepi"
                      value={marginValue}
                      onChange={setMarginValue}
                      min={0}
                      max={100}
                      step={0.5}
                    />
                  </div>
                  <div style={{ width: '90px' }}>
                    <Select
                      label="Unit"
                      value={marginUnit}
                      options={UNIT_OPTIONS}
                      onChange={(u) => setMarginUnit(u as Unit)}
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
                    max={100}
                    step={0.5}
                  />
                </div>
                <div style={{ width: '90px' }}>
                  <Select
                    label="Unit"
                    value={spacingUnit}
                    options={UNIT_OPTIONS}
                    onChange={(u) => setSpacingUnit(u as Unit)}
                  />
                </div>
              </div>
            </div>

            {/* Photo Border (Request 4: Default Nonaktif) */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Photo Border</div>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={borderEnabled}
                  onChange={(e) => setBorderEnabled(e.target.checked)}
                />
                <span className={styles.checkboxLabel}>Enable photo border</span>
              </label>

              {borderEnabled && (
                <div className={styles.row}>
                  <div className={styles.flex1}>
                    <NumberInput
                      label="Border Width"
                      value={borderWidth}
                      onChange={setBorderWidth}
                      min={0.1}
                      max={50}
                      step={0.5}
                    />
                  </div>
                  <div style={{ width: '90px' }}>
                    <Select
                      label="Unit"
                      value={borderUnit}
                      options={UNIT_OPTIONS}
                      onChange={(u) => setBorderUnit(u as Unit)}
                    />
                  </div>
                  <div className={styles.flex1}>
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
