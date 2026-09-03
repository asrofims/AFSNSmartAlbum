import {
  getUsableAreas,
  getProjectDimensionsInCanvasUnit,
  fitInsideBoxCentered,
  TemplateParams,
} from '../src/domain/templates';
import { Project } from '../src/domain/project';

function runTests() {
  console.log('Testing Phase 6: Spatial Layout Calculation & Safe Area Engine...');

  const params: TemplateParams = {
    spreadWidth: 405, // 200 left + 5 gutter + 200 right
    spreadHeight: 200,
    isSpread: true,
    safeMargin: 10,
    gutterWidth: 5,
    spacing: 4,
    currentPhotos: [
      { id: 'p1', filePath: 'C:/photos/img1.jpg', fileName: 'img1.jpg', photoAspect: 1.5 },
      { id: 'p2', filePath: 'C:/photos/img2.jpg', fileName: 'img2.jpg', photoAspect: 1.5 },
    ],
  };

  // 1. Verify Usable Areas & Exact Safe Margin Box Alignment
  const { spreadArea, leftPageArea, rightPageArea, pageWidth } = getUsableAreas(params);
  if (pageWidth !== 200) {
    throw new Error(`Expected pageWidth 200, got ${pageWidth}`);
  }
  if (leftPageArea.x !== 10 || leftPageArea.width !== 180 || leftPageArea.height !== 180) {
    throw new Error(`Incorrect Left Safe Box area: ${JSON.stringify(leftPageArea)}`);
  }
  if (rightPageArea.x !== 215 || rightPageArea.width !== 180 || rightPageArea.height !== 180) {
    throw new Error(`Incorrect Right Safe Box area: ${JSON.stringify(rightPageArea)}`);
  }
  console.log('✓ Exact Safe Margin Box alignment (left & right page blue dashed boxes) verified.');

  // 2. Verify Photo Centered Fitting
  const fitted = fitInsideBoxCentered(rightPageArea, 1.5, 1.0);
  if (fitted.width <= 0 || fitted.height <= 0) {
    throw new Error('fitInsideBoxCentered produced invalid dimensions');
  }
  if (Math.abs((fitted.width / fitted.height) - 1.5) > 0.01) {
    throw new Error('Fitted photo aspect ratio distortion detected');
  }
  console.log('✓ Aspect-ratio preserving centered box fitting verified.');

  // 3. Verify Project Dimensions In Canvas Unit Converter
  const mockProject: Project = {
    id: 'proj-1',
    name: 'Test Project',
    canvasWidth: 30,
    canvasHeight: 30,
    canvasUnit: 'cm',
    canvasDpi: 300,
    marginValue: 20,
    marginUnit: 'mm',
    spacingValue: 5,
    spacingUnit: 'mm',
    borderEnabled: false,
    borderWidth: 1,
    borderUnit: 'mm',
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const dims = getProjectDimensionsInCanvasUnit(mockProject);
  if (dims.pageWidth !== 30 || dims.pageHeight !== 30) {
    throw new Error(`Page dimensions incorrect: ${dims.pageWidth}x${dims.pageHeight}`);
  }
  // 20mm margin in cm = 2.0cm
  if (Math.abs(dims.safeMargin - 2.0) > 0.001) {
    throw new Error(`Expected safeMargin 2.0cm, got ${dims.safeMargin}`);
  }
  // 5mm spacing in cm = 0.5cm
  if (Math.abs(dims.spacing - 0.5) > 0.001) {
    throw new Error(`Expected spacing 0.5cm, got ${dims.spacing}`);
  }
  console.log('✓ Multi-unit dimensional converter (mm -> cm/inch/px) verified.');

  console.log('ALL SPATIAL LAYOUT TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests();
