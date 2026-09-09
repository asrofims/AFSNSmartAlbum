/** Use one physical-to-screen scale for the sheet, frames, and page guides. */
export function calculateSpreadViewport(
  spreadWidth: number,
  spreadHeight: number,
  availableWidth: number,
  availableHeight: number,
  zoomScale: number,
): { width: number; height: number; scaleFactor: number } {
  const scaleFactor = Math.min(availableWidth / spreadWidth, availableHeight / spreadHeight) * zoomScale;
  return {
    width: spreadWidth * scaleFactor,
    height: spreadHeight * scaleFactor,
    scaleFactor,
  };
}
