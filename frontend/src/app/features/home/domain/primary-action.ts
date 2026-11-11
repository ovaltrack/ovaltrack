import { Match } from '../../match/types/match.types';
import { PrimaryAction, STARTERS_TARGET } from '../types/home.types';
import { MATCH_DAY_WINDOW_MS } from './countdown';
import { msUntil, parseWallClock } from './match-time';

/** Una regla devuelve la acción primaria si aplica, o `null` para pasar a la siguiente. */
export type PrimaryRule<Ctx> = (ctx: Ctx) => PrimaryAction | null;

/** Primera regla que aplica; si ninguna lo hace, no hay primario en la pantalla. */
export function resolvePrimaryAction<Ctx>(rules: readonly PrimaryRule<Ctx>[], ctx: Ctx): PrimaryAction | null {
  for (const rule of rules) {
    const action = rule(ctx);
    if (action) return action;
  }
  return null;
}

/** Capturar y continuar captura funcionan sin red; el resto necesita conexión. */
export function isActionEnabled(action: PrimaryAction, online: boolean): boolean {
  return online || !action.requiresConnection;
}

/** El alta de nómina se ofrece hasta 72 h antes del partido. */
export const LINEUP_WINDOW_MS = 72 * 3_600_000;
/** Un partido sin iniciar sigue siendo "el próximo" hasta 12 h después de su hora (demoras, lluvia). */
export const UPCOMING_GRACE_MS = 12 * 3_600_000;

export type RuleMatch = Pick<Match, 'id' | 'status' | 'date'>;

const isLive = (match: RuleMatch) => match.status === 'in_progress' || match.status === 'halftime';

function startOf(match: RuleMatch): Date | null {
  return parseWallClock(match.date);
}

/** Próximos partidos sin iniciar (con o sin nómina), el más cercano primero. */
export function upcomingMatches<T extends RuleMatch>(matches: readonly T[], now: Date): T[] {
  return matches
    .map(match => ({ match, start: startOf(match) }))
    .filter((entry): entry is { match: T; start: Date } =>
      entry.start !== null
      && (entry.match.status === 'not_started' || entry.match.status === 'empty_roster')
      && msUntil(entry.start, now) > -UPCOMING_GRACE_MS)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(entry => entry.match);
}

/** Titulares cargados en la nómina de un partido; `null`/ausente = no se conoce (sin red o sin respuesta). */
export type KnownRoster = { starters: number } | null | undefined;

/**
 * Falta definir la alineación si el partido está en `empty_roster` o si la nómina conocida no llega a 15 titulares.
 * El estado solo no alcanza: un partido puede seguir en `not_started` sin jugadores cargados.
 */
export function lineupIncomplete(match: RuleMatch, roster: KnownRoster): boolean {
  return match.status === 'empty_roster' || (roster != null && roster.starters < STARTERS_TARGET);
}

const defineLineup = (matchId: string): PrimaryAction => ({
  kind: 'define-lineup', label: 'Definir alineación', route: `/selection-roster/${matchId}`, target: 'board', requiresConnection: true
});

export interface CoachRuleContext {
  now: Date;
  /** Partidos de la división activa. */
  matches: readonly RuleMatch[];
  /** Nómina del próximo partido sin iniciar de la división (el primero de `upcomingMatches`). */
  nextRoster?: KnownRoster;
  /** Partido que captura este dispositivo (`LiveMatchSource`), si hay uno. */
  captureMatchId: string | null;
  /** Último partido FINISHED con su % de análisis. */
  lastFinished: { id: string; analysisPercent: number } | null;
}

/** Hay un partido en curso que se está capturando en otro dispositivo: desde acá nunca se ofrece capturar. */
function liveElsewhere(ctx: CoachRuleContext): boolean {
  return ctx.matches.some(match => isLive(match) && match.id !== ctx.captureMatchId);
}

/** Reglas del entrenador, en orden de prioridad. */
export const coachRules: readonly PrimaryRule<CoachRuleContext>[] = [
  // 1. Partido en curso que captura este dispositivo.
  ctx => {
    const here = ctx.matches.find(match => isLive(match) && match.id === ctx.captureMatchId);
    if (!here) return null;
    return here.status === 'halftime'
      ? { kind: 'go-halftime', label: 'Ir al entretiempo', route: `/live-capture/${here.id}/halftime`, target: 'board', requiresConnection: false }
      : { kind: 'continue-capture', label: 'Continuar captura', route: `/live-capture/${here.id}`, target: 'board', requiresConnection: false };
  },
  // 2. Próximo partido con la alineación completa a menos de 24 h: se ofrece capturar.
  ctx => {
    if (liveElsewhere(ctx)) return null;
    const next = upcomingMatches(ctx.matches, ctx.now)[0];
    const start = next && startOf(next);
    if (!next || !start || msUntil(start, ctx.now) >= MATCH_DAY_WINDOW_MS || lineupIncomplete(next, ctx.nextRoster)) return null;
    return { kind: 'capture-live', label: 'Capturar en vivo', route: `/live-capture/${next.id}`, target: 'board', requiresConnection: false };
  },
  // 3. Próximo partido con la alineación incompleta a 72 h o menos.
  ctx => {
    if (liveElsewhere(ctx)) return null;
    const next = upcomingMatches(ctx.matches, ctx.now)[0];
    const start = next && startOf(next);
    return next && start && lineupIncomplete(next, ctx.nextRoster) && msUntil(start, ctx.now) <= LINEUP_WINDOW_MS ? defineLineup(next.id) : null;
  },
  // 4. El último partido jugado todavía tiene jugadas sin jugador.
  ctx => ctx.lastFinished && ctx.lastFinished.analysisPercent < 100
    ? { kind: 'complete-analysis', label: 'Completar análisis', route: `/post-match/${ctx.lastFinished.id}`, target: 'debt-tile', requiresConnection: true }
    : null,
  // 5. Nada programado ni en curso.
  ctx => ctx.matches.some(isLive) || upcomingMatches(ctx.matches, ctx.now).length > 0
    ? null
    : { kind: 'schedule-match', label: 'Programar partido', route: '/match-selection', target: 'board', requiresConnection: true }
];

export interface AdminRuleContext {
  now: Date;
  divisions: readonly { id: string; hasCoach: boolean }[];
  /** Partidos de todo el club, con la división a la que pertenecen. */
  matches: readonly (RuleMatch & { divisionId: string })[];
  /** Titulares por partido; solo están los partidos cuya nómina se pudo leer. */
  rosters?: Readonly<Record<string, { starters: number }>>;
}

/** Reglas del administrador del club, en orden de prioridad. */
export const adminRules: readonly PrimaryRule<AdminRuleContext>[] = [
  // 1. Partido con la alineación incompleta a 72 h o menos en cualquier división: gana el que juega primero.
  ctx => {
    const next = upcomingMatches(ctx.matches, ctx.now).find(match => {
      const start = startOf(match);
      return start !== null && lineupIncomplete(match, ctx.rosters?.[match.id]) && msUntil(start, ctx.now) <= LINEUP_WINDOW_MS;
    });
    return next ? defineLineup(next.id) : null;
  },
  // 2. Divisiones sin entrenador.
  ctx => {
    const orphan = ctx.divisions.find(division => !division.hasCoach);
    return orphan
      ? { kind: 'assign-coach', label: 'Asignar entrenador', route: `/divisions/${orphan.id}/coaches`, target: 'inbox-tile', requiresConnection: true }
      : null;
  },
  // 3. Onboarding: club sin divisiones, o con divisiones pero sin partidos.
  ctx => {
    if (ctx.divisions.length === 0) {
      return { kind: 'create-division', label: 'Crear división', route: '/divisions/new', target: 'board', requiresConnection: true };
    }
    return ctx.matches.length === 0
      ? { kind: 'schedule-match', label: 'Programar partido', route: '/match-selection', target: 'board', requiresConnection: true }
      : null;
  }
];

export interface PlayerRuleContext {
  /** Último partido jugado por el usuario; `null` si todavía no jugó ninguno. */
  lastMatchId: string | null;
}

/** Reglas del jugador: lo único que ofrece el Inicio es ver su último partido. */
export const playerRules: readonly PrimaryRule<PlayerRuleContext>[] = [
  ctx => ctx.lastMatchId
    ? { kind: 'view-my-match', label: 'Ver mi partido', route: `/player-statistics/${ctx.lastMatchId}`, target: 'board', requiresConnection: true }
    : null
];
