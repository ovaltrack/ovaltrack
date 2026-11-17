package com.ovaltrack.backend.event.domain.dto.event;

import java.util.UUID;

/**
 * Cobertura de análisis de un partido: jugadas revisables y cuántas siguen sin jugador.
 * Misma regla que la revisión post-partido del frontend ({@code reviewCoverage}).
 */
public record MatchCoverageDTO(UUID matchId, long totalEvents, long withoutPlayer, int percent) {

    /** Porcentaje de jugadas con jugador, redondeado como {@code Math.round} de JavaScript; sin jugadas es 100. */
    public static MatchCoverageDTO of(UUID matchId, long totalEvents, long withoutPlayer) {
        int percent = totalEvents > 0
                ? (int) Math.round(((double) (totalEvents - withoutPlayer) / totalEvents) * 100)
                : 100;
        return new MatchCoverageDTO(matchId, totalEvents, withoutPlayer, percent);
    }
}
