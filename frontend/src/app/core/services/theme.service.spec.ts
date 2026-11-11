import { ThemeService } from './theme.service';

const STORAGE_KEY = 'ovaltrack_theme';

describe('ThemeService', () => {
  let storage: Map<string, string>;
  let rootAttributes: Map<string, string>;

  beforeEach(() => {
    storage = new Map<string, string>();
    rootAttributes = new Map<string, string>();
    (globalThis as Record<string, unknown>)['localStorage'] = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    };
    (globalThis as Record<string, unknown>)['document'] = {
      documentElement: { setAttribute: (name: string, value: string) => rootAttributes.set(name, value) }
    };
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)['localStorage'];
    delete (globalThis as Record<string, unknown>)['document'];
  });

  it('sin tema guardado arranca en oscuro y lo aplica al documento', () => {
    const service = new ThemeService();

    expect(service.theme()).toBe('dark');
    expect(rootAttributes.get('data-theme')).toBe('dark');
  });

  it('respeta el tema guardado al crearse', () => {
    storage.set(STORAGE_KEY, 'light');

    const service = new ThemeService();

    expect(service.theme()).toBe('light');
    expect(rootAttributes.get('data-theme')).toBe('light');
  });

  it('toggleTheme alterna el tema, lo aplica al documento y lo guarda', () => {
    const service = new ThemeService();

    service.toggleTheme();
    expect(service.theme()).toBe('light');
    expect(rootAttributes.get('data-theme')).toBe('light');
    expect(storage.get(STORAGE_KEY)).toBe('light');

    service.toggleTheme();
    expect(service.theme()).toBe('dark');
    expect(storage.get(STORAGE_KEY)).toBe('dark');
  });

  it('ignora un valor guardado inválido', () => {
    storage.set(STORAGE_KEY, 'azul');

    expect(new ThemeService().theme()).toBe('dark');
  });
});
