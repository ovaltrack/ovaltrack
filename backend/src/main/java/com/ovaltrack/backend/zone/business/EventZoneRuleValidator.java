package com.ovaltrack.backend.zone.business;

import java.util.Collection;
import java.util.List;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentCreationDTO;

import lombok.RequiredArgsConstructor;

/**
 * Regla de negocio: una jugada no puede quedar en una celda que su tipo prohíbe. No accede a datos: recibe todo
 * lo que necesita y lanza BusinessException (409) con el tipo, el tiempo, la celda, el tramo y lo permitido.
 */
@Component
@RequiredArgsConstructor
public class EventZoneRuleValidator {

    private final EventZoneResolver resolver;

    /** Al crear o editar un tramo: ningún evento activo que caiga en el rango queda en una celda prohibida. */
    public void validateAssignment(ZoneAssignmentCreationDTO request, Collection<Event> events) {
        throw new UnsupportedOperationException("Sin implementar");
    }

    /** Al cargar o editar un evento post-partido: la celda del tramo que lo contiene no está prohibida para su tipo. */
    public void validateEvent(Event event, List<ZoneAssignment> assignments) {
        throw new UnsupportedOperationException("Sin implementar");
    }
}
