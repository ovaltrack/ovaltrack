package com.ovaltrack.backend.statistic.domain.dto;

import java.util.List;
import java.util.UUID;

/** Respuesta de GET /statistics/match/{matchId}/advanced: primer tiempo, segundo tiempo y partido completo. */
public record AdvancedMatchStatisticsDTO(
    UUID matchId,
    List<AdvancedPeriodStatisticsDTO> periods
) {
}
