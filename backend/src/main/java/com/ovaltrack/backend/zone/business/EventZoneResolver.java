package com.ovaltrack.backend.zone.business;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneCell;
import com.ovaltrack.backend.zone.domain.ZoneQuery;

/**
 * Deriva la zona de un evento a partir de su minuto de juego, las asignaciones del partido y la regla de su tipo.
 * Es puro: no accede a datos ni persiste nada, la zona nunca se guarda en el evento.
 */
@Component
public class EventZoneResolver {

    /**
     * Celda del evento: la del tramo que contiene su minuto, ajustada por la regla de su tipo. La regla se lee desde el
     * equipo que ejecuta el evento, así que para el rival se espeja la celda del tramo, se aplica la regla y se vuelve.
     */
    public Optional<ZoneCell> resolve(ZoneQuery query, List<ZoneAssignment> assignments) {
        if (query.period() == null || query.matchTime() == null) {
            return Optional.empty();
        }

        Optional<ZoneCell> assignmentCell = assignmentAt(query.period(), query.matchTime(), assignments)
                .map(zone -> new ZoneCell(zone.getRow(), zone.getCol()));
        if (query.rule() == null) {
            return assignmentCell;
        }

        boolean fromOpponent = query.possession() == EventPossession.OPPONENT;
        return query.rule()
                .place(query.attributes(), assignmentCell.map(cell -> orient(cell, fromOpponent)))
                .map(cell -> orient(cell, fromOpponent));
    }

    /** Rango semiabierto: el inicio es inclusivo y el fin exclusivo, así los límites no son ambiguos. */
    public Optional<ZoneAssignment> assignmentAt(Integer period, Integer matchTimeSeconds, List<ZoneAssignment> assignments) {
        if (period == null || matchTimeSeconds == null) {
            return Optional.empty();
        }

        // El tiempo añadido cuenta como el último segundo del período (el fin del tramo es exclusivo)
        int effectiveSeconds = ZoneGrid.effectiveSeconds(period, matchTimeSeconds);

        return assignments.stream()
                .filter(zone -> zone.getPeriod().equals(period))
                .filter(zone -> zone.getStartMinute() * ZoneGrid.SECONDS_PER_MINUTE <= effectiveSeconds
                        && effectiveSeconds < zone.getEndMinute() * ZoneGrid.SECONDS_PER_MINUTE)
                .findFirst();
    }

    private ZoneCell orient(ZoneCell cell, boolean mirrored) {
        return mirrored ? ZoneGrid.mirror(cell) : cell;
    }
}
