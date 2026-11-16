import { PrimaryAction, STARTERS_TARGET } from '../types/home.types';
import { MATCH_DAY_WINDOW_MS } from './countdown';
import { RuleMatch, divisionMatchState, upcomingMatches } from './division-match-state';
import { msUntil, parseWallClock } from './match-time';
import { RosterCount, needsCallUp, rosterGaps } from './roster-gaps';

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

function startOf(match: RuleMatch): Date | null {
  return parseWallClock(match.date);
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
  nextRoster?: RosterCount | null;
  /** Partido que captura este dispositivo (`LiveMatchSource`), si hay uno. */
  captureMatchId: string | null;
  /** Último partido FINISHED con su % de análisis. */
  lastFinished: { id: string; analysisPercent: number; minutesWithoutZone?: number | null } | null;
}

const stateOf = (ctx: CoachRuleContext) => divisionMatchState(ctx.matches, ctx.captureMatchId, ctx.now);

/** Reglas del entrenador, en orden de prioridad. */
export const coachRules: readonly PrimaryRule<CoachRuleContext>[] = [
  // 1. Partido en curso que captura este dispositivo.
  ctx => {
    const { live: here, liveHere } = stateOf(ctx);
    if (!here || !liveHere) return null;
    return here.status === 'halftime'
      ? { kind: 'go-halftime', label: 'Ir al entretiempo', route: `/live-capture/${here.id}/halftime`, target: 'board', requiresConnection: false }
      : { kind: 'continue-capture', label: 'Continuar captura', route: `/live-capture/${here.id}`, target: 'board', requiresConnection: false };
  },
  // 2. Próximo partido con la alineación completa a menos de 24 h: se ofrece capturar.
  ctx => {
    const { live, next } = stateOf(ctx);
    if (live) return null;
    const start = next && startOf(next);
    if (!next || !start || msUntil(start, ctx.now) >= MATCH_DAY_WINDOW_MS || lineupIncomplete(next, ctx.nextRoster)) return null;
    return { kind: 'capture-live', label: 'Capturar en vivo', route: `/live-capture/${next.id}`, target: 'board', requiresConnection: false };
  },
  // 3. Próximo partido a 72 h o menos sin nómina o con menos de 8 suplentes (la etapa Convocar de la semana de juego).
  ctx => {
    const { live, next } = stateOf(ctx);
    if (live) return null;
    const start = next && startOf(next);
    return next && start && needsCallUp(rosterGaps(ctx.nextRoster ?? null, next.status)) && msUntil(start, ctx.now) <= LINEUP_WINDOW_MS ? defineLineup(next.id) : null;
  },
  // 4. El último partido jugado tiene jugadas sin jugador (se abre Eventos con «Solo sin jugador») o minutos sin zona (se abre Zonas).
  ctx => {
    const last = ctx.lastFinished;
    if (!last) return null;
    if (last.analysisPercent < 100) {
      return { kind: 'complete-analysis', label: 'Completar análisis', route: `/post-match/${last.id}`, queryParams: { pendientes: 1 }, target: 'board', requiresConnection: true };
    }
    return (last.minutesWithoutZone ?? 0) > 0
      ? { kind: 'complete-analysis', label: 'Completar zonas', route: `/post-match/${last.id}/zones`, target: 'board', requiresConnection: true }
      : null;
  },
  // 5. Nada programado ni en curso.
  ctx => {
    const { live, next } = stateOf(ctx);
    return live || next
      ? null
      : { kind: 'schedule-match', label: 'Programar partido', route: '/match-selection', target: 'board', requiresConnection: true };
  }
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
      ? { kind: 'assign-coach', label: 'Asignar entrenador', route: `/divisions/${orphan.id}/coaches`, target: 'board', requiresConnection: true }
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
