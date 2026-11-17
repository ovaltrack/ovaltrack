import { themedScreenshot } from './screenshot';

describe('themedScreenshot', () => {
  it('arma src y srcset con el tema claro', () => {
    expect(themedScreenshot('assets/landing/statistics', 'light')).toEqual({
      src: 'assets/landing/statistics-light-800.webp',
      srcset: 'assets/landing/statistics-light-800.webp 800w, assets/landing/statistics-light-1600.webp 1600w'
    });
  });

  it('usa las capturas oscuras con el tema oscuro', () => {
    const { src, srcset } = themedScreenshot('assets/landing/live-capture', 'dark');
    expect(src).toBe('assets/landing/live-capture-dark-800.webp');
    expect(srcset).toContain('live-capture-dark-1600.webp 1600w');
  });
});
