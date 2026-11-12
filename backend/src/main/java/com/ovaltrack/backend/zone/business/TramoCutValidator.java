package com.ovaltrack.backend.zone.business;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneQuery;
import com.ovaltrack.backend.zone.domain.ZoneRule;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentCreationDTO;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentMapper;

import lombok.RequiredArgsConstructor;

/**
 * Regla de negocio: después de un evento que reinicia el juego (Try, Try penal, Kick H, Drop goal) el territorio
 * cambia, así que el tramo que lo contiene tiene que terminar en su minuto. No accede a datos: recibe el tramo
 * pedido y los eventos del partido, y lanza BusinessException (409) con el tramo, el evento y dónde terminarlo.
 */
@Component
@RequiredArgsConstructor
public class TramoCutValidator {

    private final EventZoneResolver resolver;

    /** Al crear o editar un tramo: ningún evento que cierra el tramo queda antes de su último minuto. */
    public void validateAssignment(ZoneAssignmentCreationDTO request, Collection<Event> events) {
        ZoneAssignment candidate = new ZoneAssignment();
        ZoneAssignmentMapper.applyTo(candidate, request);

        events.stream()
                .filter(event -> Boolean.TRUE.equals(event.getActive()))
                .filter(this::cutsTramo)
                .filter(event -> resolver.assignmentAt(event.getPeriod(), event.getMatchTime(), List.of(candidate)).isPresent())
                .filter(event -> request.endMinute() != requiredEndMinute(event))
                .min(Comparator.comparing(Event::getPeriod).thenComparing(Event::getMatchTime))
                .ifPresent(event -> {
                    throw rejection(request, event);
                });
    }

    private boolean cutsTramo(Event event) {
        ZoneRule rule = ZoneQuery.of(event).rule();
        return rule != null && rule.cutsTramo();
    }

    /** El tramo que contiene el evento termina en el minuto siguiente al suyo (el tiempo añadido cuenta como el último). */
    private int requiredEndMinute(Event event) {
        return ZoneGrid.effectiveSeconds(event.getPeriod(), event.getMatchTime()) / ZoneGrid.SECONDS_PER_MINUTE + 1;
    }

    private BusinessException rejection(ZoneAssignmentCreationDTO request, Event event) {
        return new BusinessException("El tramo %dT %d'–%d' no puede seguir después del %s (%dT %s): terminalo en %d'".formatted(
                request.period(), request.startMinute(), request.endMinute(),
                event.getEventType().getName(), event.getPeriod(), ZoneGrid.clock(event.getMatchTime()),
                requiredEndMinute(event)));
    }
}
