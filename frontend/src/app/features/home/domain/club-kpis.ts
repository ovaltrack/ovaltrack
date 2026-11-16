import { Match } from '../../match/types/match.types';
import { analysisTone } from './analysis-coverage';
import { DivisionStat, DivisionStatusRow } from './division-status';
import { finishedOfSeason, resultOf } from './form-record';

export interface ClubKpi {
  key: 'players' | 'matches' | 'analysis' | 'pending';
  label: string;
  /** Mono grande: «122», «81 %»; «–» si no se pudo calcular. */
  value: string;
  sub: string;
  /** Ámbar: el análisis promedio por debajo de 90 % o pendientes por resolver. */
  warn: boolean;
}

const MAX_NAMED = 3;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Divisiones con algo marcado (entrenador, plantel, nómina o análisis por debajo de 90 %). */
const marked = (row: DivisionStatusRow): boolean =>
  row.staff.issue !== null || row.players.issue !== null || row.roster.issue !== null || (row.analysis.percent !== null && row.analysis.tone !== 'good');

/** «Superior, M15 y 2 más»: nunca más de 3 nombres. */
function whereLabel(names: readonly string[]): string {
  if (names.length <= MAX_NAMED) return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  return `${names.slice(0, MAX_NAMED).join(', ')} y ${names.length - MAX_NAMED} más`;
}

/**
 * Franja de KPIs del club: jugadores activos, partidos del año (G · E · P), análisis promedio del último partido de cada
 * división y pendientes (cuántas divisiones tienen algo marcado y cuáles).
 */
export function clubKpis(rows: readonly DivisionStatusRow[], stats: readonly DivisionStat[], matches: readonly Match[], now: Date): ClubKpi[] {
  const known = stats.flatMap(stat => rows.some(row => row.divisionId === stat.divisionId) && stat.players !== null ? [stat.players] : []);
  const players = known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);

  const finished = finishedOfSeason(matches.filter(match => rows.some(row => row.divisionId === match.divisionId)), now);
  const results = finished.map(match => resultOf(match.homeScore, match.awayScore));
  const wins = results.filter(result => result === 'win').length;
  const draws = results.filter(result => result === 'draw').length;

  const percents = rows.flatMap(row => row.analysis.percent === null ? [] : [row.analysis.percent]);
  const average = percents.length === 0 ? null : Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length);

  const flagged = rows.filter(marked).map(row => row.name);

  return [
    { key: 'players', label: 'Jugadores activos', value: players === null ? '–' : String(players), sub: `en ${count(rows.length, 'división', 'divisiones')}`, warn: false },
    { key: 'matches', label: `Partidos ${now.getFullYear()}`, value: String(finished.length), sub: `${wins} G · ${draws} E · ${finished.length - wins - draws} P`, warn: false },
    { key: 'analysis', label: 'Análisis promedio', value: average === null ? '–' : `${average} %`, sub: 'último partido de cada división', warn: average !== null && analysisTone(average) !== 'good' },
    { key: 'pending', label: 'Pendientes', value: String(flagged.length), sub: flagged.length === 0 ? 'Todo en orden' : whereLabel(flagged), warn: flagged.length > 0 }
  ];
}
