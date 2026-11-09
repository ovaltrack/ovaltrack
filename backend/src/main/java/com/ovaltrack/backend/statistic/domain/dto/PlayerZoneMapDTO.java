package com.ovaltrack.backend.statistic.domain.dto;

import java.util.List;

/** Eventos del jugador por zona de la cancha; la zona se deriva de los tramos de cada partido. */
public record PlayerZoneMapDTO(
    List<Cell> cells,
    int zonedEvents,
    int unzonedEvents,
    /** Partidos del alcance que tienen al menos un tramo asignado. */
    int matchesWithZones
) {
    public record Cell(int row, int col, int count) {
    }
}
