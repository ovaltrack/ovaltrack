package com.ovaltrack.backend.zone.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ovaltrack.backend.event.business.EventTypeService;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.dto.event.MatchTimelineEventResponseDTO;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneCell;
import com.ovaltrack.backend.zone.domain.ZoneRule;
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("PostMatchZoneEnricher: vincula eventos del post-partido con su zona")
class PostMatchZoneEnricherTest {

    @Mock private ZoneAssignmentRepository zoneAssignmentRepository;
    @Mock private EventTypeService eventTypeService;

    private PostMatchZoneEnricher enricher() {
        return new PostMatchZoneEnricher(zoneAssignmentRepository, new EventZoneResolver(), eventTypeService);
    }

    private MatchTimelineEventResponseDTO event(int period, int minute) {
        return new MatchTimelineEventResponseDTO(UUID.randomUUID(), UUID.randomUUID(), "Tackle completado", null, null,
                null, minute * 60, null, null, period, null, "post_capture", null, null, null);
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
    @DisplayName("Asigna la zona a los eventos dentro del rango y deja null a los demás")
    void shouldSetZoneOnlyOnCoveredEvents() {
        UUID matchId = UUID.randomUUID();
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId))
                .thenReturn(List.of(assignment(1, 10, 25, 2, 3)));

        List<MatchTimelineEventResponseDTO> result = enricher().enrich(matchId, List.of(event(1, 15), event(1, 30)));

        assertEquals(new ZoneCell(2, 3), result.get(0).zone());
        assertNull(result.get(1).zone());
    }

    @Test
    @DisplayName("Sin asignaciones todos los eventos quedan sin zona y se conservan sus datos")
    void shouldKeepEventsUntouchedWithoutAssignments() {
        UUID matchId = UUID.randomUUID();
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(List.of());
        MatchTimelineEventResponseDTO original = event(2, 50);

        MatchTimelineEventResponseDTO enriched = enricher().enrich(matchId, List.of(original)).get(0);

        assertNull(enriched.zone());
        assertEquals(original.id(), enriched.id());
        assertEquals(original.matchTime(), enriched.matchTime());
    }

    @Test
    @DisplayName("Los eventos de tiempo añadido se vinculan a la zona del último tramo del período")
    void shouldLinkAddedTimeEventsToTheLastSegment() {
        UUID matchId = UUID.randomUUID();
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId))
                .thenReturn(List.of(assignment(1, 31, 40, 2, 4)));

        MatchTimelineEventResponseDTO enriched = enricher().enrich(matchId, List.of(event(1, 43))).get(0);

        assertEquals(new ZoneCell(2, 4), enriched.zone());
        assertEquals(43 * 60, enriched.matchTime());
    }

    // --- Regla de zona por tipo de evento ---

    private MatchTimelineEventResponseDTO event(UUID typeId, EventPossession possession, Map<String, Object> attributes,
                                               int period, int minute) {
        return new MatchTimelineEventResponseDTO(UUID.randomUUID(), typeId, "Evento", null, null,
                null, minute * 60, null, null, period, possession, "post_capture", attributes, null, null);
    }

    @Test
    @DisplayName("Un evento de zona fija queda en su celda aunque el tramo diga otra cosa")
    void shouldApplyFixedZoneRule() {
        UUID matchId = UUID.randomUUID();
        UUID tryTypeId = UUID.randomUUID();
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId))
                .thenReturn(List.of(assignment(1, 20, 25, 2, 5)));
        when(eventTypeService.zoneRulesByTypeId()).thenReturn(Map.of(tryTypeId, new ZoneRule(List.of(6), null, "zone")));

        MatchTimelineEventResponseDTO enriched = enricher().enrich(matchId,
                List.of(event(tryTypeId, EventPossession.OWN, Map.of("zone", "right"), 1, 22))).get(0);

        assertEquals(new ZoneCell(3, 6), enriched.zone());
    }

    @Test
    @DisplayName("Un evento de zona fija tiene zona aunque no haya tramos")
    void shouldApplyFixedZoneWithoutAssignments() {
        UUID matchId = UUID.randomUUID();
        UUID penaltyTryId = UUID.randomUUID();
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(List.of());
        when(eventTypeService.zoneRulesByTypeId()).thenReturn(Map.of(penaltyTryId, new ZoneRule(List.of(6), List.of(2), null)));

        MatchTimelineEventResponseDTO enriched = enricher().enrich(matchId,
                List.of(event(penaltyTryId, EventPossession.OWN, Map.of(), 1, 22))).get(0);

        assertEquals(new ZoneCell(2, 6), enriched.zone());
    }

    @Test
    @DisplayName("Un try del rival se espeja")
    void shouldMirrorOpponentEvents() {
        UUID matchId = UUID.randomUUID();
        UUID tryTypeId = UUID.randomUUID();
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(List.of());
        when(eventTypeService.zoneRulesByTypeId()).thenReturn(Map.of(tryTypeId, new ZoneRule(List.of(6), null, "zone")));

        MatchTimelineEventResponseDTO enriched = enricher().enrich(matchId,
                List.of(event(tryTypeId, EventPossession.OPPONENT, Map.of("zone", "left"), 1, 22))).get(0);

        assertEquals(new ZoneCell(3, 1), enriched.zone());
    }

    @Test
    @DisplayName("Un evento que el tramo deja en una celda prohibida queda sin zona")
    void shouldLeaveProhibitedCellUnzoned() {
        UUID matchId = UUID.randomUUID();
        UUID scrumTypeId = UUID.randomUUID();
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId))
                .thenReturn(List.of(assignment(1, 20, 25, 2, 6)));
        when(eventTypeService.zoneRulesByTypeId()).thenReturn(Map.of(scrumTypeId, new ZoneRule(List.of(2, 3, 4, 5), null, null)));

        MatchTimelineEventResponseDTO enriched = enricher().enrich(matchId,
                List.of(event(scrumTypeId, EventPossession.OWN, Map.of(), 1, 22))).get(0);

        assertNull(enriched.zone());
    }

    @Test
    @DisplayName("Los tipos sin regla conservan la zona del tramo")
    void shouldKeepAssignmentZoneForTypesWithoutRule() {
        UUID matchId = UUID.randomUUID();
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId))
                .thenReturn(List.of(assignment(1, 20, 25, 2, 6)));
        when(eventTypeService.zoneRulesByTypeId()).thenReturn(Map.of());

        List<MatchTimelineEventResponseDTO> result = enricher().enrich(matchId,
                List.of(event(UUID.randomUUID(), EventPossession.OWN, Map.of(), 1, 22)));

        assertEquals(new ZoneCell(2, 6), result.get(0).zone());
    }
}
