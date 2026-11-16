import { formatCountdown } from './countdown';

describe('countdown', () => {
  it('formatea HH:MM:SS', () => {
    expect(formatCountdown((5 * 3600 + 7 * 60 + 9) * 1000)).toBe('05:07:09');
  });

  it('se detiene en 00:00:00 cuando el partido ya empezó', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-45_000)).toBe('00:00:00');
  });

  it('descarta los milisegundos sobrantes', () => {
    expect(formatCountdown(1999)).toBe('00:00:01');
  });
});
