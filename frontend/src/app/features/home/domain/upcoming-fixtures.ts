import { Match } from '../../match/types/match.types';
import { shortTeamName } from '../../match/post-match/utils/zone-grid';
import { upcomingMatches } from './division-match-state';
import { clockLabel, monthLabel, parseWallClock, weekdayName } from './match-time';
import { RosterCount, rosterGaps } from './roster-gaps';

export const UPCOMING_FIXTURES = 3;

export interface UpcomingFixture {
  matchId: string;
  /** Día del mes: «21». */
  day: number;
  /** «nov». */
  month: string;
  /** Rival corto. */
  opponent: string;
  /** «Sábado · 15:30». */
  when: string;
  /** Estado de la nómina; solo el primer partido lo trae y solo si está incompleta. */
  rosterChip: string | null;
  ariaLabel: string;
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * «Próximas fechas»: hasta 3 partidos por jugar de la división, el más cercano primero. `roster` es la nómina del primero
 * (la única que se lee); si está incompleta, el primero lleva el chip con lo que falta.
 */
export function upcomingFixtures(matches: readonly Match[], now: Date, roster: RosterCount | null): UpcomingFixture[] {
  return upcomingMatches(matches, now).slice(0, UPCOMING_FIXTURES).flatMap((match, index): UpcomingFixture[] => {
    const start = parseWallClock(match.date);
    if (!start) return [];
    const gaps = index === 0 ? rosterGaps(roster, match.status) : null;
    const rosterChip = gaps && gaps.kind !== 'complete' && gaps.kind !== 'unknown' ? gaps.label : null;
    const opponent = shortTeamName(match.opponent.alias || match.opponent.name);
    const when = `${capitalize(weekdayName(start))} · ${clockLabel(start)}`;
    return [{
      matchId: match.id,
      day: start.getDate(),
      month: monthLabel(start),
      opponent,
      when,
      rosterChip,
      ariaLabel: `${start.getDate()} de ${monthLabel(start)}, ${opponent}, ${when}${rosterChip ? `, nómina: ${rosterChip}` : ''}`
    }];
  });
}
