/** Estado de un widget: cada tarjeta carga, falla y se reintenta sin afectar a las demás. */
export type WidgetState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T; fetchedAt: number; stale: boolean }
  | { status: 'empty' }
  | { status: 'error'; message: string };

/** El dato de un widget listo; `null` en cualquier otro estado. */
export function dataOf<T>(state: WidgetState<T>): T | null {
  return state.status === 'ready' ? state.data : null;
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
export type PrimaryActionTarget = 'board' | 'debt-tile' | 'inbox-tile';

export interface PrimaryAction {
  kind: PrimaryActionKind;
  label: string;
  route: string;
  target: PrimaryActionTarget;
  /** Sin conexión queda deshabilitada con "Requiere conexión"; capturar nunca la necesita. */
  requiresConnection: boolean;
}

/** Un partido del día del club en el timeline del administrador. */
export type ClubDayItemStatus = 'alert' | 'ok' | 'live' | 'final';

export interface ClubDayTimelineItem {
  id: string;
  /** Minutos desde la medianoche. */
  startMinute: number;
  endMinute: number;
  /** "10:00". */
  timeLabel: string;
  /** División a la que pertenece. */
  title: string;
  /** "Sin nómina", "Suplentes 7/8", "Nómina lista"... */
  detail: string;
  status: ClubDayItemStatus;
}

export interface LiveEventLine {
  label: string;
  /** Minuto de juego, "38'". */
  minute: string;
}

/** Contenido del tablero verde; `kind` decide la variante que dibuja `home-board`. */
export type BoardModel =
  | { kind: 'next'; matchId: string; divisionName: string; opponent: string; city: string | null; dateLabel: string; time: string; starters: number; substitutes: number; readyOffline: boolean }
  | { kind: 'match-day'; matchId: string; divisionName: string; opponent: string; startsAt: Date; starters: number; substitutes: number }
  | { kind: 'live-here'; matchId: string; opponent: string; periodLabel: string; ownScore: number; opponentScore: number; halftime: boolean; recent: LiveEventLine[] }
  | { kind: 'live-elsewhere'; matchId: string; opponent: string; ownScore: number; opponentScore: number; lastDataAt: string | null }
  | { kind: 'onboarding'; step: 'create-division' | 'schedule-match' | 'await-division' | 'no-matches-player' }
  | { kind: 'club-day'; title: string; label: string; items: ClubDayTimelineItem[]; nowMinute: number | null }
  | { kind: 'club-idle'; nextLabel: string | null }
  | { kind: 'team-idle'; divisionName: string; last: { opponent: string; dateLabel: string; ownScore: number; opponentScore: number; result: 'win' | 'loss' | 'draw' } }
  | { kind: 'player-last'; matchId: string; dateLabel: string; opponent: string; ownScore: number; opponentScore: number; result: 'win' | 'loss' | 'draw'; role: 'TITULAR' | 'SUPLENTE'; tries: number; tackles: number; analysisPercent: number; slotNumber: number | null };

export const STARTERS_TARGET = 15;
export const SUBSTITUTES_TARGET = 8;
