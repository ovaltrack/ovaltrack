package com.ovaltrack.backend.zone.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.config.exceptions.EntityNotFoundException;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.repository.EventRepository;
import com.ovaltrack.backend.match.business.MatchSecurityValidator;
import com.ovaltrack.backend.match.business.MatchService;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.match.domain.MatchStatus;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentCreationDTO;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentResponseDTO;
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("ZoneAssignmentService: orquestación del CRUD de zonas")
class ZoneAssignmentServiceTest {

    @Mock private MatchService matchService;
    @Mock private MatchSecurityValidator matchSecurityValidator;
    @Mock private ZoneAssignmentRepository zoneAssignmentRepository;
    @Mock private EventRepository eventRepository;
    @Mock private EventZoneRuleValidator ruleValidator;
    @Mock private Authentication authentication;

    private final ZoneAssignmentValidator validator = new ZoneAssignmentValidator();
    private final ZoneSummaryCalculator summaryCalculator = new ZoneSummaryCalculator(new EventZoneResolver());

    private ZoneAssignmentService service;
    private Match match;
    private UUID matchId;

    private final ZoneAssignmentCreationDTO request = new ZoneAssignmentCreationDTO(2, 3, 1, 10, 25);

    @BeforeEach
    void setUp() {
        service = new ZoneAssignmentService(matchService, matchSecurityValidator, zoneAssignmentRepository,
                eventRepository, validator, summaryCalculator, ruleValidator);
        matchId = UUID.randomUUID();
        match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);
    }

    private ZoneAssignment zone(UUID id, int start, int end) {
        ZoneAssignment zone = new ZoneAssignment();
        zone.setId(id);
        zone.setMatch(match);
        zone.setPeriod(1);
        zone.setStartMinute(start);
        zone.setEndMinute(end);
        zone.setRow(1);
        zone.setCol(1);
        return zone;
    }

    @Test
    @DisplayName("Crea la zona en un partido finalizado")
    void shouldCreateZone() {
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(List.of());
        when(zoneAssignmentRepository.save(any(ZoneAssignment.class))).thenAnswer(call -> call.getArgument(0));

        ZoneAssignmentResponseDTO response = service.create(matchId, request, authentication);

        assertEquals(matchId, response.matchId());
        assertEquals(2, response.row());
        assertEquals(3, response.col());
        verify(matchSecurityValidator).validateCanManageMatch(match, authentication);
    }

    @Test
    @DisplayName("Un partido inexistente responde 404 sin consultar seguridad")
    void shouldFailWhenMatchDoesNotExist() {
        when(matchService.findMatchEntityById(matchId)).thenReturn(null);

        assertThrows(EntityNotFoundException.class, () -> service.create(matchId, request, authentication));
        verify(matchSecurityValidator, never()).validateCanManageMatch(any(), any());
    }

    @Test
    @DisplayName("Si el usuario no puede gestionar el partido no se persiste nada")
    void shouldNotPersistWhenAccessIsDenied() {
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        doThrow(new AccessDeniedException("Acceso denegado")).when(matchSecurityValidator)
                .validateCanManageMatch(match, authentication);

        assertThrows(AccessDeniedException.class, () -> service.create(matchId, request, authentication));
        verify(zoneAssignmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Un partido no finalizado se rechaza")
    void shouldRejectNotFinishedMatch() {
        match.setStatus(MatchStatus.IN_PROGRESS);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);

        assertThrows(BusinessException.class, () -> service.create(matchId, request, authentication));
        verify(zoneAssignmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Rechaza una zona que se solapa con otra existente")
    void shouldRejectOverlap() {
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId))
                .thenReturn(List.of(zone(UUID.randomUUID(), 20, 30)));

        assertThrows(BusinessException.class, () -> service.create(matchId, request, authentication));
        verify(zoneAssignmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Al editar, la zona no se solapa consigo misma")
    void shouldUpdateWithoutOverlappingItself() {
        UUID zoneId = UUID.randomUUID();
        ZoneAssignment current = zone(zoneId, 10, 25);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByIdAndMatchId(zoneId, matchId)).thenReturn(Optional.of(current));
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(List.of(current));
        when(zoneAssignmentRepository.save(any(ZoneAssignment.class))).thenAnswer(call -> call.getArgument(0));

        ZoneAssignmentResponseDTO response = service.update(matchId, zoneId,
                new ZoneAssignmentCreationDTO(3, 5, 1, 10, 25), authentication);

        assertEquals(3, response.row());
        assertEquals(5, response.col());
    }

    @Test
    @DisplayName("Editar una zona inexistente o de otro partido responde 404")
    void shouldFailUpdatingMissingZone() {
        UUID zoneId = UUID.randomUUID();
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByIdAndMatchId(zoneId, matchId)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> service.update(matchId, zoneId, request, authentication));
    }

    @Test
    @DisplayName("Elimina la zona existente")
    void shouldDeleteZone() {
        UUID zoneId = UUID.randomUUID();
        ZoneAssignment current = zone(zoneId, 10, 25);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByIdAndMatchId(zoneId, matchId)).thenReturn(Optional.of(current));

        service.delete(matchId, zoneId, authentication);

        verify(zoneAssignmentRepository).delete(current);
    }

    @Test
    @DisplayName("Eliminar una zona inexistente responde 404")
    void shouldFailDeletingMissingZone() {
        UUID zoneId = UUID.randomUUID();
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByIdAndMatchId(zoneId, matchId)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> service.delete(matchId, zoneId, authentication));
    }

    // --- Regla de zona por tipo de evento ---

    @Test
    @DisplayName("Al crear, valida los eventos del partido contra la celda pedida después de las reglas de rango")
    void shouldValidateEventZoneRulesOnCreate() {
        List<Event> events = List.of(new Event());
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(List.of());
        when(eventRepository.findPostMatchEventsByMatchId(matchId)).thenReturn(events);
        when(zoneAssignmentRepository.save(any(ZoneAssignment.class))).thenAnswer(call -> call.getArgument(0));

        service.create(matchId, request, authentication);

        InOrder order = inOrder(ruleValidator, zoneAssignmentRepository);
        order.verify(ruleValidator).validateAssignment(request, events);
        order.verify(zoneAssignmentRepository).save(any(ZoneAssignment.class));
    }

    @Test
    @DisplayName("Si la regla de zona rechaza el tramo, no se crea")
    void shouldNotCreateWhenRuleValidatorRejects() {
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(List.of());
        when(eventRepository.findPostMatchEventsByMatchId(matchId)).thenReturn(List.of());
        doThrow(new BusinessException("Scrum (1T 22:00) no puede quedar en C6"))
                .when(ruleValidator).validateAssignment(any(), any());

        assertThrows(BusinessException.class, () -> service.create(matchId, request, authentication));
        verify(zoneAssignmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Si el rango es inválido, ni siquiera se consultan los eventos")
    void shouldNotCheckEventZoneRulesWhenRangeIsInvalid() {
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(List.of());

        assertThrows(BusinessException.class, () -> service.create(matchId,
                new ZoneAssignmentCreationDTO(2, 3, 1, 25, 10), authentication));
        verify(ruleValidator, never()).validateAssignment(any(), any());
    }

    @Test
    @DisplayName("Al editar, valida los eventos contra la celda y el rango nuevos")
    void shouldValidateEventZoneRulesOnUpdate() {
        UUID zoneId = UUID.randomUUID();
        ZoneAssignment current = zone(zoneId, 10, 25);
        List<Event> events = List.of(new Event());
        ZoneAssignmentCreationDTO moved = new ZoneAssignmentCreationDTO(2, 1, 1, 10, 25);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByIdAndMatchId(zoneId, matchId)).thenReturn(Optional.of(current));
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(List.of(current));
        when(eventRepository.findPostMatchEventsByMatchId(matchId)).thenReturn(events);
        when(zoneAssignmentRepository.save(any(ZoneAssignment.class))).thenAnswer(call -> call.getArgument(0));

        service.update(matchId, zoneId, moved, authentication);

        verify(ruleValidator).validateAssignment(moved, events);
    }

    @Test
    @DisplayName("Si la regla de zona rechaza el cambio, el tramo no se modifica")
    void shouldNotUpdateWhenRuleValidatorRejects() {
        UUID zoneId = UUID.randomUUID();
        ZoneAssignment current = zone(zoneId, 10, 25);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByIdAndMatchId(zoneId, matchId)).thenReturn(Optional.of(current));
        when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(List.of(current));
        when(eventRepository.findPostMatchEventsByMatchId(matchId)).thenReturn(List.of());
        doThrow(new BusinessException("Maul (1T 15:00) no puede quedar en C1"))
                .when(ruleValidator).validateAssignment(any(), any());

        assertThrows(BusinessException.class, () -> service.update(matchId, zoneId,
                new ZoneAssignmentCreationDTO(2, 1, 1, 10, 25), authentication));
        verify(zoneAssignmentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Eliminar un tramo nunca consulta la regla de zona")
    void shouldNotCheckEventZoneRulesOnDelete() {
        UUID zoneId = UUID.randomUUID();
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(zoneAssignmentRepository.findByIdAndMatchId(zoneId, matchId)).thenReturn(Optional.of(zone(zoneId, 10, 25)));

        service.delete(matchId, zoneId, authentication);

        verify(ruleValidator, never()).validateAssignment(any(), any());
    }
}
