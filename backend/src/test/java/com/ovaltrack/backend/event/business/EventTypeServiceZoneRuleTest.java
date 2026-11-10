package com.ovaltrack.backend.event.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.repository.EventTypeRepository;
import com.ovaltrack.backend.zone.domain.ZoneRule;

@ExtendWith(MockitoExtension.class)
@DisplayName("EventTypeService: reglas de zona del catálogo")
class EventTypeServiceZoneRuleTest {

    @Mock private EventTypeRepository eventTypeRepository;
    @InjectMocks private EventTypeService eventTypeService;

    private EventType type(ZoneRule rule, boolean active) {
        EventType type = new EventType();
        type.setId(UUID.randomUUID());
        type.setIsActive(active);
        type.setZoneRule(rule);
        return type;
    }

    @Test
    @DisplayName("Indexa por id solo los tipos que declaran regla, incluidos los dados de baja")
    void shouldIndexOnlyTypesWithRuleIncludingInactiveOnes() {
        ZoneRule activeRule = new ZoneRule(List.of(6), null, "zone");
        ZoneRule inactiveRule = new ZoneRule(List.of(2, 3, 4, 5), null, null);
        EventType withRule = type(activeRule, true);
        EventType inactive = type(inactiveRule, false);
        when(eventTypeRepository.findAll()).thenReturn(List.of(withRule, inactive, type(null, true)));

        Map<UUID, ZoneRule> rules = eventTypeService.zoneRulesByTypeId();

        assertEquals(Map.of(withRule.getId(), activeRule, inactive.getId(), inactiveRule), rules);
    }
}
