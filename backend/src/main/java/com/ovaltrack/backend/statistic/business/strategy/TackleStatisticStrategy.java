package com.ovaltrack.backend.statistic.business.strategy;

import java.util.Collection;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.statistic.business.advanced.PlayRules;
import com.ovaltrack.backend.statistic.business.util.StatisticMathUtils;
import com.ovaltrack.backend.statistic.domain.dto.PeriodStatisticDTO;

/**
 * Estrategia encargada de calcular tackles completados, fallados y efectividad porcentual (por {@code code} del catálogo).
 */
@Component
public class TackleStatisticStrategy implements PeriodStatisticStrategy {

    @Override
    public void calculate(Collection<Event> periodEvents, PeriodStatisticDTO.Builder builder) {
        int ownTacklesCompleted = 0;
        int ownTacklesMissed = 0;

        for (Event event : periodEvents) {
            if (event.getTeamPossession() != EventPossession.OWN) {
                continue;
            }

            if ("TACKLE_MADE".equals(PlayRules.code(event))) {
                ownTacklesCompleted++;
            } else if ("TACKLE_MISSED".equals(PlayRules.code(event))) {
                ownTacklesMissed++;
            }
        }

        int totalTackles = ownTacklesCompleted + ownTacklesMissed;
        double ownTackleEffectiveness = StatisticMathUtils.calculatePercentage(
                ownTacklesCompleted, totalTackles, 0.0);

        builder.ownTacklesCompleted(ownTacklesCompleted)
               .ownTacklesMissed(ownTacklesMissed)
               .ownTackleEffectiveness(ownTackleEffectiveness);
    }
}
