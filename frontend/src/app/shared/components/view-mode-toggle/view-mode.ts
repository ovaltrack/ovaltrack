import { PersistedSignal, oneOf, persistedSignal } from '../../utils/persisted-signal';

/** Cómo se muestran las estadísticas de una pantalla: las filas de siempre, donas o barras. */
export type StatsViewMode = 'list' | 'chart' | 'bars';

const STATS_VIEW_MODES: readonly StatsViewMode[] = ['list', 'chart', 'bars'];

/** Un botón del selector: qué modo activa y cómo se ve. */
export interface ViewModeOption {
  mode: StatsViewMode;
  label: string;
  icon: string;
}

/** Las tres opciones de siempre; una pantalla con otros nombres (la división) pasa las suyas. */
export const STATS_VIEW_OPTIONS: readonly ViewModeOption[] = [
  { mode: 'list', label: 'Lista', icon: 'bi-list-ul' },
  { mode: 'chart', label: 'Donas', icon: 'bi-pie-chart' },
  { mode: 'bars', label: 'Barras', icon: 'bi-bar-chart' },
];

export const isStatsViewMode = oneOf(STATS_VIEW_MODES);

/** Preferencia de visualización de una pantalla: se recuerda mientras dure la pestaña, como sus filtros. */
export function statsViewModeSignal(key: string): PersistedSignal<StatsViewMode> {
  return persistedSignal<StatsViewMode>(key, 'list', { isValid: isStatsViewMode });
}
