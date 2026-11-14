package com.ovaltrack.backend.statistic.business.advanced;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO.CategoryCount;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO.PenaltyTerritory;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO.RedZone;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO.ScoreBlock;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO.SinBin;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO.TeamCount;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO.TeamRate;
import com.ovaltrack.backend.zone.business.EventZoneResolver;
import com.ovaltrack.backend.zone.business.ZoneGrid;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneCell;
import com.ovaltrack.backend.zone.domain.ZoneQuery;

import lombok.RequiredArgsConstructor;

/**
 * Estadísticas de segundo nivel de un partido: posesiones, origen de los tries, zona roja, penales por territorio,
 * puntos por bloque y efecto de las amarillas. Es puro: recibe los eventos activos y los tramos del partido.
 */
@Component
@RequiredArgsConstructor
public class AdvancedStatisticsCalculator {

    static final int BLOCK_MINUTES = 10;
    static final int DEFAULT_SIN_BIN_MINUTES = 10;
    private static final String SIN_BIN_DURATION_KEY = "durationMinutes";

    private final EventZoneResolver zoneResolver;

    /**
     * @param events      eventos activos de todo el partido
     * @param assignments tramos de zona de todo el partido
     * @param period      1, 2 o null para el partido completo
     */
    public AdvancedPeriodStatisticsDTO calculate(Collection<Event> events, List<ZoneAssignment> assignments, Integer period) {
        List<Event> inScope = events.stream()
                .filter(event -> period == null || period.equals(event.getPeriod()))
                .sorted(PossessionChainBuilder.PLAY_ORDER)
                .toList();
        List<ZoneAssignment> scopedAssignments = assignments.stream()
                .filter(zone -> period == null || period.equals(zone.getPeriod()))
                .sorted(Comparator.comparing(ZoneAssignment::getPeriod).thenComparing(ZoneAssignment::getStartMinute))
                .toList();

        List<PossessionChain> chains = PossessionChainBuilder.build(inScope).stream()
                .filter(chain -> !chain.isRestartKickOnly())
                .toList();

        Tally possessions = new Tally();
        Tally possessionPoints = new Tally();
        Map<PossessionOutcome, Tally> outcomes = tallies(PossessionOutcome.class);
        Map<PossessionSource, Tally> trySources = tallies(PossessionSource.class);
        Tally turnoverPossessions = new Tally();
        Tally pointsFromTurnovers = new Tally();

        for (PossessionChain chain : chains) {
            possessions.add(chain.team(), 1);
            possessionPoints.add(chain.team(), chain.points());
            outcomes.get(PossessionOutcome.of(chain)).add(chain.team(), 1);
            if (PossessionSource.ofOrigin(chain.origin()) == PossessionSource.TURNOVER) {
                turnoverPossessions.add(chain.team(), 1);
                pointsFromTurnovers.add(chain.team(), chain.points());
            }
            for (Event event : chain.events()) {
                if (isTry(event) && PlayRules.scoringTeam(event) == chain.team() && PlayRules.points(event) > 0) {
                    trySources.get(PossessionSource.ofScore(chain, event)).add(chain.team(), 1);
                }
            }
        }

        return new AdvancedPeriodStatisticsDTO(
                period,
                possessions.toCount(),
                possessionPoints.ratio(possessions),
                categories(outcomes),
                categories(trySources),
                turnoverPossessions.toCount(),
                pointsFromTurnovers.toCount(),
                redZone(inScope, scopedAssignments),
                penaltyTerritory(inScope, assignments),
                scoreByBlock(inScope, period),
                sinBin(inScope));
    }

    private static boolean isTry(Event event) {
        String code = PlayRules.code(event);
        return "TRY".equals(code) || "PENALTY_TRY".equals(code);
    }

    /**
     * Visitas a la 22 rival: tramos consecutivos (sin hueco) en las columnas 5-6 para el equipo propio y 1-2 para el
     * rival, y los puntos que ese equipo hizo mientras duraron.
     */
    private RedZone redZone(List<Event> events, List<ZoneAssignment> assignments) {
        if (assignments.isEmpty()) {
            return new RedZone(false, new TeamCount(0, 0), new TeamCount(0, 0), new TeamRate(null, null));
        }
        Tally visits = new Tally();
        Tally points = new Tally();
        for (EventPossession team : EventPossession.values()) {
            if (team == EventPossession.NEUTRAL) {
                continue;
            }
            for (ZoneAssignment[] visit : visits(assignments, team)) {
                visits.add(team, 1);
                points.add(team, pointsBetween(events, team, visit[0].getPeriod(),
                        visit[0].getStartMinute(), visit[1].getEndMinute()));
            }
        }
        return new RedZone(true, visits.toCount(), points.toCount(), points.ratio(visits));
    }

    /** Pares [primer tramo, último tramo] de cada visita del equipo a la 22 rival. */
    private static List<ZoneAssignment[]> visits(List<ZoneAssignment> assignments, EventPossession team) {
        List<ZoneAssignment[]> result = new ArrayList<>();
        ZoneAssignment[] current = null;
        for (ZoneAssignment zone : assignments) {
            boolean inRedZone = team == EventPossession.OWN ? zone.getCol() >= 5 : zone.getCol() <= 2;
            boolean continues = current != null && current[1].getPeriod().equals(zone.getPeriod())
                    && current[1].getEndMinute().equals(zone.getStartMinute());
            if (!inRedZone) {
                current = null;
            } else if (continues) {
                current[1] = zone;
            } else {
                current = new ZoneAssignment[] { zone, zone };
                result.add(current);
            }
        }
        return result;
    }

    private static int pointsBetween(List<Event> events, EventPossession team, int period, int fromMinute, int toMinute) {
        return events.stream()
                .filter(event -> event.getMatchTime() != null && Integer.valueOf(period).equals(event.getPeriod()))
                .filter(event -> PlayRules.scoringTeam(event) == team)
                .filter(event -> {
                    int seconds = ZoneGrid.effectiveSeconds(period, event.getMatchTime());
                    return fromMinute * ZoneGrid.SECONDS_PER_MINUTE <= seconds && seconds < toMinute * ZoneGrid.SECONDS_PER_MINUTE;
                })
                .mapToInt(PlayRules::points)
                .sum();
    }

    /** Penales según la mitad donde se cometieron, vista desde el equipo infractor (la grilla siempre ataca a la derecha). */
    private PenaltyTerritory penaltyTerritory(List<Event> events, List<ZoneAssignment> assignments) {
        Tally ownHalf = new Tally();
        Tally opponentHalf = new Tally();
        Tally withoutZone = new Tally();
        for (Event event : events) {
            EventPossession team = PlayRules.actor(event);
            if (team == null || !"PENALTY_CONCEDED".equals(PlayRules.code(event))) {
                continue;
            }
            Optional<ZoneCell> cell = zoneResolver.resolve(ZoneQuery.of(event), assignments);
            if (cell.isEmpty()) {
                withoutZone.add(team, 1);
                continue;
            }
            boolean inOwnSideOfGrid = cell.get().col() <= ZoneGrid.COLS / 2;
            boolean inOwnHalf = team == EventPossession.OWN ? inOwnSideOfGrid : !inOwnSideOfGrid;
            (inOwnHalf ? ownHalf : opponentHalf).add(team, 1);
        }
        return new PenaltyTerritory(ownHalf.toCount(), opponentHalf.toCount(), withoutZone.toCount());
    }

    /** Puntos por bloque de 10 minutos; el tiempo añadido cuenta en el último bloque del período. */
    private static List<ScoreBlock> scoreByBlock(List<Event> events, Integer period) {
        int from = period == null ? 0 : ZoneGrid.periodStartMinute(period);
        int to = period == null ? ZoneGrid.periodEndMinute(ZoneGrid.PERIODS) : ZoneGrid.periodEndMinute(period);
        int blockCount = (to - from) / BLOCK_MINUTES;
        int[][] points = new int[blockCount][2];

        for (Event event : events) {
            EventPossession team = PlayRules.scoringTeam(event);
            int scored = PlayRules.points(event);
            if (team == null || scored == 0 || event.getMatchTime() == null || event.getPeriod() == null) {
                continue;
            }
            int minute = ZoneGrid.effectiveSeconds(event.getPeriod(), event.getMatchTime()) / ZoneGrid.SECONDS_PER_MINUTE;
            int block = Math.min(Math.max((minute - from) / BLOCK_MINUTES, 0), blockCount - 1);
            points[block][team == EventPossession.OWN ? 0 : 1] += scored;
        }

        List<ScoreBlock> result = new ArrayList<>();
        for (int block = 0; block < blockCount; block++) {
            int start = from + block * BLOCK_MINUTES;
            result.add(new ScoreBlock(start, start + BLOCK_MINUTES, points[block][0], points[block][1]));
        }
        return result;
    }

    /** Por cada amarilla, los puntos a favor y en contra del equipo amonestado mientras duró la suspensión. */
    private static SinBin sinBin(List<Event> events) {
        Tally cards = new Tally();
        Tally pointsFor = new Tally();
        Tally pointsAgainst = new Tally();
        for (Event card : events) {
            EventPossession team = PlayRules.actor(card);
            if (team == null || card.getMatchTime() == null || !"YELLOW_CARD".equals(PlayRules.code(card))) {
                continue;
            }
            cards.add(team, 1);
            int start = card.getMatchTime();
            int end = start + sinBinMinutes(card) * ZoneGrid.SECONDS_PER_MINUTE;
            for (Event event : events) {
                EventPossession scorer = PlayRules.scoringTeam(event);
                if (scorer == null || event.getMatchTime() == null
                        || event.getMatchTime() < start || event.getMatchTime() >= end) {
                    continue;
                }
                (scorer == team ? pointsFor : pointsAgainst).add(team, PlayRules.points(event));
            }
        }
        return new SinBin(cards.toCount(), pointsFor.toCount(), pointsAgainst.toCount());
    }

    private static int sinBinMinutes(Event card) {
        Object value = card.getAttributes() == null ? null : card.getAttributes().get(SIN_BIN_DURATION_KEY);
        if (value instanceof Number number && number.intValue() > 0) {
            return number.intValue();
        }
        return DEFAULT_SIN_BIN_MINUTES;
    }

    private static <E extends Enum<E>> Map<E, Tally> tallies(Class<E> type) {
        Map<E, Tally> result = new EnumMap<>(type);
        Arrays.stream(type.getEnumConstants()).forEach(key -> result.put(key, new Tally()));
        return result;
    }

    private static <E extends Enum<E>> List<CategoryCount> categories(Map<E, Tally> tallies) {
        return tallies.entrySet().stream()
                .map(entry -> new CategoryCount(entry.getKey().name(), entry.getValue().own, entry.getValue().opponent))
                .toList();
    }

    /** Acumulador por equipo. */
    private static final class Tally {
        private int own;
        private int opponent;

        void add(EventPossession team, int amount) {
            if (team == EventPossession.OWN) {
                own += amount;
            } else if (team == EventPossession.OPPONENT) {
                opponent += amount;
            }
        }

        TeamCount toCount() {
            return new TeamCount(own, opponent);
        }

        /** Este valor dividido el otro, con un decimal; null si el divisor es 0. */
        TeamRate ratio(Tally divisor) {
            return new TeamRate(divide(own, divisor.own), divide(opponent, divisor.opponent));
        }

        private static Double divide(int value, int divisor) {
            return divisor == 0 ? null : Math.round(value * 10.0 / divisor) / 10.0;
        }
    }
}
