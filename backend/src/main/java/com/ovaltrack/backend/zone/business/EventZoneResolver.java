package com.ovaltrack.backend.zone.business;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneCell;
import com.ovaltrack.backend.zone.domain.ZoneQuery;

/**
 * Deriva la zona de un evento comparando su minuto de juego contra las asignaciones del partido.
 * Es puro: no accede a datos ni persiste nada, la zona nunca se guarda en el evento.
 */
@Component
public class EventZoneResolver {

    private static final int SECONDS_PER_MINUTE = 60;
    private static final int MINUTES_PER_PERIOD = 40;

    /** Rango semiabierto: el inicio es inclusivo y el fin exclusivo, así los límites no son ambiguos. */
    public Optional<ZoneCell> resolve(Integer period, Integer matchTimeSeconds, List<ZoneAssignment> assignments) {
        if (period == null || matchTimeSeconds == null) {
            return Optional.empty();
        }

        int effectiveSeconds = effectiveSeconds(period, matchTimeSeconds);

        return assignments.stream()
                .filter(zone -> zone.getPeriod().equals(period))
                .filter(zone -> zone.getStartMinute() * SECONDS_PER_MINUTE <= effectiveSeconds
                        && effectiveSeconds < zone.getEndMinute() * SECONDS_PER_MINUTE)
                .findFirst()
                .map(zone -> new ZoneCell(zone.getRow(), zone.getCol()));
    }

    /** Igual que la anterior pero aplicando la regla de zona del tipo de evento y la perspectiva de quien lo ejecuta. */
    public Optional<ZoneCell> resolve(ZoneQuery query, List<ZoneAssignment> assignments) {
        throw new UnsupportedOperationException("Sin implementar");
    }

    /**
     * El tiempo añadido cuenta como el minuto 40 (1T) o el 80 (2T). Como el fin del tramo es exclusivo,
     * se limita al último segundo del período. Solo afecta a la lectura: el matchTime guardado no cambia.
     */
    private int effectiveSeconds(int period, int matchTimeSeconds) {
        int lastSecondOfPeriod = period * MINUTES_PER_PERIOD * SECONDS_PER_MINUTE - 1;
        return Math.min(matchTimeSeconds, lastSecondOfPeriod);
    }
}
