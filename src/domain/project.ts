import { Unit } from './units';

export interface ProjectSettings {
  name: string;
  canvas: {
    width: number;
    height: number;
    unit: Unit;
    dpi: number;
  };
  spacing: {
    value: number;
    unit: Unit;
  };
  margin: {
    enabled: boolean;
    value: number;
    unit: Unit;
  };
  photoInset?: {
    value: number;
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    unit: Unit;
  };
  border: {
    enabled: boolean;
    width: number;
    unit: Unit;
    color: string;
  };
  background: {
    type: 'solid';
    color: string;
  };
}

export interface Project {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  canvasUnit: Unit;
  canvasDpi: number;
  spacingValue: number;
  spacingUnit: Unit;
  marginEnabled?: boolean;
  marginValue?: number;
  marginUnit?: Unit;
  photoInset?: number;
  photoInsetTop?: number;
  photoInsetBottom?: number;
  photoInsetLeft?: number;
  photoInsetRight?: number;
  photoInsetUnit?: Unit;
  borderEnabled: boolean;
  borderWidth: number;
  borderUnit: Unit;
  borderColor: string;
  backgroundType: string;
  backgroundColor: string;
  filePath?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  name: 'Untitled Album',
  canvas: {
    width: 20,
    height: 20,
    unit: 'cm',
    dpi: 300,
  },
  spacing: {
    value: 2,
    unit: 'cm',
  },
  margin: {
    enabled: true,
    value: 2,
    unit: 'cm',
  },
  photoInset: {
    value: 2,
    top: 2,
    bottom: 2,
    left: 2,
    right: 2,
    unit: 'cm',
  },
  border: {
    enabled: false, // Default disabled
    width: 0.1,
    unit: 'cm',
    color: '#FFFFFF',
  },
  background: {
    type: 'solid',
    color: '#FFFFFF',
  },
};

export interface ValidationError {
  field: string;
  message: string;
}

export function validateProjectSettings(settings: ProjectSettings): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!settings.name || settings.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Project name is required' });
  }

  if (settings.canvas.width <= 0) {
    errors.push({ field: 'canvas.width', message: 'Canvas width must be greater than 0' });
  }

  if (settings.canvas.height <= 0) {
    errors.push({ field: 'canvas.height', message: 'Canvas height must be greater than 0' });
  }

  if (settings.canvas.dpi <= 0) {
    errors.push({ field: 'canvas.dpi', message: 'DPI must be greater than 0' });
  }

  if (settings.spacing.value < 0) {
    errors.push({ field: 'spacing.value', message: 'Spacing cannot be negative' });
  }

  if (settings.margin.enabled && settings.margin.value < 0) {
    errors.push({ field: 'margin.value', message: 'Margin cannot be negative' });
  }

  if (settings.border.enabled && settings.border.width < 0) {
    errors.push({ field: 'border.width', message: 'Border width cannot be negative' });
  }

  return errors;
}
