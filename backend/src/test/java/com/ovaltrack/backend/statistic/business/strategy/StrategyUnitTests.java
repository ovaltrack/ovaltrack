package com.ovaltrack.backend.statistic.business.strategy;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.ovaltrack.backend.event.domain.Actor;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.domain.PossessionAfter;
import com.ovaltrack.backend.event.domain.TemplateField;
import com.ovaltrack.backend.statistic.domain.dto.PeriodStatisticDTO;

/** Las estrategias identifican los tipos por {@code code} del catálogo (staging/event_type.sql), no por su nombre. */
@DisplayName("Tests Unitarios de Estrategias de Estadísticas")
class StrategyUnitTests {

    private static final EventPossession OWN = EventPossession.OWN;
    private static final EventPossession OPP = EventPossession.OPPONENT;
    private static final EventPossession NEUTRAL = EventPossession.NEUTRAL;

    private static final TemplateField WAS_SUCCESSFUL = new TemplateField("wasSuccessful", "Resultado", "boolean", "live",
            true, null, null, null, null, List.of("scoring"), null, null);

    private static TemplateField select(String key, Map<String, String> possessionByValue) {
        List<TemplateField.Option> options = possessionByValue.entrySet().stream()
                .map(entry -> new TemplateField.Option(entry.getKey(), entry.getKey(), entry.getValue(), null))
                .toList();
        return new TemplateField(key, key, "select", "live", true, options, null, null, null, null, null, null);
    }

    /** El nombre es el del catálogo real: las estrategias no deben depender de él. */
    private static EventType type(String code, String name, Actor actor, Integer points, TemplateField... fields) {
        return EventType.builder()
                .id(UUID.randomUUID()).code(code).name(name).actor(actor).possessionAfter(PossessionAfter.KEEP)
                .isScoring(points != null).points(points)
                .templateEventFields(List.of(fields))
                .build();
    }

    private static final EventType TRY = type("TRY", "Try", Actor.ATTACKING, 5);
    private static final EventType PENALTY_TRY = type("PENALTY_TRY", "Try penal", Actor.ATTACKING, 7);
    private static final EventType CONVERSION = type("CONVERSION", "Conversión", Actor.ATTACKING, 2, WAS_SUCCESSFUL);
    private static final EventType PENALTY_KICK = type("PENALTY_KICK", "Kick H (Penal a palos)", Actor.ATTACKING, 3, WAS_SUCCESSFUL);
    private static final EventType DROP_GOAL = type("DROP_GOAL", "Drop goal", Actor.ATTACKING, 3, WAS_SUCCESSFUL);
    private static final EventType TACKLE_MADE = type("TACKLE_MADE", "Tackle completado", Actor.DEFENDING, null);
    private static final EventType TACKLE_MISSED = type("TACKLE_MISSED", "Tackle fallado", Actor.DEFENDING, null);
    private static final EventType TURNOVER_WON = type("TURNOVER_WON", "Turnover", Actor.DEFENDING, null);
    private static final EventType PENALTY_CONCEDED = type("PENALTY_CONCEDED", "Penal / Infracción", Actor.CHOOSE, null);
    private static final EventType YELLOW_CARD = type("YELLOW_CARD", "Tarjeta Amarilla", Actor.CHOOSE, null);
    private static final EventType RED_CARD = type("RED_CARD", "Tarjeta Roja / Expulsión", Actor.CHOOSE, null);
    private static final EventType CARRY = type("CARRY", "Acarreo (Carry)", Actor.ATTACKING, null);
    private static final EventType SCRUM = type("SCRUM", "Scrum", Actor.ATTACKING, null,
            select("scrumResult", Map.of("won_clean", "KEEP", "lost_own", "OTHER", "penalty_for", "KEEP", "penalty_against", "OTHER")));
    private static final EventType LINEOUT = type("LINEOUT", "Line-out", Actor.ATTACKING, null,
            select("lineResult", Map.of("won_clean", "KEEP", "lost", "OTHER", "penalty_for", "KEEP", "penalty_against", "OTHER")));

    private static Event event(EventType type, EventPossession team, Map<String, Object> attributes) {
        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setEventType(type);
        event.setTeamPossession(team);
        event.setAttributes(attributes);
        event.setActive(true);
        event.setPeriod(1);
        return event;
    }

    private static Event event(EventType type, EventPossession team) {
        return event(type, team, Map.of());
    }

    private static Event timed(EventType type, EventPossession team, int period, int seconds) {
        Event event = event(type, team);
        event.setPeriod(period);
        event.setMatchTime(seconds);
        return event;
    }

    private static PeriodStatisticDTO run(PeriodStatisticStrategy strategy, List<Event> events) {
        PeriodStatisticDTO.Builder builder = PeriodStatisticDTO.builder();
        strategy.calculate(events, builder);
        return builder.build();
    }

    @Nested
    @DisplayName("ScoreStatisticStrategy")
    class ScoreStrategyTests {
        private final ScoreStatisticStrategy strategy = new ScoreStatisticStrategy();

        @Test
        @DisplayName("Suma los puntos del catálogo de todos los tipos que puntúan, con los nombres reales")
        void scoresEveryScoringType() {
            PeriodStatisticDTO dto = run(strategy, List.of(
                    event(TRY, OWN),
                    event(CONVERSION, OWN, Map.of("wasSuccessful", true)),
                    event(PENALTY_KICK, OWN, Map.of("wasSuccessful", true)),
                    event(DROP_GOAL, OWN, Map.of("wasSuccessful", true)),
                    event(PENALTY_TRY, OPP),
                    event(PENALTY_KICK, OPP, Map.of("wasSuccessful", true))));

            assertEquals(13, dto.ownScore());
            assertEquals(1, dto.ownTries());
            assertEquals(1, dto.ownConversions());
            assertEquals(1, dto.ownPenalties());
            assertEquals(1, dto.ownDropGoals());

            assertEquals(10, dto.opponentScore());
            assertEquals(1, dto.opponentTries());
            assertEquals(1, dto.opponentPenalties());
        }

        @Test
        @DisplayName("Un pateo errado no suma ni cuenta como convertido")
        void missedKicksDoNotScore() {
            PeriodStatisticDTO dto = run(strategy, List.of(
                    event(CONVERSION, OWN, Map.of("wasSuccessful", false)),
                    event(PENALTY_KICK, OWN, Map.of("wasSuccessful", false)),
                    event(DROP_GOAL, OPP, Map.of("wasSuccessful", false))));

            assertEquals(0, dto.ownScore());
            assertEquals(0, dto.ownConversions());
            assertEquals(0, dto.ownPenalties());
            assertEquals(0, dto.opponentScore());
            assertEquals(0, dto.opponentDropGoals());
        }

        @Test
        @DisplayName("Un try NEUTRAL sin jugador no suma a nadie; con jugador es propio (misma regla que el marcador)")
        void neutralScoringFollowsScoreboardRule() {
            Event withPlayer = event(TRY, NEUTRAL);
            withPlayer.setPlayer(new com.ovaltrack.backend.person.domain.Person());

            PeriodStatisticDTO dto = run(strategy, List.of(event(TRY, NEUTRAL), withPlayer));

            assertEquals(5, dto.ownScore());
            assertEquals(1, dto.ownTries());
            assertEquals(0, dto.opponentScore());
        }
    }

    @Nested
    @DisplayName("TackleStatisticStrategy")
    class TackleStrategyTests {
        private final TackleStatisticStrategy strategy = new TackleStatisticStrategy();

        @Test
        @DisplayName("Calcula efectividad defensiva con porcentaje redondeado")
        void shouldCalculateTackleEffectiveness() {
            PeriodStatisticDTO dto = run(strategy, List.of(
                    event(TACKLE_MADE, OWN), event(TACKLE_MADE, OWN), event(TACKLE_MADE, OWN),
                    event(TACKLE_MISSED, OWN), event(TACKLE_MADE, OPP)));

            assertEquals(3, dto.ownTacklesCompleted());
            assertEquals(1, dto.ownTacklesMissed());
            assertEquals(75.0, dto.ownTackleEffectiveness());
        }

        @Test
        @DisplayName("Efectividad es 0.0 cuando no hay tackles registrados")
        void shouldReturnZeroEffectivenessWhenNoTackles() {
            PeriodStatisticDTO dto = run(strategy, List.of());

            assertEquals(0, dto.ownTacklesCompleted());
            assertEquals(0, dto.ownTacklesMissed());
            assertEquals(0.0, dto.ownTackleEffectiveness());
        }
    }

    @Nested
    @DisplayName("TurnoverStatisticStrategy")
    class TurnoverStrategyTests {
        private final TurnoverStatisticStrategy strategy = new TurnoverStatisticStrategy();

        @Test
        @DisplayName("El turnover que gana el rival es uno perdido; los NEUTRAL no cuentan")
        void shouldCalculateTurnovers() {
            PeriodStatisticDTO dto = run(strategy, List.of(
                    event(TURNOVER_WON, OWN), event(TURNOVER_WON, OWN),
                    event(TURNOVER_WON, OPP), event(TURNOVER_WON, NEUTRAL)));

            assertEquals(2, dto.ownTurnoversWon());
            assertEquals(1, dto.ownTurnoversLost());
        }
    }

    @Nested
    @DisplayName("DisciplineStatisticStrategy")
    class DisciplineStrategyTests {
        private final DisciplineStatisticStrategy strategy = new DisciplineStatisticStrategy();

        @Test
        @DisplayName("Calcula penales concedidos, amarillas y rojas con los nombres reales del catálogo")
        void shouldCalculateDiscipline() {
            PeriodStatisticDTO dto = run(strategy, List.of(
                    event(PENALTY_CONCEDED, OWN),
                    event(YELLOW_CARD, OWN),
                    event(PENALTY_CONCEDED, OPP),
                    event(PENALTY_CONCEDED, OPP),
                    event(RED_CARD, OPP),
                    event(PENALTY_CONCEDED, NEUTRAL)));

            assertEquals(1, dto.ownPenaltiesConceded());
            assertEquals(1, dto.ownYellowCards());
            assertEquals(0, dto.ownRedCards());

            assertEquals(2, dto.opponentPenaltiesConceded());
            assertEquals(0, dto.opponentYellowCards());
            assertEquals(1, dto.opponentRedCards());
        }
    }

    @Nested
    @DisplayName("SetPieceStatisticStrategy")
    class SetPieceStrategyTests {
        private final SetPieceStatisticStrategy strategy = new SetPieceStatisticStrategy();

        @Test
        @DisplayName("Cuenta scrums y line-outs y, sobre el saque propio, ganados y perdidos")
        void shouldCalculateSetPieces() {
            PeriodStatisticDTO dto = run(strategy, List.of(
                    event(SCRUM, OWN, Map.of("scrumResult", "won_clean")),
                    event(SCRUM, OWN, Map.of("scrumResult", "penalty_against")),
                    event(SCRUM, OPP, Map.of("scrumResult", "won_clean")),
                    event(LINEOUT, OWN, Map.of("lineResult", "penalty_for")),
                    event(LINEOUT, OWN)));

            assertEquals(3, dto.scrumsTotal());
            assertEquals(2, dto.lineoutsTotal());
            assertEquals(1, dto.ownScrumsWon());
            assertEquals(1, dto.ownScrumsLost());
            assertEquals(1, dto.ownLineoutsWon());
            assertEquals(0, dto.ownLineoutsLost());
        }
    }

    @Nested
    @DisplayName("PossessionStatisticStrategy")
    class PossessionStrategyTests {
        private final PossessionStatisticStrategy strategy = new PossessionStatisticStrategy();

        @Test
        @DisplayName("Posesión por tiempo de juego: cada evento acredita el tiempo desde el anterior")
        void possessionByGameTime() {
            PeriodStatisticDTO dto = run(strategy, List.of(
                    timed(CARRY, OWN, 1, 300),
                    timed(CARRY, OPP, 1, 400),
                    // El analista elige el equipo: no informa la posesión.
                    timed(PENALTY_CONCEDED, OPP, 1, 500),
                    timed(CARRY, OWN, 1, 600)));

            // Propio: 300 + 200 = 500; rival: 100.
            assertEquals(83.3, dto.ownPossessionPercentage());
        }

        @Test
        @DisplayName("El segundo tiempo cuenta desde el minuto 40, no desde cero")
        void secondHalfStartsAtFortyMinutes() {
            PeriodStatisticDTO dto = run(strategy, List.of(
                    timed(CARRY, OPP, 2, 2700),
                    timed(CARRY, OWN, 2, 3000)));

            // Rival: 2700 - 2400 = 300; propio: 300.
            assertEquals(50.0, dto.ownPossessionPercentage());
        }

        @Test
        @DisplayName("Posesión por defecto es 50.0% cuando no hay eventos")
        void shouldDefaultToFiftyPercentWhenNoEvents() {
            assertEquals(50.0, run(strategy, List.of()).ownPossessionPercentage());
        }
    }
}
