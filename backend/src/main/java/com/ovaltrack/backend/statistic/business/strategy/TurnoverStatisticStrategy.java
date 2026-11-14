package com.ovaltrack.backend.statistic.business.strategy;

import java.util.Collection;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.statistic.business.advanced.PlayRules;
import com.ovaltrack.backend.statistic.domain.dto.PeriodStatisticDTO;

/**
 * Estrategia encargada de calcular los turnovers ganados y perdidos. {@code TURNOVER_WON} se acredita al equipo que
 * gana la pelota, así que el que gana el rival es uno perdido por el propio; los NEUTRAL no cuentan.
 */
@Component
public class TurnoverStatisticStrategy implements PeriodStatisticStrategy {

    @Override
    public void calculate(Collection<Event> periodEvents, PeriodStatisticDTO.Builder builder) {
        TeamCounter won = new TeamCounter();
        for (Event event : periodEvents) {
            if ("TURNOVER_WON".equals(PlayRules.code(event))) {
                won.add(event.getTeamPossession(), 1);
            }
        }

        builder.ownTurnoversWon(won.own)
               .ownTurnoversLost(won.opponent);
    }
}
