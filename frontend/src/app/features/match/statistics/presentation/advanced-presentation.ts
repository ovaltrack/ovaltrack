import { AdvancedPeriodStatistics, AdvancedTeamCount, AdvancedTeamRate, CategoryCount } from '../types/statistic.types';
import { StatLine } from './stat-presentation';

/** Bloque de estadísticas de segundo nivel listo para mostrar. */
export interface AdvancedSection {
  id: string;
  title: string;
  lines: StatLine[];
  /** Las filas comparan cantidades del mismo tipo: se muestran con barra. */
  bars: boolean;
  /** Texto a mostrar cuando el bloque no tiene datos. */
  emptyMessage: string | null;
}

const EMPTY = '—';

export const POSSESSION_OUTCOME_LABELS: Record<string, string> = {
  POINTS: 'Terminan en puntos',
  KICK: 'Terminan en patada',
  TURNOVER: 'Terminan en turnover',
  PENALTY: 'Terminan en penal en contra',
  SET_PIECE_LOST: 'Formación fija perdida',
  PERIOD_END: 'Fin del tiempo',
  OTHER: 'Otro cambio de posesión',
};

export const TRY_SOURCE_LABELS: Record<string, string> = {
  SCRUM: 'Scrum',
  LINEOUT: 'Line-out',
  TURNOVER: 'Turnover',
  PENALTY: 'Penal a favor',
  KICK_RETURN: 'Devolución de patada',
  RESTART: 'Saque de reinicio',
  OTHER: 'Sin origen registrado',
};

const countLine = (label: string, value: AdvancedTeamCount): StatLine => ({
  label,
  own: `${value.own}`,
  opponent: `${value.opponent}`,
  ownValue: value.own,
  opponentValue: value.opponent,
});

const formatRate = (value: number | null): string => (value === null ? EMPTY : value.toFixed(1));

const rateLine = (label: string, value: AdvancedTeamRate): StatLine => ({
  label,
  own: formatRate(value.own),
  opponent: formatRate(value.opponent),
  ownValue: value.own ?? 0,
  opponentValue: value.opponent ?? 0,
});

const hasData = (line: StatLine): boolean => line.ownValue + line.opponentValue > 0;

/** Una fila por categoría con datos, con la etiqueta del catálogo (o la clave si es nueva). */
const categoryLines = (categories: CategoryCount[], labels: Record<string, string>): StatLine[] =>
  categories
    .map(category => countLine(labels[category.key] ?? category.key, category))
    .filter(hasData);

const section = (id: string, title: string, lines: StatLine[], bars: boolean, emptyMessage: string): AdvancedSection => ({
  id,
  title,
  lines,
  bars,
  emptyMessage: lines.some(hasData) ? null : emptyMessage,
});

/** Bloques de segundo nivel de un período, en el orden en que se muestran. */
export function presentAdvancedStatistics(stats: AdvancedPeriodStatistics): AdvancedSection[] {
  const redZone = stats.redZone;
  const penalties = stats.penaltiesByTerritory;
  const sinBin = stats.sinBin;

  return [
    section('possessions', 'Posesiones', [
      countLine('Posesiones', stats.possessions),
      rateLine('Puntos por posesión', stats.pointsPerPossession),
      ...categoryLines(stats.possessionOutcomes, POSSESSION_OUTCOME_LABELS),
    ], false, 'Sin posesiones registradas.'),
    section('try-sources', 'Origen de los tries', categoryLines(stats.trySources, TRY_SOURCE_LABELS), true,
      'Sin tries en el período.'),
    section('turnovers', 'Después de un turnover', [
      countLine('Posesiones ganadas', stats.turnoverPossessions),
      countLine('Puntos conseguidos', stats.pointsFromTurnovers),
    ], false, 'Sin turnovers en el período.'),
    redZone.available
      ? section('red-zone', 'Zona roja (22 rival)', [
        countLine('Visitas', redZone.visits),
        countLine('Puntos', redZone.points),
        rateLine('Puntos por visita', redZone.pointsPerVisit),
      ], false, 'Sin visitas a la 22 rival.')
      : { id: 'red-zone', title: 'Zona roja (22 rival)', lines: [], bars: false,
        emptyMessage: 'Cargá los tramos de zona del período para ver la zona roja.' },
    section('discipline', 'Disciplina', [
      countLine('Penales en campo propio', penalties.ownHalf),
      countLine('Penales en campo rival', penalties.opponentHalf),
      ...(hasData(countLine('', penalties.withoutZone)) ? [countLine('Penales sin zona', penalties.withoutZone)] : []),
      countLine('Amarillas', sinBin.yellowCards),
      countLine('Puntos a favor con un amarillado', sinBin.pointsFor),
      countLine('Puntos en contra con un amarillado', sinBin.pointsAgainst),
    ], false, 'Sin penales ni amarillas en el período.'),
    section('score-blocks', 'Puntos cada 10 minutos',
      stats.scoreByBlock.map(block => countLine(`${block.fromMinute}'–${block.toMinute}'`, block)), true,
      'Sin puntos en el período.'),
  ];
}
