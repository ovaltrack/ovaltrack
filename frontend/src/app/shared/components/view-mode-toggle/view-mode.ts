import { PersistedSignal, oneOf, persistedSignal } from '../../utils/persisted-signal';

/** Cómo se muestran las estadísticas de una pantalla: las filas de siempre o gráficos de dona. */
export type StatsViewMode = 'list' | 'chart';

const STATS_VIEW_MODES: readonly StatsViewMode[] = ['list', 'chart'];

/** Preferencia de visualización de una pantalla: se recuerda mientras dure la pestaña, como sus filtros. */
export function statsViewModeSignal(key: string): PersistedSignal<StatsViewMode> {
  return persistedSignal<StatsViewMode>(key, 'list', { isValid: oneOf(STATS_VIEW_MODES) });
}
