const MINUS = '−';

/** Decimales con coma y sin ceros de más: 74.9 → "74,9", 4 → "4". */
export function formatDecimal(value: number, decimals = 1): string {
  const text = value.toFixed(decimals);
  const trimmed = text.includes('.') ? text.replace(/\.?0+$/, '') : text;
  return trimmed.replace('.', ',');
}

/** Con signo explícito y el menos tipográfico: 4 → "+4", -16.9 → "−16,9", 0 → "0". */
export function formatSigned(value: number, decimals = 1): string {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : MINUS}${formatDecimal(Math.abs(value), decimals)}`;
}

/** "74,9 %": coma decimal y espacio antes del símbolo. */
export function formatPercent(value: number, decimals = 1): string {
  return `${formatDecimal(value, decimals)} %`;
}
