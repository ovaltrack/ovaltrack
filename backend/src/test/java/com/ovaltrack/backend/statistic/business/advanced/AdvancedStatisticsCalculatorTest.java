package com.ovaltrack.backend.statistic.business.advanced;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.ovaltrack.backend.event.domain.Actor;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.domain.PossessionAfter;
import com.ovaltrack.backend.event.domain.TemplateField;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO.CategoryCount;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO.ScoreBlock;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO.TeamCount;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO.TeamRate;
import com.ovaltrack.backend.zone.business.EventZoneResolver;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;

@DisplayName("AdvancedStatisticsCalculator")
class AdvancedStatisticsCalculatorTest {

    private static final EventPossession OWN = EventPossession.OWN;
    private static final EventPossession OPP = EventPossession.OPPONENT;

    private final AdvancedStatisticsCalculator calculator = new AdvancedStatisticsCalculator(new EventZoneResolver());

    // <===== Catálogo (lo necesario de staging/event_type.sql) =====>

    private static TemplateField select(String key, Map<String, String> possessionByValue) {
        List<TemplateField.Option> options = possessionByValue.entrySet().stream()
                .map(entry -> new TemplateField.Option(entry.getKey(), entry.getKey(), entry.getValue(), null))
                .toList();
        return new TemplateField(key, key, "select", "live", true, options, null, null, null, null, null, null);
    }

    private static final TemplateField WAS_SUCCESSFUL =
            new TemplateField("wasSuccessful", "Resultado", "boolean", "live", true, null, null, null, null,
                    List.of("scoring"), null, null);

    private static EventType type(String code, Actor actor, PossessionAfter after, Integer points, TemplateField... fields) {
        return EventType.builder()
                .id(UUID.randomUUID()).code(code).name(code).actor(actor).possessionAfter(after)
                .isScoring(points != null).points(points)
                .templateEventFields(List.of(fields))
                .build();
    }

    private static final EventType TRY = type("TRY", Actor.ATTACKING, PossessionAfter.KEEP, 5);
    private static final EventType CONVERSION = type("CONVERSION", Actor.ATTACKING, PossessionAfter.OTHER, 2, WAS_SUCCESSFUL);
    private static final EventType PENALTY_KICK = type("PENALTY_KICK", Actor.ATTACKING, PossessionAfter.OTHER, 3, WAS_SUCCESSFUL);
    private static final EventType RESTART_KICK = type("RESTART_KICK", Actor.ATTACKING, PossessionAfter.KEEP, null,
            select("outcome", Map.of("received_clean", "OTHER", "regained_attack", "KEEP")));
    private static final EventType LINEOUT = type("LINEOUT", Actor.ATTACKING, PossessionAfter.KEEP, null,
            select("lineResult", Map.of("won_clean", "KEEP", "lost", "OTHER")));
    private static final EventType TACKLE_MADE = type("TACKLE_MADE", Actor.DEFENDING, PossessionAfter.KEEP, null);
    private static final EventType TURNOVER_WON = type("TURNOVER_WON", Actor.DEFENDING, PossessionAfter.ACTOR, null);
    private static final EventType PENALTY_CONCEDED = type("PENALTY_CONCEDED", Actor.CHOOSE, PossessionAfter.OTHER, null);
    private static final EventType YELLOW_CARD = type("YELLOW_CARD", Actor.CHOOSE, PossessionAfter.KEEP, null);

    private static Event event(EventType type, EventPossession team, int period, int seconds, Map<String, Object> attributes) {
        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setEventType(type);
        event.setTeamPossession(team);
        event.setPeriod(period);
        event.setMatchTime(seconds);
        event.setAttributes(attributes);
        event.setActive(true);
        return event;
    }

    private static Event event(EventType type, EventPossession team, int period, int seconds) {
        return event(type, team, period, seconds, Map.of());
    }

    private static ZoneAssignment zone(int period, int from, int to, int col) {
        return ZoneAssignment.builder().id(UUID.randomUUID()).period(period).startMinute(from).endMinute(to).row(2).col(col).build();
    }

    private static CategoryCount category(List<CategoryCount> categories, Enum<?> key) {
        return categories.stream().filter(c -> c.key().equals(key.name())).findFirst().orElseThrow();
    }

    /** Un primer tiempo con dos tries propios… y uno rival tras un turnover. */
    private static List<Event> firstHalf() {
        List<Event> events = new ArrayList<>();
        events.add(event(RESTART_KICK, OPP, 1, 0, Map.of("outcome", "received_clean")));
        events.add(event(LINEOUT, OWN, 1, 60, Map.of("lineResult", "won_clean")));
        events.add(event(TRY, OWN, 1, 120));
        events.add(event(CONVERSION, OWN, 1, 150, Map.of("wasSuccessful", true)));
        events.add(event(RESTART_KICK, OPP, 1, 180, Map.of("outcome", "received_clean")));
        events.add(event(TACKLE_MADE, OPP, 1, 200));
        events.add(event(TURNOVER_WON, OPP, 1, 240));
        events.add(event(TRY, OPP, 1, 300));
        events.add(event(CONVERSION, OPP, 1, 330, Map.of("wasSuccessful", false)));
        events.add(event(PENALTY_CONCEDED, OPP, 1, 400));
        events.add(event(PENALTY_KICK, OWN, 1, 420, Map.of("wasSuccessful", true)));
        return events;
    }

    @Test
    @DisplayName("Arma las posesiones con la regla de la carga en vivo y excluye las que solo fueron patear el saque")
    void possessions() {
        AdvancedPeriodStatisticsDTO stats = calculator.calculate(firstHalf(), List.of(), 1);

        assertEquals(new TeamCount(3, 2), stats.possessions());
        assertEquals(new TeamRate(3.3, 2.5), stats.pointsPerPossession());
        assertEquals(new CategoryCount("POINTS", 2, 1), category(stats.possessionOutcomes(), PossessionOutcome.POINTS));
        assertEquals(new CategoryCount("TURNOVER", 1, 0), category(stats.possessionOutcomes(), PossessionOutcome.TURNOVER));
        assertEquals(new CategoryCount("PERIOD_END", 0, 1), category(stats.possessionOutcomes(), PossessionOutcome.PERIOD_END));
        assertEquals(PossessionOutcome.values().length, stats.possessionOutcomes().size());
    }

    @Test
    @DisplayName("El origen del try es el último reinicio dentro de la posesión, o el evento que dio la pelota")
    void trySources() {
        AdvancedPeriodStatisticsDTO stats = calculator.calculate(firstHalf(), List.of(), 1);

        assertEquals(new CategoryCount("LINEOUT", 1, 0), category(stats.trySources(), PossessionSource.LINEOUT));
        assertEquals(new CategoryCount("TURNOVER", 0, 1), category(stats.trySources(), PossessionSource.TURNOVER));
        assertEquals(new TeamCount(0, 1), stats.turnoverPossessions());
        assertEquals(new TeamCount(0, 5), stats.pointsFromTurnovers());
    }

    @Test
    @DisplayName("Un penal del rival no corta la posesión propia: el Kick H suma en la misma posesión")
    void penaltyAgainstDefenceKeepsPossession() {
        AdvancedPeriodStatisticsDTO stats = calculator.calculate(firstHalf(), List.of(), 1);

        assertEquals(new CategoryCount("PENALTY", 0, 0), category(stats.possessionOutcomes(), PossessionOutcome.PENALTY));
        assertEquals(new TeamCount(10, 5), new TeamCount(
                stats.scoreByBlock().get(0).own(), stats.scoreByBlock().get(0).opponent()));
    }

    @Test
    @DisplayName("Zona roja: tramos seguidos en la 22 rival son una visita y suman los puntos de ese rango")
    void redZone() {
        List<ZoneAssignment> zones = List.of(zone(1, 0, 5, 5), zone(1, 5, 10, 6), zone(1, 10, 20, 3), zone(1, 20, 25, 2));
        List<Event> events = List.of(
                event(TRY, OWN, 1, 360),
                event(PENALTY_KICK, OPP, 1, 21 * 60, Map.of("wasSuccessful", true)),
                event(TRY, OPP, 1, 15 * 60));

        AdvancedPeriodStatisticsDTO.RedZone redZone = calculator.calculate(events, zones, 1).redZone();

        assertTrue(redZone.available());
        assertEquals(new TeamCount(1, 1), redZone.visits());
        assertEquals(new TeamCount(5, 3), redZone.points());
        assertEquals(new TeamRate(5.0, 3.0), redZone.pointsPerVisit());
    }

    @Test
    @DisplayName("Sin tramos la zona roja no está disponible")
    void redZoneWithoutZones() {
        assertFalse(calculator.calculate(firstHalf(), List.of(), 1).redZone().available());
    }

    @Test
    @DisplayName("Penales por territorio, vistos desde el equipo que los cometió")
    void penaltiesByTerritory() {
        List<ZoneAssignment> zones = List.of(zone(1, 10, 20, 3), zone(1, 20, 25, 2));
        List<Event> events = List.of(
                event(PENALTY_CONCEDED, OWN, 1, 12 * 60),
                event(PENALTY_CONCEDED, OPP, 1, 22 * 60),
                event(PENALTY_CONCEDED, OWN, 1, 30 * 60));

        AdvancedPeriodStatisticsDTO.PenaltyTerritory territory = calculator.calculate(events, zones, 1).penaltiesByTerritory();

        assertEquals(new TeamCount(1, 0), territory.ownHalf());
        assertEquals(new TeamCount(0, 1), territory.opponentHalf());
        assertEquals(new TeamCount(1, 0), territory.withoutZone());
    }

    @Test
    @DisplayName("Puntos por bloque de 10': el tiempo añadido va al último bloque y el partido completo tiene 8 bloques")
    void scoreByBlock() {
        List<Event> events = List.of(
                event(TRY, OWN, 1, 2500),
                event(TRY, OPP, 2, 45 * 60));

        List<ScoreBlock> full = calculator.calculate(events, List.of(), null).scoreByBlock();
        List<ScoreBlock> second = calculator.calculate(events, List.of(), 2).scoreByBlock();

        assertEquals(8, full.size());
        assertEquals(new ScoreBlock(30, 40, 5, 0), full.get(3));
        assertEquals(new ScoreBlock(40, 50, 0, 5), full.get(4));
        assertEquals(4, second.size());
        assertEquals(new ScoreBlock(40, 50, 0, 5), second.get(0));
    }

    @Test
    @DisplayName("Amarillas: puntos a favor y en contra del amonestado durante la suspensión")
    void sinBin() {
        List<Event> events = List.of(
                event(YELLOW_CARD, OWN, 1, 600),
                event(TRY, OPP, 1, 700),
                event(PENALTY_KICK, OWN, 1, 900, Map.of("wasSuccessful", true)),
                event(TRY, OPP, 1, 1300),
                event(YELLOW_CARD, OPP, 1, 1400, Map.of("durationMinutes", 2)),
                event(TRY, OWN, 1, 1600));

        AdvancedPeriodStatisticsDTO.SinBin sinBin = calculator.calculate(events, List.of(), 1).sinBin();

        assertEquals(new TeamCount(1, 1), sinBin.yellowCards());
        assertEquals(new TeamCount(3, 0), sinBin.pointsFor());
        assertEquals(new TeamCount(5, 0), sinBin.pointsAgainst());
    }

    @Test
    @DisplayName("Cada período arranca sin posesión: el partido completo suma las posesiones de los dos tiempos")
    void fullMatchJoinsPeriods() {
        List<Event> events = new ArrayList<>(firstHalf());
        events.add(event(LINEOUT, OWN, 2, 2500, Map.of("lineResult", "won_clean")));
        events.add(event(TRY, OWN, 2, 2600));

        AdvancedPeriodStatisticsDTO full = calculator.calculate(events, List.of(), null);

        assertEquals(new TeamCount(4, 2), full.possessions());
        assertEquals(new CategoryCount("LINEOUT", 2, 0), category(full.trySources(), PossessionSource.LINEOUT));
    }
}
