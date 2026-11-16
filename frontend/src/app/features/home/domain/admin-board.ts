import { BoardModel } from '../types/home.types';
import { ClubAgendaContext, buildClubAgenda } from './club-agenda';

export type AdminBoardContext = ClubAgendaContext;

/** Tablero del administrador: primeros pasos sin divisiones o sin partidos; si no, la agenda del club (`buildClubAgenda`). */
export function buildAdminBoard(ctx: AdminBoardContext): BoardModel {
  if (ctx.divisions.length === 0) return { kind: 'onboarding', step: 'create-division' };
  if (ctx.matches.every(match => match.status === 'cancelled')) return { kind: 'onboarding', step: 'schedule-match' };
  return buildClubAgenda(ctx);
}
