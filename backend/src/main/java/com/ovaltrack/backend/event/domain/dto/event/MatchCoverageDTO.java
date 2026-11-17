package com.ovaltrack.backend.event.domain.dto.event;

import java.util.UUID;

/**
 * Cobertura de análisis de un partido finalizado: cuántos de sus eventos activos ya tienen jugador asignado.
 * Los eventos del rival no cuentan como pendientes. Sin eventos la cobertura es 100.
 */
public record MatchCoverageDTO(UUID matchId, long totalEvents, long withoutPlayer, int percent) {

    private static final int FULL_COVERAGE = 100;

    public static MatchCoverageDTO of(UUID matchId, long totalEvents, long withoutPlayer) {
        return new MatchCoverageDTO(matchId, totalEvents, withoutPlayer, percentOf(totalEvents, withoutPlayer));
    }

    public static MatchCoverageDTO empty(UUID matchId) {
        return of(matchId, 0, 0);
    }

    private static int percentOf(long totalEvents, long withoutPlayer) {
        if (totalEvents == 0) {
            return FULL_COVERAGE;
        }
        return (int) Math.round((double) (totalEvents - withoutPlayer) / totalEvents * FULL_COVERAGE);
    }
}
