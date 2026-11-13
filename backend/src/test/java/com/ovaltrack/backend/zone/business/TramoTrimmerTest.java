package com.ovaltrack.backend.zone.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.domain.TemplateField;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneRule;
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("TramoTrimmer: el tanteo acorta el tramo que lo contiene y lo que sigue queda como hueco")
class TramoTrimmerTest {

    private static final ZoneRule TRY = new ZoneRule(List.of(6), null, "zone", true);
    private static final ZoneRule SCRUM = new ZoneRule(List.of(2, 3, 4, 5), null, null);
    private static final TemplateField RESULT = new TemplateField("wasSuccessful", "Resultado", "boolean", "live", true,
            null, null, null, null, List.of("scoring"), "Convertido", "Errado");

    @Mock private ZoneAssignmentRepository zoneAssignmentRepository;

    private TramoTrimmer trimmer;
    private Match match;

    @BeforeEach
    void setUp() {
        trimmer = new TramoTrimmer(new EventZoneResolver(), zoneAssignmentRepository);
        match = new Match();
        match.setId(UUID.randomUUID());
    }

    private Event event(ZoneRule rule, boolean scoring, List<TemplateField> fields, Map<String, Object> attributes, int period, int seconds) {
        EventType type = new EventType();
        type.setId(UUID.randomUUID());
        type.setName("Tipo");
        type.setZoneRule(rule);
        type.setIsScoring(scoring);
        type.setTemplateEventFields(fields);
        Event event = new Event();
        event.setMatch(match);
        event.setEventType(type);
        event.setPeriod(period);
        event.setMatchTime(seconds);
        event.setTeamPossession(EventPossession.OWN);
        event.setAttributes(attributes);
        return event;
    }

    private Event tryAt(int period, int seconds) {
        return event(TRY, true, List.of(), Map.of("zone", "right"), period, seconds);
    }

    private ZoneAssignment tramo(int period, int startMinute, int endMinute) {
        ZoneAssignment zone = new ZoneAssignment();
        zone.setId(UUID.randomUUID());
        zone.setMatch(match);
        zone.setPeriod(period);
        zone.setStartMinute(startMinute);
        zone.setEndMinute(endMinute);
        zone.setRow(2);
        zone.setCol(5);
        return zone;
    }

    private void stubTramos(ZoneAssignment... tramos) {
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(match.getId())).thenReturn(List.of(tramos));
    }

    @Test
    @DisplayName("Un try dentro del tramo lo termina en su minuto y guarda el cambio")
    void shouldEndTramoOnTheTryMinute() {
        ZoneAssignment tramo = tramo(1, 20, 25);
        stubTramos(tramo);

        trimmer.trimAt(tryAt(1, 22 * 60 + 30));

        assertEquals(23, tramo.getEndMinute());
        assertEquals(20, tramo.getStartMinute());
        verify(zoneAssignmentRepository).save(tramo);
    }

    @Test
    @DisplayName("Solo acorta el tramo que contiene el tanteo, no los vecinos")
    void shouldOnlyTrimTheContainingTramo() {
        ZoneAssignment before = tramo(1, 10, 20);
        ZoneAssignment containing = tramo(1, 20, 25);
        ZoneAssignment after = tramo(1, 25, 30);
        stubTramos(before, containing, after);

        trimmer.trimAt(tryAt(1, 22 * 60 + 30));

        assertEquals(20, before.getEndMinute());
        assertEquals(23, containing.getEndMinute());
        assertEquals(30, after.getEndMinute());
        verify(zoneAssignmentRepository, never()).save(before);
        verify(zoneAssignmentRepository, never()).save(after);
    }

    @Test
    @DisplayName("Un try en el primer minuto del tramo lo deja de un minuto")
    void shouldLeaveOneMinuteWhenTryIsInTheFirstMinute() {
        ZoneAssignment tramo = tramo(1, 20, 25);
        stubTramos(tramo);

        trimmer.trimAt(tryAt(1, 20 * 60 + 10));

        assertEquals(21, tramo.getEndMinute());
    }

    @Test
    @DisplayName("Un try del segundo tiempo usa el tiempo acumulado")
    void shouldUseAccumulatedTimeInSecondHalf() {
        ZoneAssignment tramo = tramo(2, 60, 70);
        stubTramos(tramo);

        trimmer.trimAt(tryAt(2, 65 * 60 + 30));

        assertEquals(66, tramo.getEndMinute());
    }

    @Test
    @DisplayName("Un tramo que ya termina en el corte no se toca ni se guarda")
    void shouldNotTouchTramoThatAlreadyEndsOnTheCut() {
        ZoneAssignment tramo = tramo(1, 20, 23);
        stubTramos(tramo);

        trimmer.trimAt(tryAt(1, 22 * 60 + 30));

        assertEquals(23, tramo.getEndMinute());
        verify(zoneAssignmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Un try del tiempo añadido corta en el 40 y deja intacto un tramo que ya termina ahí")
    void shouldTreatAddedTimeAsLastMinute() {
        ZoneAssignment tramo = tramo(1, 35, 40);
        stubTramos(tramo);

        trimmer.trimAt(tryAt(1, 43 * 60));

        assertEquals(40, tramo.getEndMinute());
        verify(zoneAssignmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Un try en un hueco, sin ningún tramo que lo contenga, no hace nada")
    void shouldDoNothingInAGap() {
        ZoneAssignment tramo = tramo(1, 30, 35);
        stubTramos(tramo);

        trimmer.trimAt(tryAt(1, 22 * 60));

        assertEquals(35, tramo.getEndMinute());
        verify(zoneAssignmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Un Kick H convertido acorta el tramo")
    void shouldTrimWithConvertedKick() {
        ZoneAssignment tramo = tramo(1, 20, 25);
        stubTramos(tramo);

        trimmer.trimAt(event(new ZoneRule(List.of(2, 3, 4, 5), null, "zone", true), true, List.of(RESULT),
                Map.of("wasSuccessful", true), 1, 22 * 60));

        assertEquals(23, tramo.getEndMinute());
    }

    @Test
    @DisplayName("Un Kick H errado no acorta el tramo ni consulta los tramos")
    void shouldNotTrimWithMissedKick() {
        trimmer.trimAt(event(new ZoneRule(List.of(2, 3, 4, 5), null, "zone", true), true, List.of(RESULT),
                Map.of("wasSuccessful", false), 1, 22 * 60));

        verifyNoInteractions(zoneAssignmentRepository);
    }

    @Test
    @DisplayName("Un evento que no corta (Scrum) no consulta los tramos")
    void shouldNotQueryTramosForEventsThatDoNotCut() {
        trimmer.trimAt(event(SCRUM, false, List.of(), Map.of(), 1, 22 * 60));

        verifyNoInteractions(zoneAssignmentRepository);
    }

    @Test
    @DisplayName("Un tanteo sin período o sin tiempo no se puede ubicar y no hace nada")
    void shouldDoNothingWithoutTiming() {
        Event untimed = tryAt(1, 0);
        untimed.setPeriod(null);
        untimed.setMatchTime(null);
        stubTramos(tramo(1, 0, 40));

        trimmer.trimAt(untimed);

        verify(zoneAssignmentRepository, never()).save(any());
    }
}
