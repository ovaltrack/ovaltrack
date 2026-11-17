import { Theme } from '../../core/services/theme.service';

/** `src` y `srcset` de una captura de la app. */
export interface ScreenshotSources {
  readonly src: string;
  readonly srcset: string;
}

/**
 * Las capturas existen en claro y oscuro y en dos anchos: `<base>-<tema>-800.webp` y `<base>-<tema>-1600.webp`.
 * Devuelve las del tema activo, así la captura acompaña al resto de la pantalla.
 */
export function themedScreenshot(base: string, theme: Theme): ScreenshotSources {
  const file = (width: number): string => `${base}-${theme}-${width}.webp`;
  return { src: file(800), srcset: `${file(800)} 800w, ${file(1600)} 1600w` };
}
