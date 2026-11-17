package com.ovaltrack.backend.event.domain.dto.event;

import java.util.UUID;

/** Conteo agregado de eventos activos de un partido, tal como lo devuelve la consulta de cobertura. */
public record EventCoverageCount(UUID matchId, long totalEvents, long withoutPlayer) {
}
