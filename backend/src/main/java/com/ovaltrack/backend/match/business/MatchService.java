package com.ovaltrack.backend.match.business;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.club.business.ClubService;
import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.config.exceptions.EntityNotFoundException;
import com.ovaltrack.backend.division.business.DivisionPlayerService;
import com.ovaltrack.backend.division.business.DivisionService;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.division.domain.DivisionPlayer;
import com.ovaltrack.backend.division.repository.DivisionPlayerRepository;
import com.ovaltrack.backend.event.domain.dto.EventDTOMapper;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.repository.EventRepository;
import com.ovaltrack.backend.event.repository.EventTypeRepository;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.match.domain.MatchPlayer;
import com.ovaltrack.backend.match.domain.MatchPlayerRole;
import com.ovaltrack.backend.match.domain.MatchPlayerStatus;
import com.ovaltrack.backend.match.domain.MatchStatus;
import com.ovaltrack.backend.match.domain.Opponent;
import com.ovaltrack.backend.match.domain.dto.LiveMatchBootstrapDTO;
import com.ovaltrack.backend.match.domain.dto.LiveMatchStateDTO;
import com.ovaltrack.backend.match.domain.dto.MatchCreationDTO;
import com.ovaltrack.backend.match.domain.dto.MatchDTOMapper;
import com.ovaltrack.backend.match.domain.dto.MatchResponseDTO;
import com.ovaltrack.backend.match.domain.dto.MatchRosterEntryDTO;
import com.ovaltrack.backend.match.domain.dto.MatchRosterPlayerDTO;
import com.ovaltrack.backend.match.domain.dto.MatchUpdateDTO;
import com.ovaltrack.backend.match.domain.dto.PlayerMatchResponseDTO;
import com.ovaltrack.backend.match.domain.dto.RosterBootstrapDTO;
import com.ovaltrack.backend.match.domain.dto.RosterDTO;
import com.ovaltrack.backend.match.domain.event.MatchPeriodClosedEvent;
import com.ovaltrack.backend.match.repository.MatchPlayerRepository;
import com.ovaltrack.backend.match.repository.MatchRepository;
import com.ovaltrack.backend.match.repository.OpponentRepository;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class MatchService {

    private static final Logger logger = LoggerFactory.getLogger(MatchService.class);

    private static final int MATCH_DURATION_MINUTES = 90;
    @Autowired
    private DivisionPlayerRepository divisionPlayerRepository;

    @Autowired
    private DivisionService divisionService;

    @Autowired
    private MatchPlayerRepository matchPlayerRepository;

    @Autowired
    private UserService userService;

    private final MatchRepository matchRepository;
    private final EventRepository eventRepository;
    private final EventTypeRepository eventTypeRepository;
    private final OpponentRepository opponentRepository;
    private final MatchSecurityValidator matchSecurityValidator;
    private final ApplicationEventPublisher eventPublisher;
    private final LineupReplayer lineupReplayer;

    private final ClubService clubService;
    private final DivisionPlayerService divisionPlayerService;

    @Transactional(readOnly = true)
    public Collection<MatchResponseDTO> findAllMatchesByClubId(UUID clubId) {
        if (clubService.findClubEntityById(clubId) == null) {
            throw new BusinessException("Club no encontrado");
        }
        return matchRepository.findAllMatchesByClubId(clubId).stream().map(MatchDTOMapper::toResponseDTO).toList();
    }

    @Transactional(readOnly = true)
    public Collection<MatchResponseDTO> findAllMatchesByDivisionId(UUID divisionId) {
        if (divisionService.findDivisionEntityById(divisionId) == null) {
            throw new BusinessException("Division no encontrada");
        }
        return matchRepository.findAllMatchesByDivisionId(divisionId).stream().map(MatchDTOMapper::toResponseDTO)
                .toList();
    }

    public MatchResponseDTO findMatchById(UUID matchId) {
        Match result = matchRepository.findById(matchId).orElse(null);
        return MatchDTOMapper.toResponseDTO(result);
    }

    @Transactional(readOnly = true)
    public MatchResponseDTO getLiveMatchState(UUID matchId) {
        Match match = requireMatch(matchId);

        return MatchDTOMapper.toResponseDTO(match);
    }

    @Transactional(readOnly = true)
    public LiveMatchBootstrapDTO getLiveMatchBootstrap(UUID matchId) {
        Match match = requireMatch(matchId);

        return new LiveMatchBootstrapDTO(
                MatchDTOMapper.toResponseDTO(match),
                eventRepository.findEventsByMatchId(matchId).stream()
                        .map(EventDTOMapper::toResponseDTO)
                        .toList(),
                eventTypeRepository.findByIsActiveTrueOrderByNameAscIdAsc().stream()
                        .map(EventDTOMapper::toResponseDTO)
                        .toList());
    }

    @Transactional
    public MatchResponseDTO updateLiveMatchState(UUID matchId, LiveMatchStateDTO request) {
        Match match = requireMatch(matchId);

        match.setClockElapsedSeconds(request.clockElapsedSeconds());
        match.setClockPaused(request.clockPaused());
        match.setCurrentPossession(request.currentPossession());
        match.setClockUpdatedAt(LocalDateTime.now());

        return MatchDTOMapper.toResponseDTO(matchRepository.save(match));
    }

    public Match findMatchEntityById(UUID matchId) {
        return matchRepository.findById(matchId).orElse(null);
    }

    private Match requireMatch(UUID matchId) {
        return matchRepository.findById(matchId)
                .orElseThrow(() -> new EntityNotFoundException("Partido no encontrado"));
    }

    @Transactional
    public Match findMatchEntityByIdForUpdate(UUID matchId) {
        return matchRepository.findByIdForUpdate(matchId).orElse(null);
    }

    @Transactional
    public MatchResponseDTO saveMatch(MatchCreationDTO request) {
        Division division = divisionService.findDivisionEntityById(request.divisionId());
        if (division == null) {
            throw new BusinessException("No se puede asociar un partido a una division que no existe");
        }

        LocalDateTime startDate = request.date();
        LocalDateTime endDate = startDate.plusMinutes(MATCH_DURATION_MINUTES);
        LocalDateTime overlapStart = startDate.minusMinutes(MATCH_DURATION_MINUTES);

        if (matchRepository.findByDivisionIdAndTimeFrame(
                division.getId(), overlapStart, endDate) != null) {
            throw new BusinessException("Ya existe un partido planeado en esa franja horaria");
        }

        Opponent opponent = opponentRepository.findById(request.opponentId())
                .orElseThrow(() -> new EntityNotFoundException("Oponente no encontrado"));

        Match match = new Match();
        match.setDate(request.date());
        match.setDivision(division);
        match.setOpponent(opponent);
        match.setStatus(MatchStatus.EMPTY_ROSTER);

        match = matchRepository.save(match);
        return MatchDTOMapper.toResponseDTO(match);
    }

    @Transactional
    public MatchResponseDTO updateMatch(UUID matchId, MatchUpdateDTO request) {
        Match match = requireMatch(matchId);

        Opponent opponent = opponentRepository.findById(request.opponentId())
                .orElseThrow(() -> new EntityNotFoundException("Oponente no encontrado"));

        match.setDate(request.date());
        match.setOpponent(opponent);

        return MatchDTOMapper.toResponseDTO(matchRepository.save(match));
    }

    @Transactional
    public MatchResponseDTO changeMatchStatus(UUID matchId, MatchStatus matchStatus) {
        return changeMatchStatus(matchId, matchStatus, null);
    }

    /**
     * @param occurredAt momento real de la transición informado por el cliente; si
     *                   es null se usa
     *                   la hora del servidor.
     */
    @Transactional
    public MatchResponseDTO changeMatchStatus(UUID matchId, MatchStatus matchStatus, Instant occurredAt) {
        Match match = requireMatch(matchId);

        validateStatusChange(match, matchStatus);
        applyStatusChange(match, matchStatus, resolveTransitionTime(occurredAt));

        return MatchDTOMapper.toResponseDTO(matchRepository.save(match));
    }

    private void validateStatusChange(Match match, MatchStatus targetStatus) {
        MatchStatus currentStatus = match.getStatus();

        if (currentStatus == targetStatus) {
            throw new BusinessException("No se puede asignar el mismo estado al partido");
        }

        if (currentStatus == MatchStatus.CANCELLED) {
            throw new BusinessException("No se puede modificar un partido cancelado");
        }

        if (currentStatus == MatchStatus.FINISHED && targetStatus == MatchStatus.IN_PROGRESS) {
            throw new BusinessException("No se puede reabrir un partido que ya termino");
        }

        if (targetStatus == MatchStatus.IN_PROGRESS
                && (currentStatus == MatchStatus.EMPTY_ROSTER || currentStatus == MatchStatus.NOT_STARTED)) {
            validateRosterForStart(match);
            validateNoOtherLiveMatch(match);
        }

        if (currentStatus == MatchStatus.EMPTY_ROSTER && targetStatus == MatchStatus.FINISHED) {
            throw new BusinessException("No se puede finalizar un partido cuyo plantel no fue asignado.");
        }

        if (currentStatus == MatchStatus.FINISHED && targetStatus == MatchStatus.CANCELLED) {
            throw new BusinessException("No se puede cancelar un partido que ya termino");
        }
    }

    private void validateNoOtherLiveMatch(Match match) {
        matchRepository.findOtherLiveMatchesInDivision(match.getDivision().getId(), match.getId())
                .stream()
                .findFirst()
                .ifPresent(live -> {
                    throw new BusinessException("La division ya tiene un partido en curso contra "
                            + live.getOpponent().getName()
                            + ". Finalizalo o cancelalo antes de iniciar otro.");
                });
    }

    private void validateRosterForStart(Match match) {
        long titularCount = match.getRoster().stream()
                .filter(player -> player.getRole() == MatchPlayerRole.TITULAR)
                .count();
        if (titularCount != 15) {
            throw new BusinessException("No se puede iniciar el partido sin los 15 titulares registrados.");
        }
    }

    private void applyStatusChange(Match match, MatchStatus targetStatus, LocalDateTime transitionTime) {
        match.setStatus(targetStatus);
        if (targetStatus == MatchStatus.IN_PROGRESS && match.getStartedAt() == null) {
            match.setStartedAt(transitionTime);
        }
        if (targetStatus == MatchStatus.FINISHED) {
            LocalDateTime startedAt = match.getStartedAt();
            match.setFinishedAt(startedAt != null && transitionTime.isBefore(startedAt) ? startedAt : transitionTime);
        }
    }

    private LocalDateTime resolveTransitionTime(Instant occurredAt) {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        if (occurredAt == null) {
            return now;
        }
        LocalDateTime clientTime = LocalDateTime.ofInstant(occurredAt, ZoneOffset.UTC);
        return clientTime.isAfter(now) ? now : clientTime;
    }

    @Transactional
    public void saveMatchRoster(UUID matchId, List<MatchRosterEntryDTO> titulares,
            List<MatchRosterEntryDTO> suplentes, Authentication authentication) {
        Match match = findMatchEntityByIdForUpdate(matchId);
        if (match == null) {
            throw new EntityNotFoundException("Partido no encontrado");
        }
        matchSecurityValidator.validateCanManageMatch(match, authentication);
        if (match.getStatus() == MatchStatus.IN_PROGRESS
                || match.getStatus() == MatchStatus.HALFTIME
                || match.getStatus() == MatchStatus.FINISHED
                || match.getStatus() == MatchStatus.CANCELLED) {
            throw new BusinessException("No se puede modificar el plantel después de iniciar el partido");
        }
        List<MatchRosterEntryDTO> starters = Objects.requireNonNullElse(titulares, List.of());
        List<MatchRosterEntryDTO> substitutes = Objects.requireNonNullElse(suplentes, List.of());
        if (starters.size() != 15) {
            throw new BusinessException("El plantel debe tener exactamente 15 titulares");
        }
        if (substitutes.size() > 8) {
            throw new BusinessException("El plantel no puede tener más de 8 suplentes");
        }

        Map<UUID, DivisionPlayer> divisionPlayersByPersonId = new HashMap<>();
        for (DivisionPlayer dp : divisionPlayerRepository.findByDivisionId(match.getDivision().getId())) {
            divisionPlayersByPersonId.putIfAbsent(dp.getPerson().getId(), dp);
        }

        List<MatchPlayer> nuevosJugadores = new ArrayList<>();
        Set<UUID> assignedPersonIds = new HashSet<>();
        Set<Integer> assignedNumbers = new HashSet<>();
        addRosterPlayers(match, starters, MatchPlayerRole.TITULAR, divisionPlayersByPersonId, assignedPersonIds,
                assignedNumbers,
                nuevosJugadores);
        addRosterPlayers(match, substitutes, MatchPlayerRole.SUPLENTE, divisionPlayersByPersonId, assignedPersonIds,
                assignedNumbers,
                nuevosJugadores);

        matchPlayerRepository.deleteByMatch(match);
        matchPlayerRepository.flush();
        if (match.getStatus() == null || match.getStatus() == MatchStatus.EMPTY_ROSTER) {
            match.setStatus(MatchStatus.NOT_STARTED);
        }
        matchRepository.save(match);

        matchPlayerRepository.saveAll(nuevosJugadores);
    }

    private void addRosterPlayers(
            Match match,
            List<MatchRosterEntryDTO> entries,
            MatchPlayerRole role,
            Map<UUID, DivisionPlayer> divisionPlayersByPersonId,
            Set<UUID> assignedPersonIds,
            Set<Integer> assignedNumbers,
            List<MatchPlayer> roster) {
        int slotOrder = 0;
        for (MatchRosterEntryDTO entry : entries) {
            if (entry == null || entry.playerId() == null) {
                throw new BusinessException("Todos los jugadores del plantel son obligatorios");
            }
            int number = parseRosterNumber(entry.number());
            if (!assignedNumbers.add(number)) {
                throw new BusinessException("Los números del plantel no pueden repetirse");
            }
            UUID personId = entry.playerId();
            DivisionPlayer divisionPlayer = divisionPlayersByPersonId.get(personId);
            if (divisionPlayer == null) {
                throw new BusinessException("El jugador no pertenece a la división del partido");
            }
            if (!assignedPersonIds.add(personId)) {
                throw new BusinessException("Un jugador no puede repetirse en el plantel");
            }
            int order = slotOrder++;
            roster.add(MatchPlayer.builder()
                    .match(match)
                    .divisionPlayer(divisionPlayer)
                    .role(role)
                    .slotOrder(order)
                    .number(number)
                    .fieldStatus(role == MatchPlayerRole.TITULAR
                            ? MatchPlayerStatus.EN_CANCHA
                            : MatchPlayerStatus.EN_BANCO)
                    .fieldSlot(role == MatchPlayerRole.TITULAR ? order + 1 : null)
                    .build());
        }
    }

    private int parseRosterNumber(JsonNode value) {
        if (value == null || !value.isIntegralNumber() || value.asLong() <= 0
                || value.asLong() > Integer.MAX_VALUE) {
            throw new BusinessException("El número del jugador debe ser un entero positivo");
        }
        return value.intValue();
    }

    /**
     * Valida un cambio contra el plantel del partido. El plantel guardado es la
     * formación inicial y
     * no se modifica: quién está en cancha se deriva de los eventos SUBSTITUTION en
     * orden, así un
     * cambio cargado offline o borrado después no deja el plantel desfasado.
     */
    public void validateSubstitution(Match match, Event candidate) {
        if (match == null || candidate == null) {
            throw new BusinessException("El cambio requiere jugadores de entrada y salida");
        }
        List<Event> events = new ArrayList<>(eventRepository.findEventsByMatchId(match.getId()));
        events.removeIf(event -> event.getId() != null && event.getId().equals(candidate.getId()));
        events.add(candidate);
        lineupReplayer.replay(match, events);
    }

    /** Resuelve por ID cuando existe; el número solo es compatible con eventos históricos sin ID. */
    public MatchPlayer findRosterPlayer(Match match, Map<String, Object> attributes,
            String idKey, String slotKey) {
        Event candidate = Event.builder().id(UUID.randomUUID()).attributes(attributes).build();
        return lineupReplayer.resolvePlayer(match, candidate, idKey, slotKey);
    }

    /**
     * Reconstruye y persiste la ubicación actual de cada jugador a partir de la
     * formación inicial y las sustituciones propias activas.
     */
    @Transactional
    public void recalculateLineup(Match match) {
        if (match == null || match.getRoster() == null) {
            return;
        }
        lineupReplayer.replay(match, new ArrayList<>(eventRepository.findEventsByMatchId(match.getId())));
        matchPlayerRepository.saveAll(match.getRoster());
    }

    @Transactional(readOnly = true)
    public RosterDTO getSavedRoster(UUID matchId, Authentication authentication) {
        validateCanViewMatch(matchId, authentication);
        return getSavedRoster(matchId);
    }

    @Transactional(readOnly = true)
    public RosterDTO getSavedRoster(UUID matchId) {
        List<MatchPlayer> roster = List.copyOf(matchPlayerRepository.findRosterByMatchIds(List.of(matchId)));

        List<UUID> startingPlayers = roster.stream()
                .filter(mp -> mp.getRole() == MatchPlayerRole.TITULAR)
                .map(mp -> mp.getDivisionPlayer().getPerson().getId())
                .toList();

        List<UUID> substitutePlayers = roster.stream()
                .filter(mp -> mp.getRole() == MatchPlayerRole.SUPLENTE)
                .map(mp -> mp.getDivisionPlayer().getPerson().getId())
                .toList();

        return new RosterDTO(startingPlayers, substitutePlayers);
    }

    @Transactional(readOnly = true)
    public List<MatchRosterPlayerDTO> getMatchRosterPlayers(UUID matchId, Authentication authentication) {
        validateCanViewMatch(matchId, authentication);
        return getMatchRosterPlayers(matchId);
    }

    /** Partido, jugadores de su division y plantel guardado en una sola transaccion de lectura. */
    @Transactional(readOnly = true)
    public RosterBootstrapDTO getRosterBootstrap(UUID matchId, Authentication authentication) {
        Match match = requireMatch(matchId);
        matchSecurityValidator.validateCanManageMatch(match, authentication);

        return new RosterBootstrapDTO(
                MatchDTOMapper.toResponseDTO(match),
                divisionPlayerService.findAvailablePlayersByDivisionId(match.getDivision().getId()),
                getMatchRosterPlayers(matchId));
    }

    private void validateCanViewMatch(UUID matchId, Authentication authentication) {
        matchSecurityValidator.validateCanViewMatch(requireMatch(matchId), authentication);
    }

    @Transactional(readOnly = true)
    public List<MatchRosterPlayerDTO> getMatchRosterPlayers(UUID matchId) {
        Match match = requireMatch(matchId);

        return matchPlayerRepository.findRosterByMatchIds(List.of(matchId)).stream()
                .map(this::toMatchRosterPlayerDTO)
                .sorted(Comparator.comparing((MatchRosterPlayerDTO p) -> p.getRole() == MatchPlayerRole.TITULAR ? 0 : 1)
                        .thenComparing(p -> p.getFullName(), String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private MatchRosterPlayerDTO toMatchRosterPlayerDTO(MatchPlayer mp) {
        DivisionPlayer dp = mp.getDivisionPlayer();
        var person = dp.getPerson();
        String fullName = ((person.getFirstName() != null ? person.getFirstName() : "") + " "
                + (person.getLastName() != null ? person.getLastName() : "")).trim();

        return MatchRosterPlayerDTO.builder()
                .id(person.getId())
                .fullName(fullName.isEmpty() ? "Sin Nombre" : fullName)
                .role(mp.getRole())
                .position(dp.getPosition())
                .number(mp.getNumber())
                .fieldStatus(mp.getFieldStatus())
                .fieldSlot(mp.getFieldSlot())
                .slotOrder(mp.getSlotOrder())
                .build();
    }

    @Transactional
    public MatchResponseDTO closeFirstHalf(UUID matchId, Authentication authentication) {
        Match match = requireMatch(matchId);

        matchSecurityValidator.validateCanManageMatch(match, authentication);

        match.closeFirstHalf();
        Match updatedMatch = matchRepository.save(match);

        eventPublisher.publishEvent(new MatchPeriodClosedEvent(updatedMatch.getId(), 1, LocalDateTime.now()));

        return MatchDTOMapper.toResponseDTO(updatedMatch);
    }

    @Transactional
    public MatchResponseDTO startSecondHalf(UUID matchId, Authentication authentication) {
        Match match = requireMatch(matchId);

        matchSecurityValidator.validateCanManageMatch(match, authentication);

        match.startSecondHalf();
        Match updatedMatch = matchRepository.save(match);

        return MatchDTOMapper.toResponseDTO(updatedMatch);
    }

    @Transactional(readOnly = true)
    public Collection<PlayerMatchResponseDTO> findMyPlayedMatches(Authentication auth) {
        if (auth == null || auth.getName() == null) {
            throw new EntityNotFoundException("No hay una sesión autenticada activa");
        }

        String email = auth.getName();
        User user = userService.findUserByEmail(email);
        if (user == null) {
            throw new EntityNotFoundException("Usuario no encontrado con email: " + email);
        }
        if (user.getPerson() == null || user.getPerson().getId() == null) {
            return List.of();
        }
        return matchPlayerRepository.findPlayedByPersonId(user.getPerson().getId())
                .stream()
                .map(MatchDTOMapper::toPlayerMatchResponseDTO)
                .toList();
    }
}
