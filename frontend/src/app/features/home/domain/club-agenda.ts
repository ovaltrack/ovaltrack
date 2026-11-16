import { shortTeamName } from '../../match/post-match/utils/zone-grid';
import { Match } from '../../match/types/match.types';
import { AgendaChip, BoardModel, ClubAgendaLive, ClubAgendaRow, ClubAgendaSection, ClubUrgent } from '../types/home.types';
import { remotePeriodText } from './coach-board';
import { isLiveMatch, upcomingMatches } from './division-match-state';
import { clockLabel, dayLabel, formatUtcAsArgentina, parseWallClock, weekdayDayLabel } from './match-time';
import { RosterCount, rosterGaps } from './roster-gaps';

export interface ClubAgendaContext {
  now: Date;
  divisions: readonly { id: string; name: string; hasCoach: boolean }[];
  /** Partidos de todo el club. */
  matches: readonly Match[];
  /** Nómina de los partidos pendientes de la ventana; los que no se pudieron leer no están. */
  rosters: Readonly<Record<string, RosterCount>>;
  /** Lo más urgente según las reglas del administrador; `null` si no hay nada. */
  urgent?: ClubUrgent | null;
}

type ClubAgendaBoard = Extract<BoardModel, { kind: 'club-agenda' | 'club-idle' }>;

const SATURDAY = 6;
const SUNDAY = 0;

const startOfDay = (date: Date, plusDays = 0): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + plusDays);

/** La ventana de la agenda llega hasta el domingo próximo inclusive (D8); hoy domingo, hasta hoy. Devuelve el límite exclusivo. */
export function agendaWindowEnd(now: Date): Date {
  return startOfDay(now, ((7 - now.getDay()) % 7) + 1);
}

/** Partidos sin iniciar cuya nómina hay que leer: los de la ventana de la agenda y los de las próximas 72 h (reglas del CTA). */
export function rosterWindowMatches(matches: readonly Match[], now: Date, lineupWindowMs: number): Match[] {
  const limit = Math.max(agendaWindowEnd(now).getTime(), now.getTime() + lineupWindowMs);
  return matches.filter(match => {
    const start = parseWallClock(match.date);
    return start !== null && (match.status === 'not_started' || match.status === 'empty_roster') && start.getTime() < limit;
  });
}

/**
 * Chip de un partido en la agenda, por prioridad: final con resultado, en curso con período (D6), sin entrenador, y el
 * estado de la nómina. Una nómina que no se pudo leer no se acusa: queda neutra.
 */
export function agendaChip(match: Match, hasCoach: boolean, roster: RosterCount | undefined): AgendaChip {
  if (match.status === 'finished') return { label: `Final ${match.homeScore}–${match.awayScore}`, tone: 'neutral' };
  if (isLiveMatch(match)) return { label: `En curso · ${remotePeriodText(match)}`, tone: 'live' };
  if (!hasCoach) return { label: 'Sin entrenador', tone: 'warn' };
  const gaps = rosterGaps(roster ?? null, match.status);
  switch (gaps.kind) {
    case 'complete': return { label: 'Nómina lista', tone: 'ok' };
    case 'unknown': return { label: 'Nómina sin datos', tone: 'neutral' };
    default: return { label: gaps.label, tone: 'warn' };
  }
}

const joinDays = (days: readonly string[]): string =>
  days.length <= 1 ? days.join('') : `${days.slice(0, -1).join(', ')} y ${days[days.length - 1]}`;

/**
 * Agenda del club (D8). Con un partido en curso o con partidos hoy: «Hoy en el club» con «Ahora», hoy y «Mañana». Si no,
 * los de la ventana hasta el domingo próximo («Fin de semana» si todos caen sábado o domingo). Sin partidos: `club-idle`.
 * Un partido en curso va primero aunque su fecha sea otra.
 */
export function buildClubAgenda(ctx: ClubAgendaContext): ClubAgendaBoard {
  const dated = ctx.matches
    .filter(match => match.status !== 'cancelled')
    .flatMap(match => {
      const start = parseWallClock(match.date);
      return start ? [{ match, start }] : [];
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const today = startOfDay(ctx.now);
  const tomorrow = startOfDay(ctx.now, 1);
  const afterTomorrow = startOfDay(ctx.now, 2);
  const inRange = (start: Date, from: Date, to: Date): boolean => start >= from && start < to;

  const toRow = ({ match, start }: (typeof dated)[number]): ClubAgendaRow => {
    const division = ctx.divisions.find(candidate => candidate.id === match.divisionId);
    return {
      matchId: match.id,
      dayLabel: weekdayDayLabel(start),
      timeLabel: clockLabel(start),
      division: division?.name ?? 'División',
      opponent: shortTeamName(match.opponent.alias || match.opponent.name),
      chip: agendaChip(match, division?.hasCoach ?? true, ctx.rosters[match.id])
    };
  };
  const section = (key: ClubAgendaSection['key'], label: string | null, entries: typeof dated): ClubAgendaSection[] =>
    entries.length === 0 ? [] : [{ key, label, rows: entries.map(toRow) }];

  const live = dated.filter(entry => isLiveMatch(entry.match));
  const ofToday = dated.filter(entry => !isLiveMatch(entry.match) && inRange(entry.start, today, tomorrow));

  if (live.length > 0 || ofToday.length > 0) {
    const ofTomorrow = dated.filter(entry => !isLiveMatch(entry.match) && inRange(entry.start, tomorrow, afterTomorrow));
    const todayCount = live.length + ofToday.length;
    return {
      kind: 'club-agenda',
      mode: 'day',
      label: `Hoy en el club · ${dayLabel(ctx.now)} · ${todayCount} hoy, ${ofTomorrow.length} mañana`,
      title: 'Hoy en el club',
      sections: [
        ...section('now', 'Ahora', live),
        ...section('today', live.length > 0 ? 'Hoy' : null, ofToday),
        ...section('tomorrow', 'Mañana', ofTomorrow)
      ],
      live: live.length > 0 ? liveOf(live[0].match, ctx) : null,
      urgent: ctx.urgent ?? null
    };
  }

  const ofWindow = dated.filter(entry => inRange(entry.start, today, agendaWindowEnd(ctx.now)));
  if (ofWindow.length > 0) {
    const weekend = ofWindow.every(entry => entry.start.getDay() === SATURDAY || entry.start.getDay() === SUNDAY);
    const days = [...new Set(ofWindow.map(entry => weekdayDayLabel(entry.start)))];
    const count = ofWindow.length;
    return {
      kind: 'club-agenda',
      mode: 'week',
      label: `${weekend ? 'Fin de semana' : 'Esta semana'} · ${joinDays(days)}`,
      title: `${count} ${count === 1 ? 'partido' : 'partidos'} ${weekend ? 'este fin de semana' : 'esta semana'}`,
      sections: section('week', null, ofWindow),
      live: null,
      urgent: ctx.urgent ?? null
    };
  }

  const next = upcomingMatches(dated.map(entry => entry.match), ctx.now)[0];
  const nextStart = next && parseWallClock(next.date);
  if (!next || !nextStart) return { kind: 'club-idle', nextLabel: null };
  const sameDate = dated.filter(entry => entry.match.status !== 'finished' && dayLabel(entry.start) === dayLabel(nextStart)).length;
  return { kind: 'club-idle', nextLabel: `${dayLabel(nextStart)} · ${sameDate} ${sameDate === 1 ? 'partido' : 'partidos'}` };
}

function liveOf(match: Match, ctx: ClubAgendaContext): ClubAgendaLive {
  return {
    division: ctx.divisions.find(candidate => candidate.id === match.divisionId)?.name ?? 'División',
    opponent: shortTeamName(match.opponent.alias || match.opponent.name),
    ownScore: match.homeScore,
    opponentScore: match.awayScore,
    periodLabel: remotePeriodText(match),
    lastDataAt: match.clockUpdatedAt ? formatUtcAsArgentina(match.clockUpdatedAt) : null
  };
}
