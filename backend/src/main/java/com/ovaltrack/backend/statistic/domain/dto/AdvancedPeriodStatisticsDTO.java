package com.ovaltrack.backend.statistic.domain.dto;

import java.util.List;

/**
 * Estadísticas de segundo nivel de un período (o del partido completo, con {@code period} null): las que necesitan
 * la secuencia de eventos o las zonas de la cancha y por eso solo se calculan en el backend.
 */
public record AdvancedPeriodStatisticsDTO(
    /** 1, 2 o null para el partido completo. */
    Integer period,
    /** Posesiones de cada equipo (sin las que solo fueron un saque de reinicio). */
    TeamCount possessions,
    TeamRate pointsPerPossession,
    /** Cómo terminó cada posesión: una fila por {@code PossessionOutcome}, siempre en el mismo orden. */
    List<CategoryCount> possessionOutcomes,
    /** Cómo empezó la jugada de cada try: una fila por {@code PossessionSource}, siempre en el mismo orden. */
    List<CategoryCount> trySources,
    /** Posesiones que empezaron con un turnover ganado y los puntos que se hicieron en ellas. */
    TeamCount turnoverPossessions,
    TeamCount pointsFromTurnovers,
    RedZone redZone,
    PenaltyTerritory penaltiesByTerritory,
    /** Puntos por bloque de 10 minutos de juego. */
    List<ScoreBlock> scoreByBlock,
    SinBin sinBin
) {

    public record TeamCount(int own, int opponent) {
    }

    /** null cuando no hay datos para calcular el valor. */
    public record TeamRate(Double own, Double opponent) {
    }

    public record CategoryCount(String key, int own, int opponent) {
    }

    /**
     * Visitas a la 22 rival (tramos seguidos en las columnas 5-6 para el propio, 1-2 para el rival) y los puntos que
     * hizo cada equipo durante ellas. {@code available} es false si el período no tiene tramos cargados.
     */
    public record RedZone(boolean available, TeamCount visits, TeamCount points, TeamRate pointsPerVisit) {
    }

    /** Penales concedidos por cada equipo según la mitad de la cancha, vista desde el equipo que lo cometió. */
    public record PenaltyTerritory(TeamCount ownHalf, TeamCount opponentHalf, TeamCount withoutZone) {
    }

    /** Minutos de partido acumulados, rango semiabierto [fromMinute, toMinute). */
    public record ScoreBlock(int fromMinute, int toMinute, int own, int opponent) {
    }

    /** Por equipo amonestado: amarillas y puntos a favor y en contra mientras cumplía la suspensión. */
    public record SinBin(TeamCount yellowCards, TeamCount pointsFor, TeamCount pointsAgainst) {
    }
}
