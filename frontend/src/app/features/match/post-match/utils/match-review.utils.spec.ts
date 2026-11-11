import { resolveEventColor } from './match-review.utils';

describe('resolveEventColor', () => {
  it('cada regla de nombre devuelve su token de color', () => {
    const casos: Array<[string, string]> = [
      ['Try', 'var(--event-try)'],
      ['Try penal', 'var(--event-try)'],
      ['Tackle fallado', 'var(--event-tackle-missed)'],
      ['Tackle completado', 'var(--event-tackle)'],
      ['Penal / infracción', 'var(--event-penalty)'],
      ['Tarjeta amarilla', 'var(--event-penalty)'],
      ['Tarjeta roja', 'var(--event-penalty)'],
      ['Line-out', 'var(--event-set-piece)'],
      ['Scrum', 'var(--event-set-piece)'],
      ['Turnover ganado', 'var(--event-turnover)'],
      ['Drop goal', 'var(--event-kick)'],
      ['Conversión', 'var(--event-kick)'],
      ['Ruck ofensivo', 'var(--event-default)']
    ];

    for (const [nombre, token] of casos) {
      expect(resolveEventColor(nombre)).toBe(token);
    }
  });

  it('no distingue mayúsculas', () => {
    expect(resolveEventColor('LINE-OUT')).toBe('var(--event-set-piece)');
  });

  it('Turnover y Line-out ya no comparten token', () => {
    expect(resolveEventColor('Turnover ganado')).not.toBe(resolveEventColor('Line-out'));
  });
});
