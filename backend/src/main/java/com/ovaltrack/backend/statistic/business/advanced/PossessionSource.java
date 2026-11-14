package com.ovaltrack.backend.statistic.business.advanced;

import java.util.List;
import java.util.Map;
import java.util.Set;

import com.ovaltrack.backend.event.domain.Event;

/** Cómo empezó una jugada: el evento que dio la pelota o la última formación/reinicio dentro de la posesión. */
public enum PossessionSource {
    SCRUM,
    LINEOUT,
    TURNOVER,
    PENALTY,
    KICK_RETURN,
    RESTART,
    OTHER;

    private static final Map<String, PossessionSource> BY_CODE = Map.ofEntries(
            Map.entry("SCRUM", SCRUM),
            Map.entry("LINEOUT", LINEOUT),
            Map.entry("TURNOVER_WON", TURNOVER),
            Map.entry("MAUL", TURNOVER),
            Map.entry("PENALTY_CONCEDED", PENALTY),
            Map.entry("QUICK_PLAY", PENALTY),
            Map.entry("KICK_IN_PLAY", KICK_RETURN),
            Map.entry("KICK_TO_TOUCH", KICK_RETURN),
            Map.entry("KICK_RECEPTION", KICK_RETURN),
            Map.entry("RESTART_KICK", RESTART),
            Map.entry("CONVERSION", RESTART),
            Map.entry("PENALTY_KICK", RESTART),
            Map.entry("DROP_GOAL", RESTART),
            Map.entry("TRY", RESTART),
            Map.entry("PENALTY_TRY", RESTART));

    /**
     * Eventos que reinician la jugada sin cambiar la posesión: un scrum o line-out ganado, un penal a favor jugado,
     * una recepción de patada. Si hubo uno antes del try, la jugada empezó ahí y no en el origen de la posesión.
     */
    private static final Set<String> RESTARTS_WITHIN_POSSESSION =
            Set.of("SCRUM", "LINEOUT", "PENALTY_CONCEDED", "QUICK_PLAY", "KICK_RECEPTION", "RESTART_KICK");

    /** Fuente del evento que dio la posesión (null: arranque del período sin evento). */
    static PossessionSource ofOrigin(Event origin) {
        if (origin == null) {
            return OTHER;
        }
        String code = PlayRules.code(origin);
        if ("KICK_RECEPTION".equals(code)) {
            return TURNOVER;
        }
        return BY_CODE.getOrDefault(code, OTHER);
    }

    /** Fuente de la jugada que termina en {@code scoring}: el último reinicio dentro de la posesión, o su origen. */
    static PossessionSource ofScore(PossessionChain chain, Event scoring) {
        List<Event> events = chain.events();
        for (int index = events.indexOf(scoring) - 1; index >= 0; index--) {
            String code = PlayRules.code(events.get(index));
            if (RESTARTS_WITHIN_POSSESSION.contains(code)) {
                return BY_CODE.get(code);
            }
        }
        return ofOrigin(chain.origin());
    }
}
