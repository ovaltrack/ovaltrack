import { PlayerMatchSummary, PlayerMetrics } from '../../player-statistics/types/player-stats-api.types';
import { formatDecimal } from './number-format';

export interface MatchTakeaways {
  /** Hasta 3 líneas: mejor marca de la temporada, hito y penales. */
  lines: string[];
  /** Aviso cuando el análisis del partido está incompleto: los números pueden cambiar. */
  provisionalNote: string | null;
}

export const TAKEAWAY_LINES = 3;
/** Una mejor marca solo tiene sentido con al menos 2 partidos anteriores con que compararse. */
export const BEST_MIN_PREVIOUS = 2;
export const PROVISIONAL_NOTE = 'Tus acciones todavía se están cargando: estos números pueden cambiar.';

type Counter = 'points' | 'tries' | 'tacklesMade';

interface CounterDefinition {
  key: Counter;
  /** Con «de la temporada»: «tackles», «puntos». */
  plural: string;
  /** Cada cuántos se celebra un hito. */
  step: number;
}

/** El orden es la prioridad de la mejor marca. */
const COUNTERS: readonly CounterDefinition[] = [
  { key: 'points', plural: 'puntos', step: 50 },
  { key: 'tries', plural: 'tries', step: 5 },
  { key: 'tacklesMade', plural: 'tackles', step: 50 }
];

const sum = (matches: readonly PlayerMatchSummary[], key: keyof PlayerMetrics): number => matches.reduce((total, match) => total + match.metrics[key], 0);

function bestMark(previous: readonly PlayerMatchSummary[], current: PlayerMatchSummary): string | null {
  if (previous.length < BEST_MIN_PREVIOUS) return null;
  const record = COUNTERS.find(({ key }) => current.metrics[key] > 0 && current.metrics[key] > Math.max(...previous.map(match => match.metrics[key])));
  return record ? `Tu mejor partido en ${record.plural} de la temporada: ${current.metrics[record.key]}` : null;
}

function milestone(previous: readonly PlayerMatchSummary[], current: PlayerMatchSummary): string | null {
  for (const { key, plural, step } of COUNTERS) {
    const before = sum(previous, key);
    const after = before + current.metrics[key];
    const reached = Math.floor(after / step) * step;
    if (reached > 0 && reached > before) return `Llegaste a ${reached} ${plural} en la temporada`;
  }
  return null;
}

function penalties(previous: readonly PlayerMatchSummary[], current: PlayerMatchSummary): string | null {
  const count = current.metrics.penaltiesConceded;
  if (count === 0) return null;
  const text = `${count} ${count === 1 ? 'penal cometido' : 'penales cometidos'}`;
  return previous.length < BEST_MIN_PREVIOUS ? text : `${text} · tu promedio es ${formatDecimal(sum(previous, 'penaltiesConceded') / previous.length)}`;
}

/**
 * «Lo que dejó el partido»: hasta 3 líneas del partido `matchId` frente al resto de la temporada. Los partidos van en
 * cualquier orden; los anteriores son los de fecha menor. El tipo de infracción no existe en los datos (D7): solo se cuentan
 * penales. Sin líneas y sin aviso, `null` (el panel no se dibuja).
 */
export function matchTakeaways(season: readonly PlayerMatchSummary[], matchId: string, analysisPercent: number): MatchTakeaways | null {
  const ordered = [...season].sort((a, b) => a.date.localeCompare(b.date));
  const index = ordered.findIndex(match => match.matchId === matchId);
  const lines = index === -1
    ? []
    : [bestMark(ordered.slice(0, index), ordered[index]), milestone(ordered.slice(0, index), ordered[index]), penalties(ordered.slice(0, index), ordered[index])]
        .filter((line): line is string => line !== null)
        .slice(0, TAKEAWAY_LINES);
  const provisionalNote = analysisPercent < 100 ? PROVISIONAL_NOTE : null;
  return lines.length === 0 && provisionalNote === null ? null : { lines, provisionalNote };
}
