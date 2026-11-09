package com.ovaltrack.backend.statistic.domain.dto;

import java.util.List;
import java.util.UUID;

/**
 * Respuesta de GET /statistics/player/{personId}/match/{matchId}: lo que hizo el jugador en un partido,
 * comparado con el promedio de los jugadores del plantel de ese partido.
 */
public record PlayerMatchStatisticsDTO(
    UUID personId,
    String fullName,
    UUID divisionId,
    String divisionName,
    PlayerMatchSummaryDTO match,
    int squadSize,
    List<MetricComparisonDTO> comparisons,
    PlayerZoneMapDTO zones,
    List<PlayerActionCountDTO> actions
) {
}
