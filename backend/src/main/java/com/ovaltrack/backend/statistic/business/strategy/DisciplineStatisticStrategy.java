package com.ovaltrack.backend.statistic.business.strategy;

import java.util.Collection;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.statistic.business.advanced.PlayRules;
import com.ovaltrack.backend.statistic.domain.dto.PeriodStatisticDTO;

/**
 * Estrategia encargada de calcular penales concedidos, tarjetas amarillas y tarjetas rojas, por {@code code} del
 * catálogo. Se acreditan al equipo que cometió la infracción (el que ejecuta el evento); los NEUTRAL no cuentan.
 */
@Component
public class DisciplineStatisticStrategy implements PeriodStatisticStrategy {

    @Override
    public void calculate(Collection<Event> periodEvents, PeriodStatisticDTO.Builder builder) {
        TeamCounter penaltiesConceded = new TeamCounter();
        TeamCounter yellowCards = new TeamCounter();
        TeamCounter redCards = new TeamCounter();

        for (Event event : periodEvents) {
            switch (PlayRules.code(event)) {
                case "PENALTY_CONCEDED" -> penaltiesConceded.add(event.getTeamPossession(), 1);
                case "YELLOW_CARD" -> yellowCards.add(event.getTeamPossession(), 1);
                case "RED_CARD" -> redCards.add(event.getTeamPossession(), 1);
                default -> { }
            }
        }

        builder.ownPenaltiesConceded(penaltiesConceded.own)
               .opponentPenaltiesConceded(penaltiesConceded.opponent)
               .ownYellowCards(yellowCards.own)
               .opponentYellowCards(yellowCards.opponent)
               .ownRedCards(redCards.own)
               .opponentRedCards(redCards.opponent);
    }
}
