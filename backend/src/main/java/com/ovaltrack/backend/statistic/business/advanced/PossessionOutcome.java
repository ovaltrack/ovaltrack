package com.ovaltrack.backend.statistic.business.advanced;

import java.util.Set;

import com.ovaltrack.backend.event.domain.Event;

/** Cómo terminó una posesión, para el equipo que la tenía. */
public enum PossessionOutcome {
    POINTS,
    KICK,
    TURNOVER,
    PENALTY,
    SET_PIECE_LOST,
    PERIOD_END,
    OTHER;

    private static final Set<String> TURNOVER_CODES = Set.of("TURNOVER_WON", "MAUL", "KICK_RECEPTION");
    private static final Set<String> KICK_CODES = Set.of("KICK_IN_PLAY", "KICK_TO_TOUCH", "RESTART_KICK", "PENALTY_KICK", "DROP_GOAL");
    private static final Set<String> SET_PIECE_CODES = Set.of("SCRUM", "LINEOUT");

    static PossessionOutcome of(PossessionChain chain) {
        if (chain.points() > 0) {
            return POINTS;
        }
        Event end = chain.end();
        if (end == null) {
            return chain.endedWithPeriod() ? PERIOD_END : OTHER;
        }
        String code = PlayRules.code(end);
        if (TURNOVER_CODES.contains(code)) {
            return TURNOVER;
        }
        if (KICK_CODES.contains(code)) {
            return KICK;
        }
        if ("PENALTY_CONCEDED".equals(code)) {
            return PENALTY;
        }
        if (SET_PIECE_CODES.contains(code)) {
            String result = PlayRules.option(end, "SCRUM".equals(code) ? "scrumResult" : "lineResult");
            return "penalty_against".equals(result) ? PENALTY : SET_PIECE_LOST;
        }
        return OTHER;
    }
}
