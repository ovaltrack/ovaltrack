import { PlayerMatchSummary, PlayerMetrics } from '../../player-statistics/types/player-stats-api.types';
import { resultOf } from './form-record';

export interface SeasonKpi {
  key: 'points' | 'tries' | 'matches' | 'tackles' | 'record';
  label: string;
  /** Mono grande; «—» si no hay dato. */
  value: string;
  sub: string;
  /** Los puntos van en el color propio, sin fondo relleno. */
  own: boolean;
}

export const NO_DATA = '—';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function tackleKpi(totals: PlayerMetrics): SeasonKpi {
  const attempts = totals.tacklesMade + totals.tacklesMissed;
  return attempts === 0
    ? { key: 'tackles', label: 'Tackles', value: NO_DATA, sub: 'sin datos', own: false }
    : { key: 'tackles', label: 'Tackles', value: String(totals.tacklesMade), sub: `${Math.round((totals.tacklesMade / attempts) * 100)} % de efectividad`, own: false };
}

/**
 * «Mi temporada»: 5 KPIs a partir de los totales y los partidos del año que da el backend. El récord cuenta los partidos
 * que jugó (el club siempre es local: `homeScore` es el marcador propio). Sin partidos no hay franja (`null`).
 */
export function seasonKpis(totals: PlayerMetrics, matches: readonly PlayerMatchSummary[]): SeasonKpi[] | null {
  if (matches.length === 0) return null;
  const starts = matches.filter(match => match.role === 'TITULAR').length;
  const results = matches.map(match => resultOf(match.homeScore, match.awayScore));
  const wins = results.filter(result => result === 'win').length;
  const draws = results.filter(result => result === 'draw').length;
  return [
    { key: 'points', label: 'Puntos', value: String(totals.points), sub: 'en la temporada', own: true },
    { key: 'tries', label: 'Tries', value: String(totals.tries), sub: 'en la temporada', own: false },
    { key: 'matches', label: 'Partidos', value: String(matches.length), sub: `${plural(starts, 'titular', 'titulares')} · ${plural(matches.length - starts, 'suplente', 'suplentes')}`, own: false },
    tackleKpi(totals),
    { key: 'record', label: 'Récord jugando', value: `${wins}–${draws}–${matches.length - wins - draws}`, sub: 'G · E · P', own: false }
  ];
}
