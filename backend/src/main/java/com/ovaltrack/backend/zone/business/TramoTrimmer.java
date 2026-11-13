package com.ovaltrack.backend.zone.business;

import java.util.List;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;

import lombok.RequiredArgsConstructor;

/**
 * Acorta el tramo que contiene un tanteo que reinicia el juego: el tramo termina en el minuto del tanteo y lo que
 * sigue queda como hueco, sin zona, porque después del saque el territorio es otro. Nunca rechaza nada: es un efecto
 * de guardar el tanteo (también el de la captura en vivo), no una validación.
 */
@Component
@RequiredArgsConstructor
public class TramoTrimmer {

    private final EventZoneResolver resolver;
    private final ZoneAssignmentRepository zoneAssignmentRepository;

    public void trimAt(Event event) {
        if (!TramoCuts.closes(event)) {
            return;
        }

        List<ZoneAssignment> assignments = zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(event.getMatch().getId());
        resolver.assignmentAt(event.getPeriod(), event.getMatchTime(), assignments)
                .ifPresent(tramo -> endAt(tramo, TramoCuts.endMinute(event)));
    }

    /** Solo acorta: un tramo que ya termina en el corte (o antes) queda como está. */
    private void endAt(ZoneAssignment tramo, int endMinute) {
        if (tramo.getEndMinute() > endMinute) {
            tramo.setEndMinute(endMinute);
            zoneAssignmentRepository.save(tramo);
        }
    }
}
