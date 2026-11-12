package com.ovaltrack.backend.zone.business;

import java.util.Collection;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentCreationDTO;

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
        throw new UnsupportedOperationException("Sin implementar");
    }
}
