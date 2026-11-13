package com.ovaltrack.backend.zone.business;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;

import lombok.RequiredArgsConstructor;

/** Acorta el tramo que contiene un tanteo que reinicia el juego: lo que sigue queda como hueco, sin zona. */
@Component
@RequiredArgsConstructor
public class TramoTrimmer {

    private final EventZoneResolver resolver;
    private final ZoneAssignmentRepository zoneAssignmentRepository;

    public void trimAt(Event event) {
        throw new UnsupportedOperationException("pendiente: Fase 2a backend");
    }
}
