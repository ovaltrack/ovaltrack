package com.ovaltrack.backend.statistic.domain.dto;

/**
 * Métricas de un jugador en uno o varios partidos, contadas sobre los eventos activos donde figura como jugador.
 * Los pateos a palos cuentan intentos y aciertos; los puntos solo suman las jugadas que puntúan.
 */
public record PlayerMetricsDTO(
    int points,
    int tries,
    int tacklesMade,
    int tacklesMissed,
    int conversionsMade,
    int conversionAttempts,
    int penaltyKicksMade,
    int penaltyKickAttempts,
    int dropGoals,
    int penaltiesConceded,
    int turnoversWon,
    int handlingErrors,
    int yellowCards,
    int redCards,
    /** Total de eventos del jugador, de cualquier tipo. */
    int actions
) {
    public static final PlayerMetricsDTO EMPTY = new PlayerMetricsDTO(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    public PlayerMetricsDTO plus(PlayerMetricsDTO other) {
        return new PlayerMetricsDTO(
            points + other.points,
            tries + other.tries,
            tacklesMade + other.tacklesMade,
            tacklesMissed + other.tacklesMissed,
            conversionsMade + other.conversionsMade,
            conversionAttempts + other.conversionAttempts,
            penaltyKicksMade + other.penaltyKicksMade,
            penaltyKickAttempts + other.penaltyKickAttempts,
            dropGoals + other.dropGoals,
            penaltiesConceded + other.penaltiesConceded,
            turnoversWon + other.turnoversWon,
            handlingErrors + other.handlingErrors,
            yellowCards + other.yellowCards,
            redCards + other.redCards,
            actions + other.actions);
    }
}
