import { shortTeamName } from '../../match/post-match/utils/zone-grid';
import { Match } from '../../match/types/match.types';
import { ClubUrgent, PrimaryAction } from '../types/home.types';
import { parseWallClock, relativeMatchLabel } from './match-time';
import { RosterCount, rosterGaps } from './roster-gaps';

export interface ClubUrgentContext {
  now: Date;
  divisions: readonly { id: string; name: string }[];
  matches: readonly Match[];
  rosters: Readonly<Record<string, RosterCount>>;
}

const lastSegment = (route: string): string => route.split('/').filter(Boolean).pop() ?? '';

/**
 * «Lo más urgente»: la explicación de la acción primaria que eligió `adminRules`. Solo hay explicación para lo que la
 * agenda puede mostrar (alineación incompleta y división sin entrenador); sin acción, `null` («Está todo listo»).
 */
export function urgentOf(action: PrimaryAction | null, ctx: ClubUrgentContext): ClubUrgent | null {
  if (action?.kind === 'define-lineup') {
    const match = ctx.matches.find(candidate => candidate.id === lastSegment(action.route));
    const start = match && parseWallClock(match.date);
    const division = ctx.divisions.find(candidate => candidate.id === match?.divisionId);
    if (!match || !start || !division) return null;
    const gaps = rosterGaps(ctx.rosters[match.id] ?? null, match.status);
    const missing = gaps.kind === 'complete' || gaps.kind === 'unknown' ? 'Nómina sin leer' : gaps.label;
    return {
      title: `Falta la alineación de ${division.name}`,
      detail: `vs ${shortTeamName(match.opponent.alias || match.opponent.name)} · ${relativeMatchLabel(start, ctx.now)} · ${missing}`
    };
  }
  if (action?.kind === 'assign-coach') {
    const division = ctx.divisions.find(candidate => candidate.id === action.route.split('/')[2]);
    return division ? { title: `${division.name} no tiene entrenador`, detail: 'Nadie puede capturar sus partidos.' } : null;
  }
  return null;
}
