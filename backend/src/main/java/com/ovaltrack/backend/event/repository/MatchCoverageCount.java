package com.ovaltrack.backend.event.repository;

import java.util.UUID;

/** Conteo agregado por partido de {@link EventRepository#countCoverageByMatchIds}. */
public interface MatchCoverageCount {

    UUID getMatchId();

    Long getTotalEvents();

    Long getWithoutPlayer();
}
