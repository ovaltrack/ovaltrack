import { shortTeamName } from '../../match/post-match/utils/zone-grid';
import { Match } from '../../match/types/match.types';
import { STARTERS_TARGET } from '../types/home.types';
import { AnalysisTone, analysisTone } from './analysis-coverage';
import { divisionMatchState } from './division-match-state';
import { FormEntry, formRecord } from './form-record';
import { clockLabel, dayLabel, parseWallClock } from './match-time';
import { RosterCount, rosterGaps } from './roster-gaps';

/** Lo que el administrador ve de cada división; `null` = no se pudo leer. */
export interface DivisionStat {
  divisionId: string;
  /** Entrenadores activos. */
  staff: number | null;
  players: number | null;
  /** % de análisis del último partido jugado. */
  analysisPercent: number | null;
  /** Nómina del próximo partido; `null` o ausente (datos guardados antes de la Fase 10) = no se conoce. */
  roster?: RosterCount | null;
}

/** Una celda marcada: ícono + texto; lo que está bien se dibuja sin marca. */
export interface StatusCell {
  text: string;
  /** `error` (rojo) o `warn` (ámbar) si no está bien; `null` si no hay nada que marcar. */
  issue: 'error' | 'warn' | null;
  /** Aclaración bajo el texto («no alcanza para 15»). */
  note?: string;
}

export interface DivisionStatusAction {
  label: string;
  route: string;
  ariaLabel: string;
}

export interface DivisionStatusRow {
  divisionId: string;
  name: string;
  staff: StatusCell;
  players: StatusCell;
  next: { text: string; sub: string | null; live: boolean };
  roster: StatusCell;
  last: FormEntry[];
  analysis: { percent: number | null; tone: AnalysisTone };
  action: DivisionStatusAction | null;
}

export interface DivisionStatusInput {
  now: Date;
  /** En el orden del club (D4). */
  divisions: readonly { id: string; name: string }[];
  stats: readonly DivisionStat[];
  matches: readonly Match[];
}

const UNKNOWN: StatusCell = { text: '–', issue: null };

function staffCell(staff: number | null): StatusCell {
  if (staff === null) return UNKNOWN;
  return staff === 0 ? { text: 'Sin entrenador', issue: 'error' } : { text: `${staff} en staff`, issue: null };
}

function playersCell(players: number | null): StatusCell {
  if (players === null) return UNKNOWN;
  return players < STARTERS_TARGET ? { text: String(players), issue: 'warn', note: `no alcanza para ${STARTERS_TARGET}` } : { text: String(players), issue: null };
}

function rosterCell(roster: RosterCount | null, match: Match | null): StatusCell {
  if (!match) return UNKNOWN;
  const gaps = rosterGaps(roster, match.status);
  if (gaps.kind === 'unknown') return UNKNOWN;
  return gaps.kind === 'complete' ? { text: 'Lista', issue: null } : { text: gaps.label, issue: 'warn' };
}

/**
 * «Estado de las divisiones»: una fila por división, en el orden del club. Solo se marca lo que no está bien (sin
 * entrenador, plantel que no alcanza, nómina ausente o con faltantes) y cada fila ofrece como mucho una acción, por orden
 * de gravedad: entrenador, plantel, nómina.
 */
export function divisionStatusRows(input: DivisionStatusInput): DivisionStatusRow[] {
  return input.divisions.map(division => {
    const stat = input.stats.find(candidate => candidate.divisionId === division.id);
    const ofDivision = input.matches.filter(match => match.divisionId === division.id);
    const { live, next } = divisionMatchState(ofDivision, null, input.now);
    const start = next && parseWallClock(next.date);
    const analysis = stat?.analysisPercent ?? null;

    const staff = staffCell(stat?.staff ?? null);
    const players = playersCell(stat?.players ?? null);
    const roster = live ? UNKNOWN : rosterCell(stat?.roster ?? null, next);

    const action: DivisionStatusAction | null =
      staff.issue ? { label: 'Asignar entrenador', route: `/divisions/${division.id}/coaches`, ariaLabel: `Asignar entrenador a ${division.name}` }
      : players.issue ? { label: 'Ver jugadores', route: `/divisions/${division.id}/players`, ariaLabel: `Ver jugadores de ${division.name}: ${players.text}, ${players.note}` }
      : roster.issue && next ? { label: 'Ver nómina', route: `/selection-roster/${next.id}`, ariaLabel: `Ver nómina de ${division.name}: ${roster.text}` }
      : null;

    return {
      divisionId: division.id,
      name: division.name,
      staff,
      players,
      next: live
        ? { text: live.status === 'halftime' ? 'Entretiempo' : 'En curso', sub: `vs ${shortTeamName(live.opponent.alias || live.opponent.name)}`, live: true }
        : next && start
          ? { text: dayLabel(start), sub: `${clockLabel(start)} · vs ${shortTeamName(next.opponent.alias || next.opponent.name)}`, live: false }
          : { text: 'Sin partido', sub: null, live: false },
      roster,
      last: formRecord(ofDivision, input.now)?.last ?? [],
      analysis: { percent: analysis, tone: analysisTone(analysis ?? 100) },
      action
    };
  });
}
