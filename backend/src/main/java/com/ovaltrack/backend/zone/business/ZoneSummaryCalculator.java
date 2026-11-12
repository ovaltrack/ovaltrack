package com.ovaltrack.backend.zone.business;

import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneCell;
import com.ovaltrack.backend.zone.domain.ZoneQuery;
import com.ovaltrack.backend.zone.domain.dto.ZoneSummaryDTO;
import com.ovaltrack.backend.zone.domain.dto.ZoneSummaryDTO.ZoneCellCountDTO;

import lombok.RequiredArgsConstructor;

/** Cuenta cuántos eventos caen en cada celda; solo informa las celdas con al menos un evento. */
@Component
@RequiredArgsConstructor
public class ZoneSummaryCalculator {

    private final EventZoneResolver resolver;

    public ZoneSummaryDTO calculate(Collection<Event> events, List<ZoneAssignment> assignments) {
        Map<ZoneCell, Integer> counts = new HashMap<>();
        int unzoned = 0;

        for (Event event : events) {
            Optional<ZoneCell> cell = resolver.resolve(ZoneQuery.of(event), assignments);
            if (cell.isPresent()) {
                counts.merge(cell.get(), 1, Integer::sum);
            } else {
                unzoned++;
            }
        }

        List<ZoneCellCountDTO> cells = counts.entrySet().stream()
                .map(entry -> new ZoneCellCountDTO(entry.getKey().row(), entry.getKey().col(), entry.getValue()))
                .sorted(Comparator.comparingInt(ZoneCellCountDTO::row).thenComparingInt(ZoneCellCountDTO::col))
                .toList();

        return new ZoneSummaryDTO(cells, unzoned);
    }
}
