package com.ovaltrack.backend.zone.business;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.event.business.EventTypeService;
import com.ovaltrack.backend.event.domain.dto.event.MatchTimelineEventResponseDTO;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneQuery;
import com.ovaltrack.backend.zone.domain.ZoneRule;
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;

import lombok.RequiredArgsConstructor;

/** Vincula cada evento del post-partido con su zona, derivándola de las asignaciones del partido. */
@Component
@RequiredArgsConstructor
public class PostMatchZoneEnricher {

    private final ZoneAssignmentRepository zoneAssignmentRepository;
    private final EventZoneResolver resolver;
    private final EventTypeService eventTypeService;

    @Transactional(readOnly = true)
    public List<MatchTimelineEventResponseDTO> enrich(UUID matchId, Collection<MatchTimelineEventResponseDTO> events) {
        List<ZoneAssignment> assignments = zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId);

        Map<UUID, ZoneRule> rulesByType = eventTypeService.zoneRulesByTypeId();

        return events.stream()
                .map(event -> event.withZone(resolver.resolve(queryOf(event, rulesByType), assignments).orElse(null)))
                .toList();
    }

    private ZoneQuery queryOf(MatchTimelineEventResponseDTO event, Map<UUID, ZoneRule> rulesByType) {
        return new ZoneQuery(rulesByType.get(event.eventTypeId()), event.teamPossession(), event.attributes(),
                event.period(), event.matchTime());
    }
}
