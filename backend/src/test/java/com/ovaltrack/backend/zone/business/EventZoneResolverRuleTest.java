package com.ovaltrack.backend.zone.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneCell;
import com.ovaltrack.backend.zone.domain.ZoneQuery;
import com.ovaltrack.backend.zone.domain.ZoneRule;

@DisplayName("EventZoneResolver con regla de zona: la regla del tipo y la perspectiva del equipo")
class EventZoneResolverRuleTest {

    private static final ZoneRule TRY = new ZoneRule(List.of(6), null, "zone");
    private static final ZoneRule FIELD_PLAY = new ZoneRule(List.of(2, 3, 4, 5), null, null);
    private static final ZoneRule OWN_HALF = new ZoneRule(List.of(1, 2), null, null);

    private final EventZoneResolver resolver = new EventZoneResolver();

    private ZoneAssignment assignment(int period, int startMinute, int endMinute, int row, int col) {
        ZoneAssignment zone = new ZoneAssignment();
        zone.setPeriod(period);
        zone.setStartMinute(startMinute);
        zone.setEndMinute(endMinute);
        zone.setRow(row);
        zone.setCol(col);
        return zone;
    }

    private ZoneQuery query(ZoneRule rule, EventPossession possession, Map<String, Object> attributes, int period, int minute) {
        return new ZoneQuery(rule, possession, attributes, period, minute * 60);
    }

    @Nested
    @DisplayName("Sin regla se comporta como antes")
    class WithoutRule {

        @Test
        @DisplayName("Devuelve la celda del tramo")
        void shouldResolveFromAssignment() {
            Optional<ZoneCell> cell = resolver.resolve(
                    query(null, EventPossession.OWN, Map.of(), 1, 15), List.of(assignment(1, 10, 25, 2, 3)));

            assertEquals(Optional.of(new ZoneCell(2, 3)), cell);
        }

        @Test
        @DisplayName("El rival no se espeja si el tipo no tiene regla")
        void shouldNotMirrorWithoutRule() {
            Optional<ZoneCell> cell = resolver.resolve(
                    query(null, EventPossession.OPPONENT, Map.of(), 1, 15), List.of(assignment(1, 10, 25, 2, 3)));

            assertEquals(Optional.of(new ZoneCell(2, 3)), cell);
        }

        @Test
        @DisplayName("Fuera de todo tramo queda sin zona")
        void shouldReturnEmptyOutsideAssignments() {
            assertTrue(resolver.resolve(query(null, EventPossession.OWN, Map.of(), 1, 30),
                    List.of(assignment(1, 10, 25, 2, 3))).isEmpty());
        }
    }

    @Nested
    @DisplayName("Zona fija")
    class FixedZone {

        @Test
        @DisplayName("Un try propio queda en el lado del apoyo aunque el tramo diga otra cosa")
        void shouldIgnoreAssignmentCell() {
            Optional<ZoneCell> cell = resolver.resolve(
                    query(TRY, EventPossession.OWN, Map.of("zone", "right"), 1, 22), List.of(assignment(1, 20, 25, 2, 5)));

            assertEquals(Optional.of(new ZoneCell(3, 6)), cell);
        }

        @Test
        @DisplayName("Queda en su zona aunque no haya ningún tramo en ese minuto")
        void shouldResolveWithoutAssignments() {
            assertEquals(Optional.of(new ZoneCell(1, 6)),
                    resolver.resolve(query(TRY, EventPossession.OWN, Map.of("zone", "left"), 1, 30), List.of()));
        }

        @Test
        @DisplayName("Un try del rival se espeja: queda en el in-goal propio y el lado se lee desde su ataque")
        void shouldMirrorOpponentEvents() {
            Optional<ZoneCell> cell = resolver.resolve(
                    query(TRY, EventPossession.OPPONENT, Map.of("zone", "left"), 1, 22), List.of(assignment(1, 20, 25, 2, 5)));

            assertEquals(Optional.of(new ZoneCell(3, 1)), cell);
        }

        @Test
        @DisplayName("El tiempo añadido no cambia la zona fija")
        void shouldResolveInAddedTime() {
            assertEquals(Optional.of(new ZoneCell(2, 6)),
                    resolver.resolve(query(TRY, EventPossession.OWN, Map.of("zone", "center"), 1, 43), List.of()));
        }
    }

    @Nested
    @DisplayName("Celda del tramo filtrada por la regla")
    class AllowedCells {

        @Test
        @DisplayName("Una celda permitida se conserva")
        void shouldKeepAllowedCell() {
            assertEquals(Optional.of(new ZoneCell(2, 4)),
                    resolver.resolve(query(FIELD_PLAY, EventPossession.OWN, Map.of(), 1, 22), List.of(assignment(1, 20, 25, 2, 4))));
        }

        @Test
        @DisplayName("Una celda prohibida no se devuelve: el evento queda sin zona")
        void shouldReturnEmptyForProhibitedCell() {
            assertTrue(resolver.resolve(query(FIELD_PLAY, EventPossession.OWN, Map.of(), 1, 22),
                    List.of(assignment(1, 20, 25, 2, 6))).isEmpty());
        }

        @Test
        @DisplayName("La regla se evalúa desde el equipo que ejecuta: la misma celda es válida para uno y prohibida para el otro")
        void shouldEvaluateRuleFromTheExecutingTeam() {
            List<ZoneAssignment> assignments = List.of(assignment(1, 20, 25, 2, 6));

            assertTrue(resolver.resolve(query(OWN_HALF, EventPossession.OWN, Map.of(), 1, 22), assignments).isEmpty());
            assertEquals(Optional.of(new ZoneCell(2, 6)),
                    resolver.resolve(query(OWN_HALF, EventPossession.OPPONENT, Map.of(), 1, 22), assignments));
        }

        @Test
        @DisplayName("La posesión neutral no se espeja")
        void shouldNotMirrorNeutralEvents() {
            assertTrue(resolver.resolve(query(OWN_HALF, EventPossession.NEUTRAL, Map.of(), 1, 22),
                    List.of(assignment(1, 20, 25, 2, 6))).isEmpty());
        }

        @Test
        @DisplayName("Usa el último segundo del tiempo para el tiempo añadido")
        void shouldClampAddedTimeBeforeLookingForAssignment() {
            assertEquals(Optional.of(new ZoneCell(2, 4)),
                    resolver.resolve(query(FIELD_PLAY, EventPossession.OWN, Map.of(), 1, 43), List.of(assignment(1, 31, 40, 2, 4))));
        }

        @Test
        @DisplayName("Sin período o sin tiempo no se puede ubicar")
        void shouldReturnEmptyWithoutTiming() {
            assertTrue(resolver.resolve(new ZoneQuery(TRY, EventPossession.OWN, Map.of("zone", "left"), null, null), List.of()).isEmpty());
        }
    }
}
