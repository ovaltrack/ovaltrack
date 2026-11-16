import { DivisionMatchStatistic } from '../../division-statistics/types/division-statistics.types';
import { FocusInput } from './focus-rows';

/** Porcentaje de ganadas sobre ganadas + perdidas con 1 decimal; `null` si no hubo ninguna resuelta. */
const winRate = (won: number, lost: number): number | null =>
  won + lost > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : null;

const present = (value: number | null): value is number => value !== null;

/**
 * Series de «Qué trabajar» a partir de las estadísticas de la división: un valor por partido, del más viejo al más
 * reciente. Un partido sin dato de una métrica (sin line-outs resueltos, sin tackles) no entra en su serie: no vale 0.
 * `lineoutLast` sale del último partido que sí tuvo line-outs, para la nota «7 de 12 ganados».
 */
export function focusInputOf(matches: readonly DivisionMatchStatistic[]): FocusInput {
  const ordered = [...matches].sort((a, b) => a.date.localeCompare(b.date));
  const lineouts = ordered.map(match => ({ rate: winRate(match.statistics.ownLineoutsWon, match.statistics.ownLineoutsLost), stats: match.statistics }));
  const lastLineouts = lineouts.filter(entry => present(entry.rate)).at(-1)?.stats;
  const latest = ordered.at(-1)?.statistics;
  return {
    series: {
      lineout: lineouts.map(entry => entry.rate).filter(present),
      tackle: ordered
        .filter(match => match.statistics.ownTacklesCompleted + match.statistics.ownTacklesMissed > 0)
        .map(match => match.statistics.ownTackleEffectiveness),
      penalties: ordered.map(match => match.statistics.ownPenaltiesConceded)
    },
    lineoutLast: lastLineouts && lastLineouts === latest
      ? { won: lastLineouts.ownLineoutsWon, total: lastLineouts.ownLineoutsWon + lastLineouts.ownLineoutsLost }
      : null
  };
}
