import { formatDecimal, formatPercent, formatSigned } from './number-format';

describe('number-format', () => {
  it('formatDecimal usa coma y no deja ceros de más', () => {
    expect(formatDecimal(74.9)).toBe('74,9');
    expect(formatDecimal(4)).toBe('4');
    expect(formatDecimal(75.0)).toBe('75');
    expect(formatDecimal(10)).toBe('10');
    expect(formatDecimal(0)).toBe('0');
    expect(formatDecimal(7.25, 2)).toBe('7,25');
  });

  it('formatSigned lleva el signo y el menos tipográfico', () => {
    expect(formatSigned(4)).toBe('+4');
    expect(formatSigned(11.7)).toBe('+11,7');
    expect(formatSigned(-16.9)).toBe('−16,9');
    expect(formatSigned(0)).toBe('0');
  });

  it('formatPercent deja un espacio antes del %', () => {
    expect(formatPercent(74.9)).toBe('74,9 %');
    expect(formatPercent(100)).toBe('100 %');
  });
});
