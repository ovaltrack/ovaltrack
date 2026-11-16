import { CoverageEvent, reviewCoverage } from '../../match/post-match/utils/review-coverage';
import { ZONE_HALF_MINUTES, ZoneAssignmentResponse } from '../../match/types/zone.types';
import { coverageMinutes } from '../../match/post-match/utils/zone-stats';

export interface AnalysisCoverage {
  totalEvents: number;
  /** Jugadas propias o neutrales sin jugador asignado. */
  withoutPlayer: number;
  /** 0–100, redondeado; un partido sin eventos cuenta como 100. */
  percent: number;
}

/**
 * Cobertura de análisis de un partido con la misma regla y el mismo conjunto de eventos que post-partido
 * (`reviewCoverage`): los eventos de tipos dados de baja no cuentan. `activeTypeIds` `null` = sin catálogo, todos cuentan.
 */
export function analysisCoverage(events: readonly CoverageEvent[], activeTypeIds: ReadonlySet<string> | null): AnalysisCoverage {
  const { totalEvents, unassigned, percent } = reviewCoverage(events, activeTypeIds);
  return { totalEvents, withoutPlayer: unassigned, percent };
}

/** Minutos del partido (de 80) que todavía no tienen un tramo de zona asignado. */
export function minutesWithoutZone(assignments: readonly Pick<ZoneAssignmentResponse, 'period' | 'startMinute' | 'endMinute'>[]): number {
  const covered = coverageMinutes([...assignments], 1) + coverageMinutes([...assignments], 2);
  return ZONE_HALF_MINUTES * 2 - covered;
}

export type AnalysisTone = 'good' | 'warn' | 'bad';

/** Color de la barra y del anillo de análisis: ≥ 90 % bien, ≥ 60 % atención, el resto mal. */
export function analysisTone(percent: number): AnalysisTone {
  return percent >= 90 ? 'good' : percent >= 60 ? 'warn' : 'bad';
}
