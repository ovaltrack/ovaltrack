package com.ovaltrack.backend.zone.business;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneRule;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentCreationDTO;

@DisplayName("EventZoneRuleValidator: una jugada no queda en una celda que su tipo prohíbe")
class EventZoneRuleValidatorTest {

    private static final ZoneRule FIELD_PLAY = new ZoneRule(List.of(2, 3, 4, 5), null, null);
    private static final ZoneRule TRY = new ZoneRule(List.of(6), null, "zone");
    private static final ZoneRule OWN_HALF = new ZoneRule(List.of(1, 2), null, null);

    private final EventZoneRuleValidator validator = new EventZoneRuleValidator(new EventZoneResolver());

    private Event event(String typeName, ZoneRule rule, int period, int seconds) {
        EventType type = new EventType();
        type.setId(UUID.randomUUID());
        type.setName(typeName);
        type.setZoneRule(rule);
        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setEventType(type);
        event.setPeriod(period);
        event.setMatchTime(seconds);
        event.setTeamPossession(EventPossession.OWN);
        event.setAttributes(Map.of());
        event.setActive(true);
        return event;
    }

    private Event scrum(int period, int seconds) {
        return event("Scrum", FIELD_PLAY, period, seconds);
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

    private BusinessException rejection(Runnable action) {
        return assertThrows(BusinessException.class, action::run);
    }

    @Nested
    @DisplayName("validateEvent")
    class ValidateEvent {

        @Test
        @DisplayName("Rechaza un evento que el tramo deja en una celda prohibida, con el mensaje completo")
        void shouldRejectProhibitedCell() {
            BusinessException error = rejection(() ->
                    validator.validateEvent(scrum(1, 22 * 60), List.of(assignment(1, 20, 25, 2, 6))));

            assertEquals("Scrum (1T 22:00) no puede quedar en C6 (tramo 1T 20'–25'): solo puede ocurrir en las columnas 2 a 5",
                    error.getMessage());
        }

        @Test
        @DisplayName("El mensaje del segundo tiempo usa el tiempo acumulado y la fila de la celda")
        void shouldDescribeSecondHalf() {
            Event lineout = event("Line-out", FIELD_PLAY, 2, 65 * 60);

            BusinessException error = rejection(() ->
                    validator.validateEvent(lineout, List.of(assignment(2, 60, 70, 3, 1))));

            assertEquals("Line-out (2T 65:00) no puede quedar en D1 (tramo 2T 60'–70'): solo puede ocurrir en las columnas 2 a 5",
                    error.getMessage());
        }

        @Test
        @DisplayName("Los segundos del evento se muestran en el mensaje")
        void shouldShowSeconds() {
            BusinessException error = rejection(() ->
                    validator.validateEvent(scrum(1, 22 * 60 + 30), List.of(assignment(1, 20, 25, 2, 6))));

            assertEquals("Scrum (1T 22:30) no puede quedar en C6 (tramo 1T 20'–25'): solo puede ocurrir en las columnas 2 a 5",
                    error.getMessage());
        }

        @Test
        @DisplayName("Acepta una celda permitida")
        void shouldAcceptAllowedCell() {
            assertDoesNotThrow(() -> validator.validateEvent(scrum(1, 22 * 60), List.of(assignment(1, 20, 25, 2, 4))));
        }

        @Test
        @DisplayName("Un hueco no es un error: sin tramo en su minuto el evento queda sin zona")
        void shouldAcceptEventOutsideAssignments() {
            assertDoesNotThrow(() -> validator.validateEvent(scrum(1, 30 * 60), List.of(assignment(1, 20, 25, 2, 6))));
            assertDoesNotThrow(() -> validator.validateEvent(scrum(1, 22 * 60), List.of()));
        }

        @Test
        @DisplayName("Un tramo de otro tiempo no cuenta")
        void shouldIgnoreAssignmentsOfAnotherPeriod() {
            assertDoesNotThrow(() -> validator.validateEvent(scrum(1, 55 * 60), List.of(assignment(2, 50, 60, 2, 6))));
        }

        @Test
        @DisplayName("Un tipo sin regla se acepta en cualquier celda")
        void shouldAcceptTypesWithoutRule() {
            assertDoesNotThrow(() -> validator.validateEvent(
                    event("Tackle completado", null, 1, 22 * 60), List.of(assignment(1, 20, 25, 2, 6))));
        }

        @Test
        @DisplayName("Una zona fija nunca da conflicto, sin importar el tramo")
        void shouldNeverConflictWithFixedZone() {
            Event tryEvent = event("Try", TRY, 1, 22 * 60);
            tryEvent.setAttributes(Map.of("zone", "right"));

            assertDoesNotThrow(() -> validator.validateEvent(tryEvent, List.of(assignment(1, 20, 25, 2, 1))));
        }

        @Test
        @DisplayName("La regla se evalúa desde el equipo que ejecuta el evento")
        void shouldEvaluateFromTheExecutingTeam() {
            Event own = event("Evento", OWN_HALF, 1, 22 * 60);
            Event opponent = event("Evento", OWN_HALF, 1, 22 * 60);
            opponent.setTeamPossession(EventPossession.OPPONENT);
            List<ZoneAssignment> assignments = List.of(assignment(1, 20, 25, 2, 6));

            rejection(() -> validator.validateEvent(own, assignments));
            assertDoesNotThrow(() -> validator.validateEvent(opponent, assignments));
        }

        @Test
        @DisplayName("Un evento sin tiempo no se puede ubicar y no se rechaza")
        void shouldAcceptEventWithoutTiming() {
            Event noTiming = scrum(1, 0);
            noTiming.setPeriod(null);
            noTiming.setMatchTime(null);

            assertDoesNotThrow(() -> validator.validateEvent(noTiming, List.of(assignment(1, 0, 40, 2, 6))));
        }
    }

    @Nested
    @DisplayName("validateAssignment")
    class ValidateAssignment {

        private final ZoneAssignmentCreationDTO inGoal = new ZoneAssignmentCreationDTO(2, 6, 1, 20, 25);

        @Test
        @DisplayName("Rechaza un tramo que deja un evento en una celda prohibida, con el mensaje completo")
        void shouldRejectAssignmentThatProhibitsAnEvent() {
            BusinessException error = rejection(() -> validator.validateAssignment(inGoal, List.of(scrum(1, 22 * 60))));

            assertEquals("Scrum (1T 22:00) no puede quedar en C6 (tramo 1T 20'–25'): solo puede ocurrir en las columnas 2 a 5",
                    error.getMessage());
        }

        @Test
        @DisplayName("El inicio del rango es inclusivo y el fin exclusivo")
        void shouldUseHalfOpenRange() {
            rejection(() -> validator.validateAssignment(inGoal, List.of(scrum(1, 20 * 60))));
            assertDoesNotThrow(() -> validator.validateAssignment(inGoal, List.of(scrum(1, 25 * 60))));
        }

        @Test
        @DisplayName("Los eventos de otro tiempo no cuentan")
        void shouldIgnoreEventsOfAnotherPeriod() {
            assertDoesNotThrow(() -> validator.validateAssignment(inGoal, List.of(scrum(2, 22 * 60))));
        }

        @Test
        @DisplayName("El tiempo añadido cuenta como el último minuto del tiempo")
        void shouldCountAddedTimeInTheLastMinute() {
            ZoneAssignmentCreationDTO lastMinutes = new ZoneAssignmentCreationDTO(2, 6, 1, 31, 40);

            rejection(() -> validator.validateAssignment(lastMinutes, List.of(scrum(1, 43 * 60))));
        }

        @Test
        @DisplayName("Informa el primer evento en conflicto en orden cronológico")
        void shouldReportEarliestConflict() {
            BusinessException error = rejection(() ->
                    validator.validateAssignment(inGoal, List.of(scrum(1, 24 * 60), scrum(1, 21 * 60))));

            assertEquals("Scrum (1T 21:00) no puede quedar en C6 (tramo 1T 20'–25'): solo puede ocurrir en las columnas 2 a 5",
                    error.getMessage());
        }

        @Test
        @DisplayName("Ignora los eventos dados de baja, los de tipo sin regla y los de zona fija")
        void shouldIgnoreInactiveUnrestrictedAndFixedEvents() {
            Event inactive = scrum(1, 22 * 60);
            inactive.setActive(false);
            Event tackle = event("Tackle completado", null, 1, 22 * 60);
            Event tryEvent = event("Try", TRY, 1, 22 * 60);
            tryEvent.setAttributes(Map.of("zone", "left"));

            assertDoesNotThrow(() -> validator.validateAssignment(inGoal, List.of(inactive, tackle, tryEvent)));
        }

        @Test
        @DisplayName("Un tramo en una celda permitida se acepta aunque contenga eventos restringidos")
        void shouldAcceptAllowedCellWithRestrictedEvents() {
            ZoneAssignmentCreationDTO fieldPlay = new ZoneAssignmentCreationDTO(2, 4, 1, 20, 25);

            assertDoesNotThrow(() -> validator.validateAssignment(fieldPlay, List.of(scrum(1, 22 * 60))));
        }

        @Test
        @DisplayName("Sin eventos no hay nada que validar")
        void shouldAcceptWithoutEvents() {
            assertDoesNotThrow(() -> validator.validateAssignment(inGoal, List.of()));
        }
    }
}
