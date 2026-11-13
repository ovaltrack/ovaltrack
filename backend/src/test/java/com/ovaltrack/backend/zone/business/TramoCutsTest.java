package com.ovaltrack.backend.zone.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.domain.TemplateField;
import com.ovaltrack.backend.zone.domain.ZoneRule;

@DisplayName("TramoCuts: qué tanteos cortan el tramo y en qué minuto")
class TramoCutsTest {

    private static final ZoneRule CUTTING = new ZoneRule(List.of(2, 3, 4, 5), null, null, true);
    private static final ZoneRule NOT_CUTTING = new ZoneRule(List.of(2, 3, 4, 5), null, null);

    /** Campo "Resultado" del Kick H y el drop: si es falso, el tanteo no suma y el juego no se reinicia con un saque de centro. */
    private static final TemplateField RESULT = new TemplateField("wasSuccessful", "Resultado", "boolean", "live", true,
            null, null, null, null, List.of("scoring"), "Convertido", "Errado");

    private Event event(ZoneRule rule, boolean scoring, List<TemplateField> fields, Map<String, Object> attributes, int period, int seconds) {
        EventType type = new EventType();
        type.setId(UUID.randomUUID());
        type.setName("Tipo");
        type.setZoneRule(rule);
        type.setIsScoring(scoring);
        type.setTemplateEventFields(fields);
        Event event = new Event();
        event.setEventType(type);
        event.setPeriod(period);
        event.setMatchTime(seconds);
        event.setTeamPossession(EventPossession.OWN);
        event.setAttributes(attributes);
        return event;
    }

    private Event kickAt(Map<String, Object> attributes) {
        return event(CUTTING, true, List.of(RESULT), attributes, 1, 1350);
    }

    @Test
    @DisplayName("Un try corta siempre: no tiene campo de resultado")
    void shouldCutWithTry() {
        assertTrue(TramoCuts.closes(event(CUTTING, true, List.of(), Map.of("zone", "right"), 1, 1350)));
    }

    @Test
    @DisplayName("Un Kick H o un drop convertidos cortan")
    void shouldCutWithConvertedKick() {
        assertTrue(TramoCuts.closes(kickAt(Map.of("wasSuccessful", true))));
    }

    @Test
    @DisplayName("Un Kick H o un drop errados no cortan")
    void shouldNotCutWithMissedKick() {
        assertFalse(TramoCuts.closes(kickAt(Map.of("wasSuccessful", false))));
    }

    @Test
    @DisplayName("Un Kick H sin el resultado cargado todavía cuenta como convertido, igual que el marcador")
    void shouldCutWhenResultIsNotLoaded() {
        assertTrue(TramoCuts.closes(kickAt(Map.of())));
    }

    @Test
    @DisplayName("Un tipo con regla que no corta no cierra el tramo")
    void shouldNotCutWithRuleThatDoesNotCut() {
        assertFalse(TramoCuts.closes(event(NOT_CUTTING, true, List.of(), Map.of(), 1, 1350)));
    }

    @Test
    @DisplayName("Un tipo sin regla de zona no cierra el tramo")
    void shouldNotCutWithoutRule() {
        assertFalse(TramoCuts.closes(event(null, false, List.of(), Map.of(), 1, 1350)));
    }

    @Test
    @DisplayName("Un evento sin tipo no cierra el tramo")
    void shouldNotCutWithoutType() {
        assertFalse(TramoCuts.closes(new Event()));
    }

    @ParameterizedTest(name = "{0}T {1} s -> el tramo termina en el minuto {2}")
    @CsvSource({
            "1,0,1",
            "1,1350,23",
            "1,1379,23",
            "1,1380,24",
            "1,2399,40",
            "1,2580,40",
            "2,2400,41",
            "2,3930,66",
            "2,4860,80"
    })
    @DisplayName("El tramo termina en el minuto siguiente al del evento; el tiempo añadido cuenta como el último segundo del tiempo")
    void shouldEndOnTheMinuteAfterTheEvent(int period, int seconds, int expectedEnd) {
        assertEquals(expectedEnd, TramoCuts.endMinute(event(CUTTING, true, List.of(), Map.of(), period, seconds)));
    }
}
