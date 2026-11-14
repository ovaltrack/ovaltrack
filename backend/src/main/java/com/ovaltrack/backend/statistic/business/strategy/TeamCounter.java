package com.ovaltrack.backend.statistic.business.strategy;

import com.ovaltrack.backend.event.domain.EventPossession;

/** Contador por equipo para las estrategias: los eventos NEUTRAL (o sin equipo) no suman a ninguno. */
final class TeamCounter {

    int own;
    int opponent;

    void add(EventPossession team, int amount) {
        if (team == EventPossession.OWN) {
            own += amount;
        } else if (team == EventPossession.OPPONENT) {
            opponent += amount;
        }
    }
}
