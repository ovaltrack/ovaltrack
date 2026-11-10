package com.ovaltrack.backend.zone.business;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.event.business.EventTypeService;
import com.ovaltrack.backend.event.domain.dto.event.MatchTimelineEventResponseDTO;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
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

        return events.stream()
                .map(event -> event.withZone(resolver.resolve(event.period(), event.matchTime(), assignments).orElse(null)))
                .toList();
    }
}
