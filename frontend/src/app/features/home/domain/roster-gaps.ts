import { Match } from '../../match/types/match.types';
import { STARTERS_TARGET, SUBSTITUTES_TARGET } from '../types/home.types';

export interface RosterCount {
  starters: number;
  substitutes: number;
}

/**
 * Qué le falta a la nómina de un partido. La nómina se guarda siempre con 15 titulares (el backend rechaza otra cantidad),
 * así que no hay camisetas 1–15 que listar (A3): faltan titulares (nóminas viejas), suplentes o toda la nómina.
 *  - `unknown`: no se pudo leer la nómina de un partido que no está en `empty_roster` (sin red): no se acusa de nada.
 */
export type RosterGaps =
  | { kind: 'complete' }
  | { kind: 'unknown' }
  | { kind: 'none'; label: string; missing: string }
  | { kind: 'starters'; count: number; label: string; missing: string }
  | { kind: 'substitutes'; count: number; label: string; missing: string };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** `roster` es la nómina leída (`null` si no existe o no se pudo leer); el estado del partido desempata esos dos casos. */
export function rosterGaps(roster: RosterCount | null, status: Match['status']): RosterGaps {
  if (status === 'empty_roster' || (roster !== null && roster.starters === 0)) {
    return { kind: 'none', label: 'Sin nómina', missing: `${STARTERS_TARGET} titulares y hasta ${SUBSTITUTES_TARGET} suplentes` };
  }
  if (roster === null) return { kind: 'unknown' };
  if (roster.starters < STARTERS_TARGET) {
    const count = STARTERS_TARGET - roster.starters;
    return { kind: 'starters', count, label: `Titulares ${roster.starters}/${STARTERS_TARGET}`, missing: plural(count, 'titular', 'titulares') };
  }
  if (roster.substitutes < SUBSTITUTES_TARGET) {
    const count = SUBSTITUTES_TARGET - roster.substitutes;
    return { kind: 'substitutes', count, label: `Suplentes ${roster.substitutes}/${SUBSTITUTES_TARGET}`, missing: plural(count, 'suplente', 'suplentes') };
  }
  return { kind: 'complete' };
}

/** Convocar se activa sin nómina o con menos de 8 suplentes (Q1); también con titulares de menos, de una nómina vieja. */
export const needsCallUp = (gaps: RosterGaps): boolean => gaps.kind !== 'complete' && gaps.kind !== 'unknown';
