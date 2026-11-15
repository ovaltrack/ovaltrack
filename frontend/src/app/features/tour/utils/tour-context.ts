import { Match } from '../../match/types/match.types';
import { TourContext } from '../types/tour.types';

const UPCOMING = new Set<Match['status']>(['not_started', 'empty_roster']);
const LIVE = new Set<Match['status']>(['in_progress', 'halftime']);

const time = (match: Match): number => {
  const value = Date.parse(match.date);
  return Number.isFinite(value) ? value : 0;
};

/**
 * Elige los partidos que muestra la guía: el próximo sin empezar más cercano (con nómina antes que sin ella),
 * el en curso más reciente y el último finalizado. La división es la pedida o, si no hay, la del partido finalizado.
 */
export function pickTourContext(matches: readonly Match[], divisionId: string | null, now: number): TourContext {
  const upcoming = matches
    .filter(match => UPCOMING.has(match.status))
    .sort((a, b) =>
      Number(a.status === 'empty_roster') - Number(b.status === 'empty_roster')
      || Math.abs(time(a) - now) - Math.abs(time(b) - now))[0] ?? null;
  const live = matches
    .filter(match => LIVE.has(match.status))
    .sort((a, b) => time(b) - time(a))[0] ?? null;
  const finished = matches
    .filter(match => match.status === 'finished')
    .sort((a, b) => time(b) - time(a))[0] ?? null;

  return {
    divisionId: divisionId ?? finished?.divisionId ?? upcoming?.divisionId ?? null,
    upcomingMatchId: upcoming?.id ?? null,
    liveMatchId: live?.id ?? null,
    finishedMatchId: finished?.id ?? null
  };
}
