package com.ovaltrack.backend.statistic.domain.dto;

import java.util.List;
import java.util.UUID;

/**
 * Respuesta de GET /statistics/player/{personId}: estadísticas generales del jugador en una división y temporada,
 * comparadas por partido con el promedio del plantel de esa división en la misma temporada.
 */
public record PlayerStatisticsDTO(
    UUID personId,
    String fullName,
    UUID divisionId,
    String divisionName,
    /** Año de la temporada; null si el jugador no tiene partidos en la división. */
    Integer season,
    List<Integer> seasons,
    List<Division> divisions,
    List<PlayerMatchSummaryDTO> matches,
    PlayerMetricsDTO totals,
    List<MetricComparisonDTO> comparisons,
    PlayerZoneMapDTO zones,
    List<PlayerActionCountDTO> actions
) {
    public record Division(UUID divisionId, String name) {
    }
}
