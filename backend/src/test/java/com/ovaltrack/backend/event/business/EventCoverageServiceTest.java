package com.ovaltrack.backend.event.business;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.dto.event.MatchCoverageDTO;
import com.ovaltrack.backend.event.repository.EventRepository;
import com.ovaltrack.backend.event.repository.MatchCoverageCount;
import com.ovaltrack.backend.match.business.MatchSecurityValidator;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.match.repository.MatchRepository;

@ExtendWith(MockitoExtension.class)
class EventCoverageServiceTest {

    @Mock
    private MatchRepository matchRepository;
    @Mock
    private EventRepository eventRepository;
    @Mock
    private MatchSecurityValidator matchSecurityValidator;
    @Mock
    private Authentication authentication;

    @InjectMocks
    private EventCoverageService service;

    private static Match match(UUID id) {
        return match(id, null);
    }

    private static Match match(UUID id, Division division) {
        Match match = new Match();
        match.setId(id);
        match.setDivision(division);
        return match;
    }

    private static Division division() {
        Division division = new Division();
        division.setId(UUID.randomUUID());
        return division;
    }

    private static MatchCoverageCount count(UUID matchId, long total, long withoutPlayer) {
        return new MatchCoverageCount() {
            public UUID getMatchId() { return matchId; }
            public Long getTotalEvents() { return total; }
            public Long getWithoutPlayer() { return withoutPlayer; }
        };
    }

    @Test
    @DisplayName("Devuelve una entrada por partido pedido, en orden y sin repetir; sin jugadas cuenta como 100 %")
    void coverageInRequestOrder() {
        UUID first = UUID.randomUUID();
        UUID empty = UUID.randomUUID();
        when(matchRepository.findAllById(List.of(first, empty))).thenReturn(List.of(match(empty), match(first)));
        when(eventRepository.countCoverageByMatchIds(List.of(first, empty), EventPossession.OPPONENT))
                .thenReturn(List.of(count(first, 3, 1)));

        List<MatchCoverageDTO> result = service.coverage(List.of(first, empty, first), authentication);

        assertEquals(List.of(new MatchCoverageDTO(first, 3, 1, 67), new MatchCoverageDTO(empty, 0, 0, 100)), result);
    }

    @Test
    @DisplayName("El acceso se valida una vez por división: un partido de cada una")
    void validatesOncePerDivision() {
        Division primera = division();
        Division intermedia = division();
        Match a = match(UUID.randomUUID(), primera);
        Match b = match(UUID.randomUUID(), primera);
        Match c = match(UUID.randomUUID(), intermedia);
        List<UUID> ids = List.of(a.getId(), b.getId(), c.getId());
        when(matchRepository.findAllById(ids)).thenReturn(List.of(a, b, c));

        service.coverage(ids, authentication);

        verify(matchSecurityValidator).validateCanManageMatch(a, authentication);
        verify(matchSecurityValidator).validateCanManageMatch(c, authentication);
        verify(matchSecurityValidator, never()).validateCanManageMatch(b, authentication);
    }

    @Test
    @DisplayName("Un partido de otro club corta el pedido sin consultar la cobertura")
    void deniedMatchStopsRequest() {
        UUID id = UUID.randomUUID();
        when(matchRepository.findAllById(List.of(id))).thenReturn(List.of(match(id)));
        doThrow(new AccessDeniedException("Acceso denegado")).when(matchSecurityValidator).validateCanManageMatch(any(), any());

        assertThrows(AccessDeniedException.class, () -> service.coverage(List.of(id), authentication));
        verify(eventRepository, never()).countCoverageByMatchIds(anyCollection(), any());
    }

    @Test
    @DisplayName("Un partido inexistente responde 'Partido no encontrado'")
    void unknownMatch() {
        UUID id = UUID.randomUUID();
        when(matchRepository.findAllById(List.of(id))).thenReturn(List.of());

        BusinessException error = assertThrows(BusinessException.class, () -> service.coverage(List.of(id), authentication));
        assertEquals("Partido no encontrado", error.getMessage());
    }

    @Test
    @DisplayName("Más de 50 partidos por pedido se rechaza")
    void tooManyMatches() {
        List<UUID> ids = IntStream.rangeClosed(0, EventCoverageService.MAX_MATCHES).mapToObj(i -> UUID.randomUUID()).toList();

        assertThrows(BusinessException.class, () -> service.coverage(ids, authentication));
        verifyNoInteractions(matchRepository, eventRepository);
    }

    @Test
    @DisplayName("El porcentaje redondea como Math.round de JavaScript")
    void percentRounding() {
        UUID id = UUID.randomUUID();
        assertEquals(88, MatchCoverageDTO.of(id, 8, 1).percent());
        assertEquals(50, MatchCoverageDTO.of(id, 2, 1).percent());
        assertEquals(0, MatchCoverageDTO.of(id, 4, 4).percent());
        assertEquals(100, MatchCoverageDTO.of(id, 0, 0).percent());
    }
}
