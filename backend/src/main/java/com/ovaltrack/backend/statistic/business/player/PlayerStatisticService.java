package com.ovaltrack.backend.statistic.business.player;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.config.exceptions.EntityNotFoundException;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.division.domain.DivisionPlayer;
import com.ovaltrack.backend.division.repository.DivisionPlayerRepository;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.repository.EventRepository;
import com.ovaltrack.backend.match.business.MatchService;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.match.domain.MatchPlayer;
import com.ovaltrack.backend.match.domain.MatchStatus;
import com.ovaltrack.backend.match.repository.MatchPlayerRepository;
import com.ovaltrack.backend.match.repository.MatchRepository;
import com.ovaltrack.backend.person.business.PersonService;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.statistic.business.player.PlayerStatisticsAccess.Viewer;
import com.ovaltrack.backend.statistic.domain.dto.PlayerMatchStatisticsDTO;
import com.ovaltrack.backend.statistic.domain.dto.PlayerMatchSummaryDTO;
import com.ovaltrack.backend.statistic.domain.dto.PlayerMetricsDTO;
import com.ovaltrack.backend.statistic.domain.dto.PlayerStatisticsDTO;
import com.ovaltrack.backend.statistic.domain.dto.PlayerZoneMapDTO;
import com.ovaltrack.backend.zone.business.EventZoneResolver;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.ZoneCell;
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Estadísticas de un jugador: generales (división + temporada) y de un partido, comparadas con el promedio del plantel
 * de su división. Lee eventos, planteles y tramos en pocas consultas y delega los cálculos en {@link PlayerMetricsCalculator}.
 */
@Service
@RequiredArgsConstructor
public class PlayerStatisticService {

    private final PersonService personService;
    private final MatchService matchService;
    private final MatchRepository matchRepository;
    private final MatchPlayerRepository matchPlayerRepository;
    private final DivisionPlayerRepository divisionPlayerRepository;
    private final EventRepository eventRepository;
    private final ZoneAssignmentRepository zoneAssignmentRepository;
    private final EventZoneResolver zoneResolver;
    private final PlayerMetricsCalculator calculator;
    private final PlayerStatisticsAccess access;

    /**
     * Sin `divisionId`, la división del último partido jugado (o la activa); sin `season`, la temporada más reciente
     * con partidos del jugador en esa división. La temporada es el año calendario de la fecha del partido.
     */
    @Transactional(readOnly = true)
    public PlayerStatisticsDTO playerStatistics(UUID personId, UUID divisionId, Integer season, Authentication authentication) {
        Viewer viewer = access.viewerOf(personId, authentication);
        Person person = findPersonOrFail(personId);

        List<MatchPlayer> played = new ArrayList<>(matchPlayerRepository.findPlayedByPersonId(personId));
        List<Division> candidates = candidateDivisions(personId, played);
        List<Division> divisions = access.accessible(viewer, candidates);
        if (divisions.isEmpty()) {
            if (!viewer.self()) {
                throw new AccessDeniedException("Acceso denegado: el jugador no pertenece a una división a su cargo");
            }
            return emptyStatistics(person, null, List.of());
        }

        Division division = chooseDivision(divisionId, candidates, divisions);
        List<MatchPlayer> playedInDivision = played.stream()
                .filter(mp -> mp.getMatch().getDivision().getId().equals(division.getId()))
                .toList();
        List<Integer> seasons = playedInDivision.stream()
                .map(mp -> mp.getMatch().getDate().getYear())
                .distinct()
                .sorted(Comparator.reverseOrder())
                .toList();
        Integer effectiveSeason = season != null ? season : seasons.stream().findFirst().orElse(null);
        if (effectiveSeason == null) {
            return emptyStatistics(person, division, divisions);
        }

        List<MatchPlayer> playedInSeason = playedInDivision.stream()
                .filter(mp -> mp.getMatch().getDate().getYear() == effectiveSeason)
                .toList();

        // Plantel: todos los partidos finalizados de la división en la temporada (aunque el jugador no haya jugado).
        LocalDate seasonStart = LocalDate.of(effectiveSeason, 1, 1);
        List<UUID> squadMatchIds = matchRepository.findFinishedByDivisionIdAndDateRange(
                        division.getId(), seasonStart.atStartOfDay(), seasonStart.plusYears(1).atStartOfDay())
                .stream().map(Match::getId).toList();
        MatchData data = loadMatchData(squadMatchIds);

        List<PlayerMatchSummaryDTO> matches = new ArrayList<>();
        PlayerMetricsDTO totals = PlayerMetricsDTO.EMPTY;
        List<Event> playerEvents = new ArrayList<>();
        for (MatchPlayer matchPlayer : playedInSeason) {
            List<Event> events = data.eventsOf(matchPlayer.getMatch().getId(), personId);
            PlayerMetricsDTO metrics = calculator.metrics(events);
            totals = totals.plus(metrics);
            playerEvents.addAll(events);
            matches.add(summary(matchPlayer, metrics));
        }

        SquadTotals squad = squadTotals(data, squadMatchIds);
        Map<UUID, List<ZoneAssignment>> zonesByMatch = data.zonesByMatch();
        List<UUID> playedMatchIds = playedInSeason.stream().map(mp -> mp.getMatch().getId()).toList();

        return new PlayerStatisticsDTO(
                person.getId(),
                fullName(person),
                division.getId(),
                division.getName(),
                effectiveSeason,
                seasons,
                divisionOptions(divisions),
                matches,
                totals,
                calculator.compare(totals, matches.size(), squad.metrics(), squad.appearances()),
                zoneMap(playerEvents, zonesByMatch, playedMatchIds),
                calculator.actions(playerEvents));
    }

    /** Partido finalizado en el que el jugador integró el plantel, comparado con el resto del plantel de ese partido. */
    @Transactional(readOnly = true)
    public PlayerMatchStatisticsDTO playerMatchStatistics(UUID personId, UUID matchId, Authentication authentication) {
        Viewer viewer = access.viewerOf(personId, authentication);
        Person person = findPersonOrFail(personId);
        Match match = matchService.findMatchEntityById(matchId);
        if (match == null) {
            throw new EntityNotFoundException("Partido no encontrado");
        }
        if (match.getDivision() == null) {
            throw new AccessDeniedException("Acceso denegado: el partido no pertenece a una división");
        }
        access.validate(viewer, match.getDivision());
        if (match.getStatus() != MatchStatus.FINISHED) {
            throw new BusinessException("Las estadísticas del jugador solo están disponibles con el partido finalizado");
        }

        MatchData data = loadMatchData(List.of(matchId));
        MatchPlayer matchPlayer = data.rosterOf(matchId).stream()
                .filter(mp -> mp.getDivisionPlayer().getPerson().getId().equals(personId))
                .findFirst()
                .orElseThrow(() -> new EntityNotFoundException("El jugador no integró el plantel de ese partido"));

        List<Event> events = data.eventsOf(matchId, personId);
        PlayerMetricsDTO metrics = calculator.metrics(events);
        SquadTotals squad = squadTotals(data, List.of(matchId));

        return new PlayerMatchStatisticsDTO(
                person.getId(),
                fullName(person),
                match.getDivision().getId(),
                match.getDivision().getName(),
                summary(matchPlayer, metrics),
                squad.appearances(),
                calculator.compare(metrics, 1, squad.metrics(), squad.appearances()),
                zoneMap(events, data.zonesByMatch(), List.of(matchId)),
                calculator.actions(events));
    }

    private Person findPersonOrFail(UUID personId) {
        Person person = personService.findPersonEntityById(personId);
        if (person == null) {
            throw new EntityNotFoundException("Jugador no encontrado");
        }
        return person;
    }

    /** Divisiones donde jugó (de la más reciente a la más antigua) y luego las activas, sin repetir. */
    private List<Division> candidateDivisions(UUID personId, List<MatchPlayer> played) {
        Map<UUID, Division> result = new LinkedHashMap<>();
        played.forEach(mp -> result.putIfAbsent(mp.getMatch().getDivision().getId(), mp.getMatch().getDivision()));
        divisionPlayerRepository.findActiveByPersonId(personId).stream()
                .map(DivisionPlayer::getDivision)
                .forEach(division -> result.putIfAbsent(division.getId(), division));
        return new ArrayList<>(result.values());
    }

    private Division chooseDivision(UUID divisionId, List<Division> candidates, List<Division> accessible) {
        if (divisionId == null) {
            return accessible.get(0);
        }
        Optional<Division> requested = accessible.stream().filter(d -> d.getId().equals(divisionId)).findFirst();
        if (requested.isPresent()) {
            return requested.get();
        }
        if (candidates.stream().anyMatch(d -> d.getId().equals(divisionId))) {
            throw new AccessDeniedException("Acceso denegado: no puede ver esa división");
        }
        throw new EntityNotFoundException("El jugador no tiene partidos ni pertenencia en esa división");
    }

    private MatchData loadMatchData(List<UUID> matchIds) {
        if (matchIds.isEmpty()) {
            return new MatchData(Map.of(), Map.of(), Map.of());
        }
        Map<UUID, List<Event>> events = eventRepository.findEventsByMatchIds(matchIds).stream()
                .filter(event -> event.getPlayer() != null)
                .collect(Collectors.groupingBy(event -> event.getMatch().getId()));
        Map<UUID, List<MatchPlayer>> rosters = matchPlayerRepository.findRosterByMatchIds(matchIds).stream()
                .collect(Collectors.groupingBy(mp -> mp.getMatch().getId()));
        Map<UUID, List<ZoneAssignment>> zones = zoneAssignmentRepository.findByMatchIdInOrderByPeriodAscStartMinuteAsc(matchIds)
                .stream()
                .collect(Collectors.groupingBy(zone -> zone.getMatch().getId()));
        return new MatchData(events, rosters, zones);
    }

    /** Suma de las métricas de cada jugador del plantel en cada partido; cada jugador en un partido es una aparición. */
    private SquadTotals squadTotals(MatchData data, List<UUID> matchIds) {
        PlayerMetricsDTO total = PlayerMetricsDTO.EMPTY;
        int appearances = 0;
        for (UUID matchId : matchIds) {
            Map<UUID, List<Event>> eventsByPlayer = data.events().getOrDefault(matchId, List.of()).stream()
                    .collect(Collectors.groupingBy(event -> event.getPlayer().getId()));
            for (MatchPlayer matchPlayer : data.rosterOf(matchId)) {
                UUID playerId = matchPlayer.getDivisionPlayer().getPerson().getId();
                total = total.plus(calculator.metrics(eventsByPlayer.getOrDefault(playerId, List.of())));
                appearances++;
            }
        }
        return new SquadTotals(total, appearances);
    }

    private PlayerZoneMapDTO zoneMap(List<Event> playerEvents, Map<UUID, List<ZoneAssignment>> zonesByMatch,
                                     Collection<UUID> matchIds) {
        Map<ZoneCell, Integer> counts = new LinkedHashMap<>();
        int unzoned = 0;
        for (Event event : playerEvents) {
            List<ZoneAssignment> assignments = zonesByMatch.getOrDefault(event.getMatch().getId(), List.of());
            Optional<ZoneCell> cell = zoneResolver.resolve(event.getPeriod(), event.getMatchTime(), assignments);
            if (cell.isPresent()) {
                counts.merge(cell.get(), 1, Integer::sum);
            } else {
                unzoned++;
            }
        }
        List<PlayerZoneMapDTO.Cell> cells = counts.entrySet().stream()
                .map(entry -> new PlayerZoneMapDTO.Cell(entry.getKey().row(), entry.getKey().col(), entry.getValue()))
                .sorted(Comparator.comparingInt(PlayerZoneMapDTO.Cell::row).thenComparingInt(PlayerZoneMapDTO.Cell::col))
                .toList();
        int zoned = cells.stream().mapToInt(PlayerZoneMapDTO.Cell::count).sum();
        int matchesWithZones = (int) matchIds.stream().filter(id -> !zonesByMatch.getOrDefault(id, List.of()).isEmpty()).count();
        return new PlayerZoneMapDTO(cells, zoned, unzoned, matchesWithZones);
    }

    private PlayerMatchSummaryDTO summary(MatchPlayer matchPlayer, PlayerMetricsDTO metrics) {
        Match match = matchPlayer.getMatch();
        return new PlayerMatchSummaryDTO(
                match.getId(),
                match.getDate(),
                match.getOpponent() != null ? match.getOpponent().getName() : null,
                match.getHomeScore(),
                match.getAwayScore(),
                matchPlayer.getRole(),
                matchPlayer.getNumber(),
                metrics);
    }

    private PlayerStatisticsDTO emptyStatistics(Person person, Division division, List<Division> divisions) {
        return new PlayerStatisticsDTO(
                person.getId(),
                fullName(person),
                division != null ? division.getId() : null,
                division != null ? division.getName() : null,
                null,
                List.of(),
                divisionOptions(divisions),
                List.of(),
                PlayerMetricsDTO.EMPTY,
                calculator.compare(PlayerMetricsDTO.EMPTY, 0, PlayerMetricsDTO.EMPTY, 0),
                new PlayerZoneMapDTO(List.of(), 0, 0, 0),
                List.of());
    }

    private static List<PlayerStatisticsDTO.Division> divisionOptions(List<Division> divisions) {
        return divisions.stream().map(d -> new PlayerStatisticsDTO.Division(d.getId(), d.getName())).toList();
    }

    private static String fullName(Person person) {
        return java.util.stream.Stream.of(person.getFirstName(), person.getLastName())
                .filter(Objects::nonNull)
                .collect(Collectors.joining(" "))
                .trim();
    }

    /** Eventos con jugador, planteles y tramos de un conjunto de partidos, agrupados por partido. */
    private record MatchData(Map<UUID, List<Event>> events, Map<UUID, List<MatchPlayer>> rosters,
                             Map<UUID, List<ZoneAssignment>> zonesByMatch) {
        List<Event> eventsOf(UUID matchId, UUID personId) {
            return events.getOrDefault(matchId, List.of()).stream()
                    .filter(event -> event.getPlayer().getId().equals(personId))
                    .toList();
        }

        List<MatchPlayer> rosterOf(UUID matchId) {
            return rosters.getOrDefault(matchId, List.of());
        }
    }

    private record SquadTotals(PlayerMetricsDTO metrics, int appearances) {
    }
}
