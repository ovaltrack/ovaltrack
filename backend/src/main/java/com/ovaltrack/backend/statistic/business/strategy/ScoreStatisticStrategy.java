package com.ovaltrack.backend.statistic.business.strategy;

import java.util.Collection;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.statistic.business.advanced.PlayRules;
import com.ovaltrack.backend.statistic.domain.dto.PeriodStatisticDTO;

/**
 * Estrategia encargada de calcular el tanteador y conteo de anotaciones (tries, conversiones, penales y drops).
 *
 * <p>Usa las mismas reglas que el marcador: el tipo se identifica por su {@code code}, los puntos salen del catálogo,
 * un pateo con {@code wasSuccessful = false} no suma ni cuenta como convertido, y los puntos se acreditan al equipo
 * que anota (un evento NEUTRAL sin jugador no suma a nadie). El try penal cuenta como try.
 */
@Component
public class ScoreStatisticStrategy implements PeriodStatisticStrategy {

    @Override
    public void calculate(Collection<Event> periodEvents, PeriodStatisticDTO.Builder builder) {
        TeamCounter score = new TeamCounter();
        TeamCounter tries = new TeamCounter();
        TeamCounter conversions = new TeamCounter();
        TeamCounter penalties = new TeamCounter();
        TeamCounter dropGoals = new TeamCounter();

        for (Event event : periodEvents) {
            int points = PlayRules.points(event);
            EventPossession team = PlayRules.scoringTeam(event);
            if (points == 0 || team == null) {
                continue;
            }
            score.add(team, points);
            switch (PlayRules.code(event)) {
                case "TRY", "PENALTY_TRY" -> tries.add(team, 1);
                case "CONVERSION" -> conversions.add(team, 1);
                case "PENALTY_KICK" -> penalties.add(team, 1);
                case "DROP_GOAL" -> dropGoals.add(team, 1);
                default -> { }
            }
        }

        builder.ownScore(score.own)
               .opponentScore(score.opponent)
               .ownTries(tries.own)
               .opponentTries(tries.opponent)
               .ownConversions(conversions.own)
               .opponentConversions(conversions.opponent)
               .ownPenalties(penalties.own)
               .opponentPenalties(penalties.opponent)
               .ownDropGoals(dropGoals.own)
               .opponentDropGoals(dropGoals.opponent);
    }
}
