import { Match } from '../../match/types/match.types';
import { BoardModel } from '../types/home.types';
import { RosterCount, rosterGaps } from './roster-gaps';

export type PendingKind = 'analysis' | 'roster' | 'substitutes' | 'jerseys';

export interface PendingRow {
  kind: PendingKind;
  text: string;
  detail: string;
  route: string;
  queryParams?: Record<string, string | number>;
  actionLabel: string;
}

export interface PendingAnalysis {
  matchId: string;
  /** Rival corto del último partido jugado. */
  opponent: string;
  dateLabel: string;
  /** 0–100. */
  percent: number;
  withoutPlayer: number;
  /** `null` si no se pudieron leer los tramos de zona. */
  minutesWithoutZone: number | null;
}

export interface PendingNext {
  id: string;
  status: Match['status'];
  /** Rival corto. */
  opponent: string;
  /** «Sáb 21 nov · 15:30». */
  whenLabel: string;
}

export interface PendingContext {
  board: BoardModel;
  divisionId: string;
  divisionName: string;
  analysis: PendingAnalysis | null;
  next: PendingNext | null;
  /** Nómina leída del próximo partido; `null` si no existe o no se pudo leer. */
  roster: RosterCount | null;
  withoutJersey: number;
}

/** El análisis ya lo pide el tablero cuando muestra la variante `analysis`. */
export const analysisOnBoard = (board: BoardModel): boolean => board.kind === 'analysis';

/** La nómina ya la pide el tablero cuando está en la etapa Convocar («Armá la nómina…» con «Definir alineación»). */
export const rosterOnBoard = (board: BoardModel): boolean => board.kind === 'next' && board.callUp !== null;

const pendingAnalysis = (analysis: PendingAnalysis): boolean => analysis.percent < 100 || (analysis.minutesWithoutZone ?? 0) > 0;

function analysisRow(analysis: PendingAnalysis): PendingRow {
  const complete = analysis.percent >= 100;
  const gaps = [
    analysis.withoutPlayer > 0 ? `${analysis.withoutPlayer} ${analysis.withoutPlayer === 1 ? 'jugada sin jugador' : 'jugadas sin jugador'}` : null,
    (analysis.minutesWithoutZone ?? 0) > 0 ? `${analysis.minutesWithoutZone}′ sin zona` : null
  ].filter(Boolean);
  return {
    kind: 'analysis',
    text: complete ? 'Zonas sin asignar' : `Análisis al ${analysis.percent} %`,
    detail: [`vs ${analysis.opponent} · ${analysis.dateLabel}`, ...gaps].join(' · '),
    route: complete ? `/post-match/${analysis.matchId}/zones` : `/post-match/${analysis.matchId}`,
    queryParams: complete ? undefined : { pendientes: 1 },
    actionLabel: complete ? 'Completar zonas' : 'Completar análisis'
  };
}

/**
 * «Pendientes del plantel», en este orden: análisis pendiente, nómina, suplentes faltantes y jugadores sin dorsal.
 * El análisis y la nómina no se repiten si el tablero ya los pide (`analysisOnBoard`, `rosterOnBoard`).
 */
export function pendingRows(context: PendingContext): PendingRow[] {
  const { board, analysis, next, roster, withoutJersey } = context;
  const rows: PendingRow[] = [];

  if (analysis && pendingAnalysis(analysis) && !analysisOnBoard(board)) rows.push(analysisRow(analysis));

  const gaps = next ? rosterGaps(roster, next.status) : null;
  const detail = next ? `vs ${next.opponent} · ${next.whenLabel}` : '';
  const route = next ? `/selection-roster/${next.id}` : '';
  if (gaps?.kind === 'none' && !rosterOnBoard(board)) {
    rows.push({ kind: 'roster', text: 'Nómina sin armar', detail, route, actionLabel: 'Armar nómina' });
  }
  if (gaps?.kind === 'starters' && !rosterOnBoard(board)) {
    rows.push({ kind: 'roster', text: `Faltan ${gaps.missing}`, detail, route, actionLabel: 'Completar' });
  }
  if (gaps?.kind === 'substitutes') {
    rows.push({ kind: 'substitutes', text: `Faltan ${gaps.missing}`, detail, route, actionLabel: 'Completar' });
  }

  if (withoutJersey > 0) {
    rows.push({
      kind: 'jerseys',
      text: `${withoutJersey} ${withoutJersey === 1 ? 'jugador sin dorsal' : 'jugadores sin dorsal'}`,
      detail: `Plantel ${context.divisionName}`,
      route: `/divisions/${context.divisionId}/players`,
      actionLabel: 'Asignar'
    });
  }
  return rows;
}
