package com.ovaltrack.backend.statistic.domain.dto;

import com.ovaltrack.backend.match.domain.MatchPlayerRole;

import java.time.LocalDateTime;
import java.util.UUID;

/** Partido finalizado que jugó el jugador, con sus métricas. El club siempre es local. */
public record PlayerMatchSummaryDTO(
    UUID matchId,
    LocalDateTime date,
    String opponentName,
    Integer homeScore,
    Integer awayScore,
    MatchPlayerRole role,
    Integer number,
    PlayerMetricsDTO metrics
) {
}
