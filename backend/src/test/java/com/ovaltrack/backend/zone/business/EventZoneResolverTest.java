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

@DisplayName("EventZoneResolver: deriva la zona de un evento a partir de su minuto")
class EventZoneResolverTest {

    private final EventZoneResolver resolver = new EventZoneResolver();

    private Optional<ZoneCell> resolveAt(Integer period, Integer matchTimeSeconds, List<ZoneAssignment> zones) {
        return resolver.resolve(new ZoneQuery(null, EventPossession.OWN, Map.of(), period, matchTimeSeconds), zones);
    }

    private ZoneAssignment assignment(int period, int startMinute, int endMinute, int row, int col) {
        ZoneAssignment zone = new ZoneAssignment();
        zone.setPeriod(period);
        zone.setStartMinute(startMinute);
        zone.setEndMinute(endMinute);
        zone.setRow(row);
        zone.setCol(col);
        return zone;
    }

    @Test
    @DisplayName("Devuelve la celda del período que contiene al evento")
    void shouldResolveCellWhenEventIsInsideRange() {
        List<ZoneAssignment> zones = List.of(assignment(1, 10, 25, 2, 3));

        Optional<ZoneCell> cell = resolveAt(1, 15 * 60, zones);

        assertEquals(Optional.of(new ZoneCell(2, 3)), cell);
    }

    @Test
    @DisplayName("El inicio del rango es inclusivo")
    void shouldIncludeStartBoundary() {
        List<ZoneAssignment> zones = List.of(assignment(1, 10, 25, 2, 3));

        assertEquals(Optional.of(new ZoneCell(2, 3)), resolveAt(1, 10 * 60, zones));
    }

    @Test
    @DisplayName("El fin del rango es exclusivo: el límite pertenece al período siguiente")
    void shouldExcludeEndBoundaryAndUseNextRange() {
        List<ZoneAssignment> zones = List.of(
                assignment(1, 10, 25, 1, 1),
                assignment(1, 25, 40, 3, 6));

        assertEquals(Optional.of(new ZoneCell(3, 6)), resolveAt(1, 25 * 60, zones));
    }

    @Test
    @DisplayName("Un evento fuera de todo rango queda sin zona")
    void shouldReturnEmptyWhenNoRangeCoversTheEvent() {
        List<ZoneAssignment> zones = List.of(assignment(1, 10, 25, 2, 3));

        assertTrue(resolveAt(1, 30 * 60, zones).isEmpty());
    }

    @Test
    @DisplayName("Sin asignaciones, todo evento queda sin zona")
    void shouldReturnEmptyWhenThereAreNoAssignments() {
        assertTrue(resolveAt(1, 15 * 60, List.of()).isEmpty());
    }

    @Test
    @DisplayName("No cruza períodos: una asignación del 1T no aplica a un evento del 2T")
    void shouldNotMatchAcrossPeriods() {
        List<ZoneAssignment> zones = List.of(assignment(1, 0, 40, 1, 1));

        assertTrue(resolveAt(2, 50 * 60, zones).isEmpty());
    }

    @Test
    @DisplayName("Resuelve correctamente en el segundo tiempo con minutos acumulados")
    void shouldResolveInSecondHalfWithAccumulatedMinutes() {
        List<ZoneAssignment> zones = List.of(
                assignment(1, 0, 40, 1, 1),
                assignment(2, 40, 80, 3, 6));

        assertEquals(Optional.of(new ZoneCell(3, 6)), resolveAt(2, 50 * 60, zones));
    }

    @Test
    @DisplayName("Un matchTime nulo no puede resolverse y queda sin zona")
    void shouldReturnEmptyWhenMatchTimeIsNull() {
        List<ZoneAssignment> zones = List.of(assignment(1, 0, 40, 1, 1));

        assertTrue(resolveAt(1, null, zones).isEmpty());
    }

    @Nested
    @DisplayName("Tiempo añadido: cuenta como el minuto 40 (1T) y el minuto 80 (2T)")
    class AddedTime {

        @Test
        @DisplayName("H1. Un evento del 1T en el minuto 43 pertenece al tramo que termina en 40")
        void shouldCountFirstHalfAddedTimeInTheLastSegment() {
            List<ZoneAssignment> zones = List.of(assignment(1, 31, 40, 2, 4));

            assertEquals(Optional.of(new ZoneCell(2, 4)), resolveAt(1, 43 * 60, zones));
        }

        @Test
        @DisplayName("H2. Un evento del 1T en el minuto 40 exacto pertenece al tramo que termina en 40")
        void shouldCountMinuteFortyInTheSegmentEndingAtForty() {
            List<ZoneAssignment> zones = List.of(assignment(1, 31, 40, 2, 4));

            assertEquals(Optional.of(new ZoneCell(2, 4)), resolveAt(1, 40 * 60, zones));
        }

        @Test
        @DisplayName("H3. Un evento del 2T en el minuto 84 pertenece al tramo que termina en 80")
        void shouldCountSecondHalfAddedTimeInTheLastSegment() {
            List<ZoneAssignment> zones = List.of(assignment(2, 68, 80, 3, 5));

            assertEquals(Optional.of(new ZoneCell(3, 5)), resolveAt(2, 84 * 60, zones));
        }

        @Test
        @DisplayName("H4. Un evento del 1T en el minuto 39 sigue en el tramo que lo contiene")
        void shouldNotChangeEventsInsideRegularTime() {
            List<ZoneAssignment> zones = List.of(
                    assignment(1, 31, 40, 2, 4),
                    assignment(1, 0, 31, 1, 1));

            assertEquals(Optional.of(new ZoneCell(2, 4)), resolveAt(1, 39 * 60, zones));
        }

        @Test
        @DisplayName("H5. Un evento del 2T en el minuto 40 exacto pertenece al tramo del 2T que empieza en 40")
        void shouldLetThePeriodDecideAtMinuteForty() {
            List<ZoneAssignment> zones = List.of(
                    assignment(1, 31, 40, 2, 4),
                    assignment(2, 40, 55, 3, 6));

            assertEquals(Optional.of(new ZoneCell(3, 6)), resolveAt(2, 40 * 60, zones));
        }

        @Test
        @DisplayName("S1. Si el último tramo no llega a 40, el tiempo añadido queda sin zona")
        void shouldLeaveAddedTimeUnzonedWhenLastSegmentDoesNotReachTheEnd() {
            List<ZoneAssignment> zones = List.of(assignment(1, 31, 38, 2, 4));

            assertTrue(resolveAt(1, 43 * 60, zones).isEmpty());
        }

        @Test
        @DisplayName("S2. Sin tramos en el período, el tiempo añadido queda sin zona")
        void shouldLeaveAddedTimeUnzonedWhenThePeriodHasNoSegments() {
            List<ZoneAssignment> zones = List.of(assignment(2, 40, 80, 1, 1));

            assertTrue(resolveAt(1, 43 * 60, zones).isEmpty());
        }

        @Test
        @DisplayName("S3. Un minuto negativo o un período inválido queda sin zona sin lanzar excepción")
        void shouldReturnEmptyForOutOfRangeValues() {
            List<ZoneAssignment> zones = List.of(assignment(1, 0, 40, 1, 1), assignment(2, 40, 80, 1, 1));

            assertTrue(resolveAt(1, -60, zones).isEmpty());
            assertTrue(resolveAt(3, 43 * 60, zones).isEmpty());
        }

        @Test
        @DisplayName("S5. Un evento del 1T en el minuto 43 nunca cae en un tramo del 2T")
        void shouldNeverSpillFirstHalfAddedTimeIntoTheSecondHalf() {
            List<ZoneAssignment> zones = List.of(assignment(2, 40, 80, 3, 6));

            assertTrue(resolveAt(1, 43 * 60, zones).isEmpty());
        }
    }
}
