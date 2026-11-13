package com.ovaltrack.backend.event.domain.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.zone.domain.ZoneRule;

@DisplayName("EventDTOMapper: la regla de zona viaja en el tipo de evento")
class EventDTOMapperZoneRuleTest {

    @Test
    @DisplayName("Expone la regla de zona del catálogo")
    void shouldExposeZoneRule() {
        EventType type = new EventType();
        type.setName("Try");
        ZoneRule rule = new ZoneRule(List.of(6), null, "zone");
        type.setZoneRule(rule);

        assertEquals(rule, EventDTOMapper.toResponseDTO(type).zoneRule());
    }

    @Test
    @DisplayName("Un tipo sin regla se expone con zoneRule null")
    void shouldExposeNullWhenTypeHasNoRule() {
        EventType type = new EventType();
        type.setName("Tackle completado");

        assertNull(EventDTOMapper.toResponseDTO(type).zoneRule());
    }
}
