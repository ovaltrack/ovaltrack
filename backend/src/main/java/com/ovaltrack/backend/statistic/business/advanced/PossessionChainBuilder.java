package com.ovaltrack.backend.statistic.business.advanced;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;

/**
 * Arma las posesiones de un partido repitiendo, evento por evento, la misma regla con la que la carga en vivo
 * decide quién tiene la pelota. Cada período empieza sin posesión. Es puro: no accede a datos.
 */
final class PossessionChainBuilder {

    /** Orden de juego: período, reloj de juego, tiempo de video y hora real (los nulos al final). */
    static final Comparator<Event> PLAY_ORDER = Comparator
            .comparing(Event::getPeriod, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(Event::getMatchTime, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(Event::getAbsoluteMatchTime, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(Event::getRealTime, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(Event::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));

    private PossessionChainBuilder() {
    }

    /** Posesiones de los eventos activos recibidos; los eventos sin período o sin minuto no se ubican y se ignoran. */
    static List<PossessionChain> build(List<Event> events) {
        Map<Integer, List<Event>> byPeriod = events.stream()
                .filter(event -> event.getPeriod() != null && event.getMatchTime() != null)
                .sorted(PLAY_ORDER)
                .collect(Collectors.groupingBy(Event::getPeriod, TreeMap::new, Collectors.toList()));

        List<PossessionChain> chains = new ArrayList<>();
        byPeriod.values().forEach(periodEvents -> chains.addAll(buildPeriod(periodEvents)));
        return chains;
    }

    private static List<PossessionChain> buildPeriod(List<Event> events) {
        List<PossessionChain> chains = new ArrayList<>();
        Open open = null;

        for (Event event : events) {
            EventPossession before = PlayRules.holderBefore(event);
            if (before != null && (open == null || open.team != before)) {
                if (open != null) {
                    chains.add(open.close(null, false));
                }
                open = new Open(before, event);
            }
            if (open == null) {
                continue;
            }

            open.add(event);
            EventPossession after = PlayRules.holderAfter(event);
            if (after != null && after != open.team) {
                chains.add(open.close(event, false));
                open = new Open(after, event);
            }
        }

        if (open != null) {
            chains.add(open.close(null, true));
        }
        return chains;
    }

    /** Posesión en curso. */
    private static final class Open {
        private final EventPossession team;
        private final Event origin;
        private final List<Event> events = new ArrayList<>();
        private int points;

        /**
         * @param origin evento que dio la pelota. Si la posesión arrancó con un evento propio (primero del período o
         *               cambio no explicado), ese evento se registra luego como parte de la posesión y no es origen.
         */
        Open(EventPossession team, Event origin) {
            this.team = team;
            this.origin = PlayRules.holderBefore(origin) == team ? null : origin;
        }

        void add(Event event) {
            events.add(event);
            if (PlayRules.scoringTeam(event) == team) {
                points += PlayRules.points(event);
            }
        }

        PossessionChain close(Event end, boolean endedWithPeriod) {
            return new PossessionChain(team, origin, List.copyOf(events), end, endedWithPeriod, points);
        }
    }
}
