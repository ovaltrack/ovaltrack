package com.ovaltrack.backend.statistic.business.advanced;

import java.util.List;

import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.Event;

/**
 * Tramo de juego en el que un mismo equipo tuvo la pelota.
 *
 * @param team            equipo con la pelota
 * @param origin          evento que le dio la pelota (pertenece a la posesión anterior); null al arrancar el período
 * @param events          eventos ocurridos durante la posesión, incluido el que la terminó
 * @param end             evento que pasó la pelota al rival; null si terminó con el período o sin un evento que lo explique
 * @param endedWithPeriod la posesión llegó al final del período
 * @param points          puntos que hizo {@code team} durante la posesión
 */
record PossessionChain(EventPossession team, Event origin, List<Event> events, Event end, boolean endedWithPeriod,
                       int points) {

    private static final String RESTART_KICK = "RESTART_KICK";

    /**
     * Posesión que solo consistió en patear el saque de reinicio: no es una posesión real (el equipo no jugó la
     * pelota) y se excluye de los conteos para no diluir los puntos por posesión.
     */
    boolean isRestartKickOnly() {
        return points == 0 && !events.isEmpty()
                && events.stream().allMatch(event -> RESTART_KICK.equals(PlayRules.code(event)));
    }
}
