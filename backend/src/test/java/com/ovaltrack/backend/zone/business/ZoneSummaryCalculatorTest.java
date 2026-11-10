package com.ovaltrack.backend.zone.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneRule;
import com.ovaltrack.backend.zone.domain.dto.ZoneSummaryDTO;
import com.ovaltrack.backend.zone.domain.dto.ZoneSummaryDTO.ZoneCellCountDTO;

@DisplayName("ZoneSummaryCalculator: conteo de eventos por celda")
class ZoneSummaryCalculatorTest {

    private final ZoneSummaryCalculator calculator = new ZoneSummaryCalculator(new EventZoneResolver());

    private Event event(int period, int minute) {
        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setPeriod(period);
        event.setMatchTime(minute * 60);
        event.setActive(true);
        return event;
    }

    private ZoneAssignment assignment(int period, int start, int end, int row, int col) {
        ZoneAssignment zone = new ZoneAssignment();
        zone.setPeriod(period);
        zone.setStartMinute(start);
        zone.setEndMinute(end);
        zone.setRow(row);
        zone.setCol(col);
        return zone;
    }

    @Test
    @DisplayName("Agrupa los eventos por celda y cuenta aparte los que quedan sin zona")
    void shouldCountEventsPerCellAndUnzoned() {
        List<Event> events = List.of(event(1, 12), event(1, 18), event(1, 35));
        List<ZoneAssignment> zones = List.of(assignment(1, 10, 25, 2, 3));

        ZoneSummaryDTO summary = calculator.calculate(events, zones);

        assertEquals(List.of(new ZoneCellCountDTO(2, 3, 2)), summary.cells());
        assertEquals(1, summary.unzonedEventCount());
    }

    @Test
    @DisplayName("Sin asignaciones todos los eventos quedan sin zona")
    void shouldReportEverythingUnzonedWithoutAssignments() {
        ZoneSummaryDTO summary = calculator.calculate(List.of(event(1, 5), event(2, 50)), List.of());

        assertTrue(summary.cells().isEmpty());
        assertEquals(2, summary.unzonedEventCount());
    }

    @Test
    @DisplayName("Sin eventos el resumen está vacío")
    void shouldReturnEmptySummaryWithoutEvents() {
        ZoneSummaryDTO summary = calculator.calculate(List.of(), List.of(assignment(1, 0, 40, 1, 1)));

        assertTrue(summary.cells().isEmpty());
        assertEquals(0, summary.unzonedEventCount());
    }

    @Test
    @DisplayName("Las celdas se devuelven ordenadas por fila y columna")
    void shouldSortCellsByRowThenCol() {
        List<ZoneAssignment> zones = List.of(assignment(1, 0, 20, 3, 1), assignment(1, 20, 40, 1, 6));

        ZoneSummaryDTO summary = calculator.calculate(List.of(event(1, 5), event(1, 30)), zones);

        assertEquals(List.of(new ZoneCellCountDTO(1, 6, 1), new ZoneCellCountDTO(3, 1, 1)), summary.cells());
    }

    @Test
    @DisplayName("El tiempo añadido cuenta en la celda del último tramo y no como sin zona")
    void shouldCountAddedTimeInTheLastSegmentOfThePeriod() {
        List<Event> events = List.of(event(1, 35), event(1, 43), event(2, 84));
        List<ZoneAssignment> zones = List.of(assignment(1, 31, 40, 2, 4), assignment(2, 68, 80, 3, 5));

        ZoneSummaryDTO summary = calculator.calculate(events, zones);

        assertEquals(List.of(new ZoneCellCountDTO(2, 4, 2), new ZoneCellCountDTO(3, 5, 1)), summary.cells());
        assertEquals(0, summary.unzonedEventCount());
    }

    // --- Regla de zona por tipo de evento ---

    private Event ruleEvent(ZoneRule rule, EventPossession possession, Map<String, Object> attributes, int period, int minute) {
        EventType type = new EventType();
        type.setId(UUID.randomUUID());
        type.setZoneRule(rule);
        Event event = event(period, minute);
        event.setEventType(type);
        event.setTeamPossession(possession);
        event.setAttributes(attributes);
        return event;
    }

    @Test
    @DisplayName("Un evento de zona fija cuenta en su celda, no en la del tramo ni como sin zona")
    void shouldCountFixedZoneEventsInTheirOwnCell() {
        Event tryEvent = ruleEvent(new ZoneRule(List.of(6), null, "zone"), EventPossession.OWN, Map.of("zone", "right"), 1, 12);
        Event tackle = event(1, 15);
        List<ZoneAssignment> zones = List.of(assignment(1, 10, 25, 2, 5));

        ZoneSummaryDTO summary = calculator.calculate(List.of(tryEvent, tackle), zones);

        assertEquals(List.of(new ZoneCellCountDTO(2, 5, 1), new ZoneCellCountDTO(3, 6, 1)), summary.cells());
        assertEquals(0, summary.unzonedEventCount());
    }

    @Test
    @DisplayName("Un evento de zona fija en un hueco entre tramos tampoco cuenta como sin zona")
    void shouldNotCountFixedZoneEventsAsUnzonedInGaps() {
        Event tryEvent = ruleEvent(new ZoneRule(List.of(6), null, "zone"), EventPossession.OWN, Map.of("zone", "center"), 1, 30);

        ZoneSummaryDTO summary = calculator.calculate(List.of(tryEvent), List.of(assignment(1, 0, 10, 2, 3)));

        assertEquals(List.of(new ZoneCellCountDTO(2, 6, 1)), summary.cells());
        assertEquals(0, summary.unzonedEventCount());
    }

    @Test
    @DisplayName("Un evento que el tramo deja en una celda prohibida cuenta como sin zona")
    void shouldCountProhibitedCellEventsAsUnzoned() {
        Event scrum = ruleEvent(new ZoneRule(List.of(2, 3, 4, 5), null, null), EventPossession.OWN, Map.of(), 1, 22);

        ZoneSummaryDTO summary = calculator.calculate(List.of(scrum), List.of(assignment(1, 20, 25, 2, 6)));

        assertTrue(summary.cells().isEmpty());
        assertEquals(1, summary.unzonedEventCount());
    }
}
