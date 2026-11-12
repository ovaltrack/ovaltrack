package com.ovaltrack.backend.zone.business;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneCell;
import com.ovaltrack.backend.zone.domain.ZoneQuery;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentCreationDTO;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentMapper;

import lombok.RequiredArgsConstructor;

/**
 * Regla de negocio: una jugada no puede quedar en una celda que su tipo prohíbe. No accede a datos: recibe todo
 * lo que necesita y lanza BusinessException (409) con el tipo, el tiempo, la celda, el tramo y lo permitido.
 * Solo hay conflicto cuando el tramo es lo que deja al evento en una celda prohibida: un evento sin regla, de zona
 * fija o fuera de todo tramo nunca lo tiene.
 */
@Component
@RequiredArgsConstructor
public class EventZoneRuleValidator {

    private static final int SECONDS_PER_MINUTE = 60;

    private final EventZoneResolver resolver;

    /** Al crear o editar un tramo: ningún evento activo que caiga en el rango queda en una celda prohibida. */
    public void validateAssignment(ZoneAssignmentCreationDTO request, Collection<Event> events) {
        ZoneAssignment candidate = new ZoneAssignment();
        ZoneAssignmentMapper.applyTo(candidate, request);

        events.stream()
                .filter(event -> Boolean.TRUE.equals(event.getActive()))
                .filter(event -> conflictingAssignment(event, List.of(candidate)).isPresent())
                .min(Comparator.comparing(Event::getPeriod).thenComparing(Event::getMatchTime))
                .ifPresent(event -> {
                    throw rejection(event, candidate);
                });
    }

    /** Al cargar o editar un evento post-partido: la celda del tramo que lo contiene no está prohibida para su tipo. */
    public void validateEvent(Event event, List<ZoneAssignment> assignments) {
        conflictingAssignment(event, assignments).ifPresent(zone -> {
            throw rejection(event, zone);
        });
    }

    private Optional<ZoneAssignment> conflictingAssignment(Event event, List<ZoneAssignment> assignments) {
        ZoneQuery query = ZoneQuery.of(event);
        if (query.rule() == null || query.rule().isFixed(query.attributes())) {
            return Optional.empty();
        }
        return resolver.assignmentAt(query.period(), query.matchTime(), assignments)
                .filter(zone -> resolver.resolve(query, List.of(zone)).isEmpty());
    }

    private BusinessException rejection(Event event, ZoneAssignment zone) {
        int seconds = event.getMatchTime();
        return new BusinessException("%s (%dT %02d:%02d) no puede quedar en %s (tramo %dT %d'–%d'): solo puede ocurrir en %s".formatted(
                event.getEventType().getName(), event.getPeriod(), seconds / SECONDS_PER_MINUTE, seconds % SECONDS_PER_MINUTE,
                ZoneGrid.label(new ZoneCell(zone.getRow(), zone.getCol())),
                zone.getPeriod(), zone.getStartMinute(), zone.getEndMinute(),
                event.getEventType().getZoneRule().describeAllowed()));
    }
}
