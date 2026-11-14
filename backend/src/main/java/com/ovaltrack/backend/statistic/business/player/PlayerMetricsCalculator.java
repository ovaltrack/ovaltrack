package com.ovaltrack.backend.statistic.business.player;

import com.ovaltrack.backend.event.business.EventRules;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.statistic.domain.dto.MetricComparisonDTO;
import com.ovaltrack.backend.statistic.domain.dto.MetricComparisonDTO.ComparisonVerdict;
import com.ovaltrack.backend.statistic.domain.dto.MetricComparisonDTO.MetricFormat;
import com.ovaltrack.backend.statistic.domain.dto.PlayerActionCountDTO;
import com.ovaltrack.backend.statistic.domain.dto.PlayerMetricsDTO;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.ToIntFunction;

/**
 * Cálculos puros de las estadísticas de un jugador: métricas desde sus eventos, conteo por tipo y comparación
 * con el promedio del plantel. No accede a datos. Los tipos se identifican por `code` del catálogo.
 */
@Component
public class PlayerMetricsCalculator {

    /** Diferencia relativa (sobre el promedio) dentro de la cual una métrica por partido se considera "en el promedio". */
    static final double PER_MATCH_TOLERANCE = 0.10;
    /** Puntos porcentuales dentro de los cuales un porcentaje se considera "en el promedio". */
    static final double PERCENT_TOLERANCE = 5.0;

    /** Métricas del jugador sobre sus eventos (ya filtrados por jugador y activos). */
    public PlayerMetricsDTO metrics(Collection<Event> playerEvents) {
        int points = 0, tries = 0, tacklesMade = 0, tacklesMissed = 0;
        int conversionsMade = 0, conversionAttempts = 0, penaltyKicksMade = 0, penaltyKickAttempts = 0;
        int dropGoals = 0, penaltiesConceded = 0, turnoversWon = 0, yellowCards = 0, redCards = 0;

        for (Event event : playerEvents) {
            EventType type = event.getEventType();
            if (type == null) {
                continue;
            }
            boolean scored = EventRules.countsAsScoring(type, event.getAttributes());
            if (scored && type.getPoints() != null) {
                points += type.getPoints();
            }
            switch (type.getCode() == null ? "" : type.getCode()) {
                case "TRY" -> tries++;
                case "TACKLE_MADE" -> tacklesMade++;
                case "TACKLE_MISSED" -> tacklesMissed++;
                case "CONVERSION" -> {
                    conversionAttempts++;
                    if (scored) conversionsMade++;
                }
                case "PENALTY_KICK" -> {
                    penaltyKickAttempts++;
                    if (scored) penaltyKicksMade++;
                }
                case "DROP_GOAL" -> {
                    if (scored) dropGoals++;
                }
                case "PENALTY_CONCEDED" -> penaltiesConceded++;
                case "TURNOVER_WON" -> turnoversWon++;
                case "YELLOW_CARD" -> yellowCards++;
                case "RED_CARD" -> redCards++;
                default -> { }
            }
        }

        return new PlayerMetricsDTO(points, tries, tacklesMade, tacklesMissed, conversionsMade, conversionAttempts,
                penaltyKicksMade, penaltyKickAttempts, dropGoals, penaltiesConceded, turnoversWon,
                yellowCards, redCards, playerEvents.size());
    }

    /** Cantidad de eventos por tipo, en el orden en que aparece cada tipo; `made` solo en los que tienen resultado (pateos). */
    public List<PlayerActionCountDTO> actions(Collection<Event> playerEvents) {
        Map<String, int[]> counts = new LinkedHashMap<>();
        Map<String, EventType> types = new LinkedHashMap<>();
        for (Event event : playerEvents) {
            EventType type = event.getEventType();
            if (type == null || type.getCode() == null) {
                continue;
            }
            types.putIfAbsent(type.getCode(), type);
            int[] value = counts.computeIfAbsent(type.getCode(), code -> new int[2]);
            value[0]++;
            if (EventRules.countsAsScoring(type, event.getAttributes())) {
                value[1]++;
            }
        }
        List<PlayerActionCountDTO> result = new ArrayList<>();
        counts.forEach((code, value) -> {
            EventType type = types.get(code);
            Integer made = hasResultField(type) ? value[1] : null;
            result.add(new PlayerActionCountDTO(code, type.getName(), type.getGroupName(), value[0], made));
        });
        return result;
    }

    /**
     * Compara al jugador con el plantel. Por partido: total / apariciones de cada lado. Porcentajes: aciertos / intentos
     * acumulados de cada lado (null sin intentos). El plantel incluye al propio jugador.
     */
    public List<MetricComparisonDTO> compare(PlayerMetricsDTO player, int playerAppearances,
                                             PlayerMetricsDTO squad, int squadAppearances) {
        List<MetricComparisonDTO> result = new ArrayList<>();
        result.add(perMatch("points", PlayerMetricsDTO::points, true, player, playerAppearances, squad, squadAppearances));
        result.add(perMatch("tries", PlayerMetricsDTO::tries, true, player, playerAppearances, squad, squadAppearances));
        result.add(perMatch("tacklesMade", PlayerMetricsDTO::tacklesMade, true, player, playerAppearances, squad, squadAppearances));
        result.add(percent("tackleEffectiveness",
                player.tacklesMade(), player.tacklesMade() + player.tacklesMissed(),
                squad.tacklesMade(), squad.tacklesMade() + squad.tacklesMissed()));
        result.add(percent("goalKickingEffectiveness",
                player.conversionsMade() + player.penaltyKicksMade(), player.conversionAttempts() + player.penaltyKickAttempts(),
                squad.conversionsMade() + squad.penaltyKicksMade(), squad.conversionAttempts() + squad.penaltyKickAttempts()));
        result.add(perMatch("turnoversWon", PlayerMetricsDTO::turnoversWon, true, player, playerAppearances, squad, squadAppearances));
        result.add(perMatch("penaltiesConceded", PlayerMetricsDTO::penaltiesConceded, false, player, playerAppearances, squad, squadAppearances));
        return result;
    }

    private MetricComparisonDTO perMatch(String key, ToIntFunction<PlayerMetricsDTO> metric, boolean higherIsBetter,
                                         PlayerMetricsDTO player, int playerAppearances,
                                         PlayerMetricsDTO squad, int squadAppearances) {
        Double playerValue = average(metric.applyAsInt(player), playerAppearances);
        Double squadValue = average(metric.applyAsInt(squad), squadAppearances);
        double tolerance = squadValue == null ? 0 : Math.max(squadValue * PER_MATCH_TOLERANCE, 0.05);
        return new MetricComparisonDTO(key, playerValue, squadValue, MetricFormat.PER_MATCH, higherIsBetter,
                verdict(playerValue, squadValue, tolerance));
    }

    private MetricComparisonDTO percent(String key, int playerMade, int playerAttempts, int squadMade, int squadAttempts) {
        Double playerValue = percentage(playerMade, playerAttempts);
        Double squadValue = percentage(squadMade, squadAttempts);
        return new MetricComparisonDTO(key, playerValue, squadValue, MetricFormat.PERCENT, true,
                verdict(playerValue, squadValue, PERCENT_TOLERANCE));
    }

    /** Tipos con intento y acierto: los que puntúan solo si un campo con efecto "scoring" lo indica (conversión, penal). */
    private static boolean hasResultField(EventType type) {
        return Boolean.TRUE.equals(type.getIsScoring()) && type.getTemplateEventFields() != null
                && type.getTemplateEventFields().stream()
                        .anyMatch(field -> field.effects() != null && field.effects().contains("scoring"));
    }

    static ComparisonVerdict verdict(Double playerValue, Double squadValue, double tolerance) {
        if (playerValue == null || squadValue == null) {
            return ComparisonVerdict.NO_DATA;
        }
        double difference = playerValue - squadValue;
        if (Math.abs(difference) <= tolerance) {
            return ComparisonVerdict.EQUAL;
        }
        return difference > 0 ? ComparisonVerdict.ABOVE : ComparisonVerdict.BELOW;
    }

    private static Double average(int total, int appearances) {
        return appearances == 0 ? null : round(total / (double) appearances);
    }

    private static Double percentage(int made, int attempts) {
        return attempts == 0 ? null : round(made * 100.0 / attempts);
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
