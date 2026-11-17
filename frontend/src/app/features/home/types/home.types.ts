import { GameWeekStage, GameWeekStep } from '../domain/game-week';
import { MatchTakeaways } from '../domain/match-takeaways';
import { RosterGaps } from '../domain/roster-gaps';

/** Estado de un widget: cada tarjeta carga, falla y se reintenta sin afectar a las demás. */
export type WidgetState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T; fetchedAt: number; stale: boolean; /** Hay un dato viejo a la vista y la respuesta real todavía viene en camino. */ refreshing?: boolean }
  | { status: 'empty' }
  | { status: 'error'; message: string };

/** El dato de un widget listo; `null` en cualquier otro estado. */
export function dataOf<T>(state: WidgetState<T>): T | null {
  return state.status === 'ready' ? state.data : null;
}

/** Hay un dato viejo a la vista mientras llega la respuesta real. */
export function isRefreshing<T>(state: WidgetState<T>): boolean {
  return state.status === 'ready' && state.refreshing === true;
}

export type PrimaryActionKind =
  | 'continue-capture'
  | 'go-halftime'
  | 'capture-live'
  | 'define-lineup'
  | 'complete-analysis'
  | 'schedule-match'
  | 'assign-coach'
  | 'create-division'
  | 'view-my-match';

/** Dónde se dibuja el único botón primario de la pantalla. */
export type PrimaryActionTarget = 'board';

export interface PrimaryAction {
  kind: PrimaryActionKind;
  label: string;
  route: string;
  /** Parámetros de la URL de destino, p. ej. `pendientes=1` para abrir Eventos con «Solo sin jugador». */
  queryParams?: Record<string, string | number>;
  target: PrimaryActionTarget;
  /** Sin conexión queda deshabilitada con "Requiere conexión"; capturar nunca la necesita. */
  requiresConnection: boolean;
}

export type AgendaChipTone = 'ok' | 'warn' | 'live' | 'neutral';

/** Estado de un partido en la agenda del club; siempre con texto, el color solo acompaña. */
export interface AgendaChip {
  label: string;
  tone: AgendaChipTone;
}

export interface ClubAgendaRow {
  matchId: string;
  /** «Sáb 21». */
  dayLabel: string;
  /** «15:30». */
  timeLabel: string;
  division: string;
  /** Rival corto. */
  opponent: string;
  chip: AgendaChip;
}

export interface ClubAgendaSection {
  key: 'now' | 'today' | 'tomorrow' | 'week';
  /** Separador sobre las filas («Ahora», «Hoy», «Mañana»); `null` si no lleva. */
  label: string | null;
  rows: ClubAgendaRow[];
}

/** «Lo más urgente» del administrador: qué falta y dónde; el botón es la acción primaria de la pantalla. */
export interface ClubUrgent {
  title: string;
  detail: string;
}

/** El partido en curso del club, para el panel «<división> · en vivo». */
export interface ClubAgendaLive {
  division: string;
  opponent: string;
  ownScore: number;
  opponentScore: number;
  /** «2T 52'»: el último dato sincronizado, sin extrapolar (D6). */
  periodLabel: string;
  /** Hora de Argentina del último dato; `null` si no se conoce. */
  lastDataAt: string | null;
}

export interface LiveEventLine {
  label: string;
  /** Minuto de juego, "38'". */
  minute: string;
}

/** La semana de juego que se dibuja sobre el tablero del entrenador. */
export interface BoardWeek {
  stage: GameWeekStage;
  /** "Semana de juego · Superior · paso 3 de 4". */
  label: string;
  steps: GameWeekStep[];
}

/** Textos de la etapa Convocar del próximo partido: «Armá la nómina del sábado». */
export interface CallUpModel {
  title: string;
  /** "vs CRC · Sáb 21 nov · 15:30". */
  subtitle: string;
  dayLabel: string;
  /** "En 2 días · vs CRC". */
  inLabel: string;
}

/** Contenido del tablero verde; `kind` decide la variante que dibuja `home-board`. */
export type BoardModel =
  | { kind: 'next'; matchId: string; divisionName: string; opponent: string; city: string | null; dateLabel: string; time: string; starters: number; substitutes: number; rosterGaps: RosterGaps; readyOffline: boolean; squadSize: number | null; callUp: CallUpModel | null; week: BoardWeek | null }
  | { kind: 'analysis'; matchId: string; divisionName: string; title: string; subtitle: string; percent: number; withoutPlayer: number; minutesWithoutZone: number | null; after: { title: string; detail: string } | null; week: BoardWeek | null }
  | { kind: 'match-day'; matchId: string; divisionName: string; opponent: string; startsAt: Date; starters: number; substitutes: number; week: BoardWeek | null }
  | { kind: 'live-here'; matchId: string; opponent: string; periodLabel: string; ownScore: number; opponentScore: number; halftime: boolean; recent: LiveEventLine[]; week: BoardWeek | null }
  | { kind: 'live-elsewhere'; matchId: string; opponent: string; periodLabel: string; ownScore: number; opponentScore: number; lastDataAt: string | null; week: BoardWeek | null }
  | { kind: 'onboarding'; step: 'create-division' | 'schedule-match' | 'await-division' | 'no-matches-player' }
  | { kind: 'club-agenda'; mode: 'week' | 'day'; label: string; title: string; sections: ClubAgendaSection[]; live: ClubAgendaLive | null; urgent: ClubUrgent | null }
  | { kind: 'club-idle'; nextLabel: string | null }
  | { kind: 'team-idle'; divisionName: string; last: { opponent: string; dateLabel: string; ownScore: number; opponentScore: number; result: 'win' | 'loss' | 'draw' } }
  | { kind: 'player-last'; matchId: string; dateLabel: string; opponent: string; ownScore: number; opponentScore: number; result: 'win' | 'loss' | 'draw'; role: 'TITULAR' | 'SUPLENTE'; tries: number | null; tackles: number | null; tacklePercent: number | null; analysisPercent: number; slotNumber: number | null; takeaways: MatchTakeaways | null };

export const STARTERS_TARGET = 15;
export const SUBSTITUTES_TARGET = 8;
