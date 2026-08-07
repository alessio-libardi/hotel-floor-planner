import { layoutCanvasPalette } from './layout-canvas-palette';

describe('layoutCanvasPalette', () => {
  it('uses the existing light canvas colors in light mode', () => {
    const palette = layoutCanvasPalette(false);

    expect(palette.tableFill).toBe('#dbeafe');
    expect(palette.containerFill).toBe('#f1f5f9');
    expect(palette.itemText).toBe('#0f172a');
  });

  it('uses muted surfaces and softer text in dark mode', () => {
    const palette = layoutCanvasPalette(true);

    expect(palette.tableFill).toBe('#1e344d');
    expect(palette.containerFill).toBe('#202936');
    expect(palette.itemText).toBe('#dbe4ef');
    expect(palette.selection).toBe('#60a5fa');
  });
});
