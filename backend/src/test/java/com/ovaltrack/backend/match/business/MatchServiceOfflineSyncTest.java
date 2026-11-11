package com.ovaltrack.backend.match.business;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.IntStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.division.domain.DivisionPlayer;
import com.ovaltrack.backend.division.repository.DivisionPlayerRepository;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.match.domain.MatchPlayer;
import com.ovaltrack.backend.match.domain.MatchPlayerRole;
import com.ovaltrack.backend.match.domain.MatchStatus;
import com.ovaltrack.backend.match.domain.dto.MatchRosterEntryDTO;
import com.ovaltrack.backend.match.domain.dto.MatchResponseDTO;
import com.ovaltrack.backend.match.repository.MatchPlayerRepository;
import com.ovaltrack.backend.match.repository.MatchRepository;
import com.ovaltrack.backend.person.domain.Person;

@ExtendWith(MockitoExtension.class)
@DisplayName("MatchService - robustez de la sincronización offline")
class MatchServiceOfflineSyncTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private MatchPlayerRepository matchPlayerRepository;

    @Mock
    private DivisionPlayerRepository divisionPlayerRepository;

    @InjectMocks
    private MatchService matchService;

    private final UUID matchId = UUID.randomUUID();

    @BeforeEach
    void injectFieldDependencies() {
        ReflectionTestUtils.setField(matchService, "matchPlayerRepository", matchPlayerRepository);
        ReflectionTestUtils.setField(matchService, "divisionPlayerRepository", divisionPlayerRepository);
    }

    private Match matchWithStatus(MatchStatus status) {
        Match match = Match.builder().id(matchId).status(status).roster(new ArrayList<>()).build();
        lenient().when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        return match;
    }

    private void saveReturnsArgument() {
        when(matchRepository.save(any(Match.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    @DisplayName("un start atrasado no reabre un partido cancelado")
    void start_onCancelledMatch_isRejected() {
        matchWithStatus(MatchStatus.CANCELLED);

        assertThrows(BusinessException.class,
                () -> matchService.changeMatchStatus(matchId, MatchStatus.IN_PROGRESS));
        verify(matchRepository, never()).save(any());
    }

    @Test
    @DisplayName("un start atrasado no reabre un partido finalizado")
    void start_onFinishedMatch_isRejected() {
        matchWithStatus(MatchStatus.FINISHED);

        assertThrows(BusinessException.class,
                () -> matchService.changeMatchStatus(matchId, MatchStatus.IN_PROGRESS));
    }

    @Test
    @DisplayName("cerrar el primer tiempo o iniciar el segundo no reabre un partido terminal")
    void halfTransitions_onTerminalMatch_areRejected() {
        Match finished = Match.builder().status(MatchStatus.FINISHED).currentPeriod(2).build();
        Match cancelled = Match.builder().status(MatchStatus.CANCELLED).build();

        assertThrows(BusinessException.class, finished::startSecondHalf);
        assertThrows(BusinessException.class, cancelled::closeFirstHalf);
        assertEquals(MatchStatus.FINISHED, finished.getStatus());
        assertEquals(MatchStatus.CANCELLED, cancelled.getStatus());
    }

    @Test
    @DisplayName("cerrar el primer tiempo lleva el reloj a 40:00 si no llegó y lo pausa")
    void closeFirstHalf_movesClockToHalfDurationAndPauses() {
        Match match = Match.builder().status(MatchStatus.IN_PROGRESS).clockElapsedSeconds(1500).clockPaused(false).build();

        match.closeFirstHalf();

        assertEquals(Match.HALF_DURATION_SECONDS, match.getClockElapsedSeconds());
        assertTrue(match.getClockPaused());
        assertNotNull(match.getClockUpdatedAt());
    }

    @Test
    @DisplayName("iniciar el segundo tiempo arranca el reloj en 40:00 si el primero no llegó")
    void startSecondHalf_movesClockToHalfDurationAndRunsIt() {
        Match match = Match.builder().status(MatchStatus.HALFTIME).clockElapsedSeconds(1500).clockPaused(true).build();

        match.startSecondHalf();

        assertEquals(Match.HALF_DURATION_SECONDS, match.getClockElapsedSeconds());
        assertFalse(match.getClockPaused());
        assertNotNull(match.getClockUpdatedAt());
    }

    @Test
    @DisplayName("iniciar el segundo tiempo conserva el reloj si el primero pasó de 40:00")
    void startSecondHalf_keepsClockPastHalfDuration() {
        Match match = Match.builder().status(MatchStatus.HALFTIME).clockElapsedSeconds(2580).clockPaused(true).build();

        match.startSecondHalf();

        assertEquals(2580, match.getClockElapsedSeconds());
    }

    @Test
    @DisplayName("finish usa la hora informada por el cliente")
    void finish_usesClientOccurredAt() {
        Match match = matchWithStatus(MatchStatus.IN_PROGRESS);
        match.setStartedAt(LocalDateTime.of(2026, 10, 23, 15, 0));
        saveReturnsArgument();
        Instant occurredAt = Instant.parse("2026-10-23T16:25:00Z");

        MatchResponseDTO result = matchService.changeMatchStatus(matchId, MatchStatus.FINISHED, occurredAt);

        assertEquals(LocalDateTime.of(2026, 10, 23, 16, 25), match.getFinishedAt());
        assertEquals(MatchStatus.FINISHED, result.status());
    }

    @Test
    @DisplayName("finish no acepta una hora futura ni anterior al inicio")
    void finish_clampsClientOccurredAt() {
        Match match = matchWithStatus(MatchStatus.IN_PROGRESS);
        LocalDateTime startedAt = LocalDateTime.of(2026, 10, 23, 15, 0);
        match.setStartedAt(startedAt);
        saveReturnsArgument();

        LocalDateTime before = LocalDateTime.now(ZoneOffset.UTC);
        matchService.changeMatchStatus(matchId, MatchStatus.FINISHED, Instant.now().plusSeconds(3600));
        assertFalse(match.getFinishedAt().isBefore(before));
        assertFalse(match.getFinishedAt().isAfter(LocalDateTime.now(ZoneOffset.UTC)));

        match.setStatus(MatchStatus.IN_PROGRESS);
        matchService.changeMatchStatus(matchId, MatchStatus.FINISHED, Instant.parse("2026-10-23T14:00:00Z"));
        assertEquals(startedAt, match.getFinishedAt());
    }

    @Test
    @DisplayName("start usa la hora informada por el cliente")
    void start_usesClientOccurredAt() {
        Person person = Person.builder().id(UUID.randomUUID()).build();
        Match match = matchWithStatus(MatchStatus.NOT_STARTED);
        IntStream.range(0, 15).forEach(index -> match.getRoster().add(MatchPlayer.builder()
                .divisionPlayer(DivisionPlayer.builder().person(index == 0 ? person : Person.builder().id(UUID.randomUUID()).build()).build())
                .role(MatchPlayerRole.TITULAR)
                .build()));
        saveReturnsArgument();

        matchService.changeMatchStatus(matchId, MatchStatus.IN_PROGRESS, Instant.parse("2026-10-23T15:02:00Z"));

        assertEquals(LocalDateTime.of(2026, 10, 23, 15, 2), match.getStartedAt());
    }

    @Test
    @DisplayName("el plantel conserva el orden recibido y los números asignados")
    void saveMatchRoster_keepsOrderAndNumbers() {
        Division division = Division.builder().id(UUID.randomUUID()).build();
        Match match = matchWithStatus(MatchStatus.NOT_STARTED);
        match.setDivision(division);
        when(matchRepository.findByIdForUpdate(matchId)).thenReturn(Optional.of(match));

        List<Person> starters = IntStream.range(0, 15)
                .mapToObj(index -> Person.builder().id(UUID.randomUUID()).build())
                .toList();
        Person substitute = Person.builder().id(UUID.randomUUID()).build();
        List<DivisionPlayer> divisionPlayers = new ArrayList<>();
        starters.forEach(person -> divisionPlayers.add(DivisionPlayer.builder().person(person).build()));
        divisionPlayers.add(DivisionPlayer.builder().person(substitute).build());
        when(divisionPlayerRepository.findByDivisionId(division.getId())).thenReturn(divisionPlayers);

        List<MatchRosterEntryDTO> starterEntries = new ArrayList<>();
        for (int index = 0; index < starters.size(); index++) {
            starterEntries.add(new MatchRosterEntryDTO(starters.get(index).getId(),
                    com.fasterxml.jackson.databind.node.IntNode.valueOf(100 + index)));
        }
        matchService.saveMatchRoster(
                matchId,
                starterEntries,
                List.of(new MatchRosterEntryDTO(substitute.getId(),
                        com.fasterxml.jackson.databind.node.IntNode.valueOf(999))));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<MatchPlayer>> saved = ArgumentCaptor.forClass(List.class);
        verify(matchPlayerRepository).saveAll(saved.capture());
        List<MatchPlayer> roster = saved.getValue();

        List<UUID> expectedIds = new ArrayList<>(starters.stream().map(Person::getId).toList());
        expectedIds.add(substitute.getId());
        assertEquals(expectedIds, roster.stream().map(mp -> mp.getDivisionPlayer().getPerson().getId()).toList());
        List<MatchPlayerRole> expectedRoles = new ArrayList<>(
                IntStream.range(0, 15).mapToObj(index -> MatchPlayerRole.TITULAR).toList());
        expectedRoles.add(MatchPlayerRole.SUPLENTE);
        assertEquals(expectedRoles, roster.stream().map(MatchPlayer::getRole).toList());
        List<Integer> expectedSlotOrders = new ArrayList<>(IntStream.range(0, 15).boxed().toList());
        expectedSlotOrders.add(0);
        assertEquals(expectedSlotOrders, roster.stream().map(MatchPlayer::getSlotOrder).toList());
        assertEquals(100, roster.get(0).getNumber());
        assertEquals(999, roster.get(15).getNumber());
        verify(divisionPlayerRepository, never()).findAll();
    }
}
