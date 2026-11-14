package com.ovaltrack.backend.statistic.business.strategy;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Actor;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.statistic.business.util.StatisticMathUtils;
import com.ovaltrack.backend.statistic.domain.dto.PeriodStatisticDTO;
import com.ovaltrack.backend.zone.business.ZoneGrid;

/**
 * Estrategia encargada de calcular el porcentaje de posesión del equipo propio por tiempo de juego, con la misma
 * regla que las estadísticas del frontend ({@code possession-calculator.ts}): cada evento con equipo definido le
 * acredita al equipo que lo ejecutó el tiempo transcurrido desde el evento anterior. No cuentan los eventos en los
 * que el analista elige el equipo (tarjetas, lesiones, cambios, penales) ni los NEUTRAL. Cada tiempo arranca a contar
 * desde su inicio (minuto 0 o 40), no desde el último evento del tiempo anterior.
 */
@Component
public class PossessionStatisticStrategy implements PeriodStatisticStrategy {

    private static final Comparator<Event> PLAY_ORDER = Comparator
            .comparing(Event::getPeriod, Comparator.nullsFirst(Comparator.naturalOrder()))
            .thenComparing(Event::getMatchTime);

    @Override
    public void calculate(Collection<Event> periodEvents, PeriodStatisticDTO.Builder builder) {
        List<Event> counted = periodEvents.stream()
                .filter(event -> event.getMatchTime() != null)
                .filter(event -> event.getTeamPossession() == EventPossession.OWN
                        || event.getTeamPossession() == EventPossession.OPPONENT)
                .filter(event -> event.getEventType() != null && event.getEventType().getActor() != Actor.CHOOSE)
                .sorted(PLAY_ORDER)
                .toList();

        int ownSeconds = 0;
        int opponentSeconds = 0;
        int lastTime = 0;
        Integer lastPeriod = null;
        for (Event event : counted) {
            Integer period = event.getPeriod();
            if (period != null && !period.equals(lastPeriod)) {
                lastTime = Math.max(lastTime, ZoneGrid.periodStartMinute(period) * ZoneGrid.SECONDS_PER_MINUTE);
                lastPeriod = period;
            }
            int duration = event.getMatchTime() - lastTime;
            if (duration > 0) {
                if (event.getTeamPossession() == EventPossession.OWN) {
                    ownSeconds += duration;
                } else {
                    opponentSeconds += duration;
                }
            }
            lastTime = Math.max(lastTime, event.getMatchTime());
        }

        builder.ownPossessionPercentage(
                StatisticMathUtils.calculatePercentage(ownSeconds, ownSeconds + opponentSeconds, 50.0));
    }
}
