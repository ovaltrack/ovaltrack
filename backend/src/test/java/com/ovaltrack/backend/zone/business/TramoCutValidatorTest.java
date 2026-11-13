package com.ovaltrack.backend.zone.business;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.domain.TemplateField;
import com.ovaltrack.backend.zone.domain.ZoneRule;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentCreationDTO;

@DisplayName("TramoCutValidator: después de un tanteo que reinicia el juego el tramo termina")
class TramoCutValidatorTest {

    private static final ZoneRule TRY = new ZoneRule(List.of(6), null, "zone", true);
    private static final ZoneRule PENALTY_KICK = new ZoneRule(List.of(2, 3, 4, 5), null, "zone", true);
    private static final ZoneRule SCRUM = new ZoneRule(List.of(2, 3, 4, 5), null, null);
    private static final TemplateField RESULT = new TemplateField("wasSuccessful", "Resultado", "boolean", "live", true,
            null, null, null, null, List.of("scoring"), "Convertido", "Errado");

    private final TramoCutValidator validator = new TramoCutValidator(new EventZoneResolver());

    private Event event(String typeName, ZoneRule rule, int period, int seconds) {
        EventType type = new EventType();
        type.setId(UUID.randomUUID());
        type.setName(typeName);
        type.setZoneRule(rule);
        type.setIsScoring(rule != null && rule.cutsTramo());
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

    private Event tryAt(int period, int seconds) {
        return event("Try", TRY, period, seconds);
    }

    private Event kickAt(boolean successful) {
        Event kick = event("Kick H", PENALTY_KICK, 1, 22 * 60 + 30);
        kick.getEventType().setTemplateEventFields(List.of(RESULT));
        kick.setAttributes(Map.of("wasSuccessful", successful));
        return kick;
    }

    private ZoneAssignmentCreationDTO tramo(int period, int startMinute, int endMinute) {
        return new ZoneAssignmentCreationDTO(2, 5, period, startMinute, endMinute);
    }

    private BusinessException rejection(ZoneAssignmentCreationDTO request, List<Event> events) {
        return assertThrows(BusinessException.class, () -> validator.validateAssignment(request, events));
    }

    @Test
    @DisplayName("Rechaza un tramo que sigue después del try, con el mensaje completo")
    void shouldRejectTramoContinuingAfterTry() {
        BusinessException error = rejection(tramo(1, 20, 25), List.of(tryAt(1, 22 * 60 + 30)));

        assertEquals("El tramo 1T 20'–25' no puede seguir después del Try (1T 22:30): terminalo en 23'", error.getMessage());
    }

    @Test
    @DisplayName("El mensaje del segundo tiempo usa el tiempo acumulado y el nombre del tipo")
    void shouldDescribeSecondHalf() {
        Event kick = event("Kick H (Penal a palos)", PENALTY_KICK, 2, 65 * 60);

        BusinessException error = rejection(tramo(2, 60, 70), List.of(kick));

        assertEquals("El tramo 2T 60'–70' no puede seguir después del Kick H (Penal a palos) (2T 65:00): terminalo en 66'",
                error.getMessage());
    }

    @ParameterizedTest(name = "tramo {0}′–{1}′")
    @CsvSource({"20,23", "22,23", "23,30", "10,22"})
    @DisplayName("Acepta un tramo que termina en el minuto del try o que no lo contiene")
    void shouldAcceptTramoEndingInTryMinuteOrNotContainingIt(int start, int end) {
        assertDoesNotThrow(() -> validator.validateAssignment(tramo(1, start, end), List.of(tryAt(1, 22 * 60 + 30))));
    }

    @Test
    @DisplayName("El try del rival también cierra el tramo")
    void shouldCutWithOpponentTry() {
        Event opponentTry = tryAt(1, 22 * 60 + 30);
        opponentTry.setTeamPossession(EventPossession.OPPONENT);

        rejection(tramo(1, 20, 25), List.of(opponentTry));
    }

    @Test
    @DisplayName("Un try del tiempo añadido cierra el tramo que termina en el 40")
    void shouldTreatAddedTimeAsLastMinute() {
        assertDoesNotThrow(() -> validator.validateAssignment(tramo(1, 35, 40), List.of(tryAt(1, 43 * 60))));
    }

    @Test
    @DisplayName("Con dos tries informa el primero en orden cronológico")
    void shouldReportEarliestCut() {
        BusinessException error = rejection(tramo(1, 20, 25), List.of(tryAt(1, 24 * 60), tryAt(1, 21 * 60)));

        assertEquals("El tramo 1T 20'–25' no puede seguir después del Try (1T 21:00): terminalo en 22'", error.getMessage());
    }

    @Test
    @DisplayName("Ignora los eventos dados de baja, los de otro tiempo y los tipos que no cierran el tramo")
    void shouldIgnoreInactiveOtherPeriodAndNonCuttingEvents() {
        Event inactive = tryAt(1, 22 * 60);
        inactive.setActive(false);
        Event otherPeriod = tryAt(2, 62 * 60);
        Event scrum = event("Scrum", SCRUM, 1, 22 * 60);
        Event tackle = event("Tackle completado", null, 1, 22 * 60);

        assertDoesNotThrow(() -> validator.validateAssignment(tramo(1, 20, 25), List.of(inactive, otherPeriod, scrum, tackle)));
    }

    @Test
    @DisplayName("Un Kick H convertido cierra el tramo")
    void shouldCutWithConvertedKick() {
        Event kick = kickAt(true);

        BusinessException error = rejection(tramo(1, 20, 25), List.of(kick));

        assertEquals("El tramo 1T 20'–25' no puede seguir después del Kick H (1T 22:30): terminalo en 23'", error.getMessage());
    }

    @Test
    @DisplayName("Un Kick H errado no cierra el tramo")
    void shouldNotCutWithMissedKick() {
        assertDoesNotThrow(() -> validator.validateAssignment(tramo(1, 20, 25), List.of(kickAt(false))));
    }

    @Test
    @DisplayName("Un evento sin tiempo no se puede ubicar y no corta")
    void shouldIgnoreEventsWithoutTiming() {
        Event untimed = tryAt(1, 0);
        untimed.setPeriod(null);
        untimed.setMatchTime(null);

        assertDoesNotThrow(() -> validator.validateAssignment(tramo(1, 0, 40), List.of(untimed)));
    }

    @Test
    @DisplayName("Sin eventos no hay nada que validar")
    void shouldAcceptWithoutEvents() {
        assertDoesNotThrow(() -> validator.validateAssignment(tramo(1, 0, 40), List.of()));
    }
}
