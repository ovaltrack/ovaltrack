import { Match } from '../../match/types/match.types';
import { BoardModel, ClubDayItemStatus, ClubDayTimelineItem, STARTERS_TARGET, SUBSTITUTES_TARGET } from '../types/home.types';
import { toClubDayItem } from './club-day-lanes';
import { dayLabel, parseWallClock } from './match-time';
import { upcomingMatches } from './division-match-state';

export interface AdminBoardContext {
  now: Date;
  divisions: readonly { id: string; name: string; hasCoach: boolean }[];
  /** Partidos de todo el club. */
  matches: readonly Match[];
  /** Nómina de los partidos del día; sin dato = sin nómina. */
  rosters: Readonly<Record<string, { starters: number; substitutes: number }>>;
}

const DAY_MS = 86_400_000;

const isLive = (match: Match) => match.status === 'in_progress' || match.status === 'halftime';

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Estado y texto de un partido en el timeline: alerta si falta entrenador, nómina o suplentes. */
export function clubDayItemState(match: Match, hasCoach: boolean, roster: { starters: number; substitutes: number } | undefined): { status: ClubDayItemStatus; detail: string } {
  if (match.status === 'finished') return { status: 'final', detail: `${match.homeScore}-${match.awayScore}` };
  if (isLive(match)) return { status: 'live', detail: match.status === 'halftime' ? 'Entretiempo' : 'En curso' };
  if (!hasCoach) return { status: 'alert', detail: 'Sin entrenador asignado' };
  if (match.status === 'empty_roster' || !roster || roster.starters === 0) return { status: 'alert', detail: 'Sin nómina' };
  if (roster.starters < STARTERS_TARGET) return { status: 'alert', detail: `Titulares ${roster.starters}/${STARTERS_TARGET}` };
  if (roster.substitutes < SUBSTITUTES_TARGET) return { status: 'alert', detail: `Suplentes ${roster.substitutes}/${SUBSTITUTES_TARGET}` };
  return { status: 'ok', detail: 'Nómina lista' };
}

/** Tablero del administrador: partidos de hoy o de mañana; si no hay, la próxima fecha; sin nada, primeros pasos. */
export function buildAdminBoard(ctx: AdminBoardContext): BoardModel {
  if (ctx.divisions.length === 0) return { kind: 'onboarding', step: 'create-division' };

  const dated = ctx.matches
    .filter(match => match.status !== 'cancelled')
    .flatMap(match => {
      const start = parseWallClock(match.date);
      return start ? [{ match, start }] : [];
    });
  const tomorrow = new Date(ctx.now.getTime() + DAY_MS);

  for (const [day, reference] of [['today', ctx.now], ['tomorrow', tomorrow]] as const) {
    const ofDay = dated.filter(entry => sameDay(entry.start, reference)).sort((a, b) => a.start.getTime() - b.start.getTime());
    if (ofDay.length === 0) continue;
    const items: ClubDayTimelineItem[] = ofDay.map(({ match, start }) => {
      const division = ctx.divisions.find(candidate => candidate.id === match.divisionId);
      const { status, detail } = clubDayItemState(match, division?.hasCoach ?? true, ctx.rosters[match.id]);
      return {
        ...toClubDayItem(match.id, start),
        timeLabel: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
        title: division?.name ?? 'División',
        detail,
        status
      };
    });
    return {
      kind: 'club-day',
      title: day === 'today' ? 'Hoy en el club' : 'Mañana en el club',
      label: `${day === 'today' ? 'Hoy' : 'Mañana'} · ${dayLabel(reference)} · ${items.length} ${items.length === 1 ? 'partido' : 'partidos'}`,
      items,
      nowMinute: day === 'today' ? ctx.now.getHours() * 60 + ctx.now.getMinutes() : null
    };
  }

  const next = upcomingMatches(dated.map(entry => entry.match), ctx.now)[0];
  const nextStart = next && parseWallClock(next.date);
  if (!next || !nextStart) {
    return dated.length === 0 ? { kind: 'onboarding', step: 'schedule-match' } : { kind: 'club-idle', nextLabel: null };
  }
  const sameDate = dated.filter(entry => sameDay(entry.start, nextStart) && entry.match.status !== 'finished').length;
  return { kind: 'club-idle', nextLabel: `${dayLabel(nextStart)} · ${sameDate} ${sameDate === 1 ? 'partido' : 'partidos'}` };
}
