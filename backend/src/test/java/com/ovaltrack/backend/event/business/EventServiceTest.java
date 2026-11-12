package com.ovaltrack.backend.event.business;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import com.ovaltrack.backend.club.business.ClubService;
import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.domain.TemplateField;
import com.ovaltrack.backend.event.domain.dto.event.EventCreationDTO;
import com.ovaltrack.backend.event.domain.dto.event.EventResponseDTO;
import com.ovaltrack.backend.event.domain.dto.event.EventUpdateDTO;
import com.ovaltrack.backend.event.domain.dto.event.MatchTimelineEventResponseDTO;
import com.ovaltrack.backend.event.repository.EventRepository;
import com.ovaltrack.backend.match.business.MatchSecurityValidator;
import com.ovaltrack.backend.match.business.MatchService;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.match.domain.MatchStatus;
import com.ovaltrack.backend.match.repository.MatchRepository;
import com.ovaltrack.backend.zone.business.EventZoneRuleValidator;
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;
import com.ovaltrack.backend.person.business.PersonService;
import com.ovaltrack.backend.person.domain.Person;

@ExtendWith(MockitoExtension.class)
@DisplayName("EventService Unit Tests (HU-8.4)")
class EventServiceTest {

    @Mock
    private EventRepository eventRepository;

    @Mock
    private EventTypeService eventTypeService;

    @Mock
    private ClubService clubService;

    @Mock
    private MatchService matchService;

    @Mock
    private PersonService personService;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private MatchSecurityValidator matchSecurityValidator;

    @Mock
    private Authentication authentication;

    @Mock
    private ZoneAssignmentRepository zoneAssignmentRepository;

    @Mock
    private EventZoneRuleValidator zoneRuleValidator;

    @InjectMocks
    private EventService eventService;

    @Test
    @DisplayName("saveEvent: Permite alta post_capture en partido FINISHED y autocompleta realTime si es null")
    void saveEvent_shouldSucceedInFinishedMatch_withPostCaptureOrigin() {
        UUID matchId = UUID.randomUUID();
        UUID eventTypeId = UUID.randomUUID();

        EventType eventType = new EventType();
        eventType.setId(eventTypeId);
        eventType.setName("Try");
        eventType.setIsScoring(true);
        eventType.setPoints(5);

        Match match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);

        EventCreationDTO request = new EventCreationDTO(
                eventTypeId,
                matchId,
                null,
                null,
                EventPossession.OWN,
                900,
                900,
                null,
                1,
                Event.ORIGIN_POST_CAPTURE,
                Map.of(),
                null
        );

        when(eventTypeService.findEventTypeEntityById(eventTypeId)).thenReturn(eventType);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> {
            Event saved = invocation.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });
        when(eventRepository.findEventsByMatchId(matchId)).thenReturn(List.of());

        EventResponseDTO response = eventService.saveEvent(request, authentication);

        assertNotNull(response);
        assertEquals(Event.ORIGIN_POST_CAPTURE, response.origin());
        assertNotNull(response.realTime());
        verify(matchSecurityValidator).validateCanManageMatch(match, authentication);
        verify(eventRepository).save(any(Event.class));
    }

    @Test
    @DisplayName("saveEvent: Rechaza alta en partido FINISHED si origin no es post_capture")
    void saveEvent_shouldThrowException_whenMatchFinishedAndOriginNotPostCapture() {
        UUID matchId = UUID.randomUUID();
        UUID eventTypeId = UUID.randomUUID();

        EventType eventType = new EventType();
        eventType.setId(eventTypeId);

        Match match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);

        EventCreationDTO request = new EventCreationDTO(
                eventTypeId,
                matchId,
                null,
                null,
                EventPossession.OWN,
                900,
                900,
                LocalDateTime.now(),
                1,
                "live-capture",
                null,
                null
        );

        when(eventTypeService.findEventTypeEntityById(eventTypeId)).thenReturn(eventType);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);

        assertDoesNotThrow(() -> eventService.saveEvent(request, authentication));
        verify(eventRepository).save(any());
    }

    @Test
    @DisplayName("saveEvent: Falla con AccessDeniedException si matchSecurityValidator deniega el acceso")
    void saveEvent_shouldPropagateAccessDenied_whenUserNotAuthorized() {
        UUID matchId = UUID.randomUUID();
        UUID eventTypeId = UUID.randomUUID();

        EventType eventType = new EventType();
        eventType.setId(eventTypeId);

        Match match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);

        EventCreationDTO request = new EventCreationDTO(
                eventTypeId,
                matchId,
                null,
                null,
                EventPossession.OWN,
                900,
                900,
                LocalDateTime.now(),
                1,
                Event.ORIGIN_POST_CAPTURE,
                null,
                null
        );

        when(eventTypeService.findEventTypeEntityById(eventTypeId)).thenReturn(eventType);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        doThrow(new AccessDeniedException("Acceso denegado"))
                .when(matchSecurityValidator).validateCanManageMatch(match, authentication);

        assertThrows(AccessDeniedException.class, () -> eventService.saveEvent(request, authentication));
        verify(eventRepository, never()).save(any());
    }

    @Test
    @DisplayName("findPostMatchEvents: Mapea correctamente origin y attributes en MatchTimelineEventResponseDTO")
    void findPostMatchEvents_shouldIncludeOriginAndAttributes() {
        UUID matchId = UUID.randomUUID();

        Match match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);

        EventType eventType = new EventType();
        eventType.setId(UUID.randomUUID());
        eventType.setName("Tackle completado");

        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setEventType(eventType);
        event.setMatch(match);
        event.setPeriod(1);
        event.setMatchTime(600);
        event.setAbsoluteMatchTime(630);
        event.setRealTime(LocalDateTime.now());
        event.setTeamPossession(EventPossession.OWN);
        event.setOrigin(Event.ORIGIN_POST_CAPTURE);
        event.setAttributes(Map.of("card", "YELLOW"));
        event.setActive(true);

        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        when(eventRepository.findPostMatchEventsByMatchId(matchId)).thenReturn(List.of(event));

        Collection<MatchTimelineEventResponseDTO> result = eventService.findPostMatchEvents(matchId, authentication);

        assertEquals(1, result.size());
        MatchTimelineEventResponseDTO dto = result.iterator().next();
        assertEquals(Event.ORIGIN_POST_CAPTURE, dto.origin());
        assertEquals("YELLOW", dto.attributes().get("card"));
        assertEquals(630, dto.absoluteMatchTime());
        verify(matchSecurityValidator).validateCanManageMatch(match, authentication);
    }

    @Test
    @DisplayName("saveEvent: Lanza BusinessException si matchTime es negativo")
    void saveEvent_shouldThrowBusinessException_whenMatchTimeIsNegative() {
        UUID matchId = UUID.randomUUID();
        UUID eventTypeId = UUID.randomUUID();

        EventType eventType = new EventType();
        eventType.setId(eventTypeId);
        when(eventTypeService.findEventTypeEntityById(eventTypeId)).thenReturn(eventType);

        Match match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);

        EventCreationDTO request = new EventCreationDTO(
                eventTypeId, matchId, null, null, EventPossession.OWN,
                -10, null, null, 1, Event.ORIGIN_POST_CAPTURE, null, null
        );

        BusinessException ex = assertThrows(BusinessException.class, () -> eventService.saveEvent(request));
        assertTrue(ex.getMessage().contains("no puede ser negativo"));
    }

    @Test
    @DisplayName("saveEvent: Lanza BusinessException si período 1 excede los 40 minutos (2400s)")
    void saveEvent_shouldThrowBusinessException_whenPeriod1Exceeds40Minutes() {
        UUID matchId = UUID.randomUUID();
        UUID eventTypeId = UUID.randomUUID();

        EventType eventType = new EventType();
        eventType.setId(eventTypeId);
        when(eventTypeService.findEventTypeEntityById(eventTypeId)).thenReturn(eventType);

        Match match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);

        // 45 minutos en el 1T = 2700s (> 2400s)
        EventCreationDTO request = new EventCreationDTO(
                eventTypeId, matchId, null, null, EventPossession.OWN,
                2700, null, null, 1, Event.ORIGIN_POST_CAPTURE, null, null
        );

        BusinessException ex = assertThrows(BusinessException.class, () -> eventService.saveEvent(request));
        assertTrue(ex.getMessage().contains("1° Tiempo no puede exceder"));
    }

    @Test
    @DisplayName("saveEvent: Lanza BusinessException si período 2 excede los 80 minutos (4800s)")
    void saveEvent_shouldThrowBusinessException_whenPeriod2Exceeds80Minutes() {
        UUID matchId = UUID.randomUUID();
        UUID eventTypeId = UUID.randomUUID();

        EventType eventType = new EventType();
        eventType.setId(eventTypeId);
        when(eventTypeService.findEventTypeEntityById(eventTypeId)).thenReturn(eventType);

        Match match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);

        // 85 minutos de partido = 5100s (> 4800s)
        EventCreationDTO request = new EventCreationDTO(
                eventTypeId, matchId, null, null, EventPossession.OWN,
                5100, null, null, 2, Event.ORIGIN_POST_CAPTURE, null, null
        );

        BusinessException ex = assertThrows(BusinessException.class, () -> eventService.saveEvent(request));
        assertTrue(ex.getMessage().contains("2° Tiempo no puede exceder"));
    }

    @Test
    @DisplayName("saveEvent: Permite guardar evento en el 1T a los 40 minutos reglamentarios (2400s)")
    void saveEvent_shouldSucceed_whenPeriod1Is40Minutes() {
        UUID matchId = UUID.randomUUID();
        UUID eventTypeId = UUID.randomUUID();

        EventType eventType = new EventType();
        eventType.setId(eventTypeId);
        eventType.setName("Penal");
        eventType.setIsScoring(false);
        when(eventTypeService.findEventTypeEntityById(eventTypeId)).thenReturn(eventType);

        Match match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);

        // 40 minutos = 2400s (permitido <= 2400s)
        EventCreationDTO request = new EventCreationDTO(
                eventTypeId, matchId, null, null, EventPossession.OWN,
                2400, 2400, null, 1, Event.ORIGIN_POST_CAPTURE, null, null
        );

        Event savedEvent = new Event();
        savedEvent.setId(UUID.randomUUID());
        savedEvent.setEventType(eventType);
        savedEvent.setMatch(match);
        savedEvent.setPeriod(1);
        savedEvent.setMatchTime(2400);
        savedEvent.setAbsoluteMatchTime(2400);
        savedEvent.setTeamPossession(EventPossession.OWN);
        savedEvent.setOrigin(Event.ORIGIN_POST_CAPTURE);

        when(eventRepository.save(any(Event.class))).thenReturn(savedEvent);

        EventResponseDTO res = eventService.saveEvent(request);
        assertNotNull(res);
        assertEquals(2400, res.matchTime());
        assertEquals(2400, res.absoluteMatchTime());
    }

    @Test
    @DisplayName("saveEvent: Lanza BusinessException si se asigna un jugador a un evento del equipo rival")
    void saveEvent_shouldThrowBusinessException_whenOpponentEventHasPlayer() {
        UUID matchId = UUID.randomUUID();
        UUID eventTypeId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();

        EventType eventType = new EventType();
        eventType.setId(eventTypeId);
        when(eventTypeService.findEventTypeEntityById(eventTypeId)).thenReturn(eventType);

        Match match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);

        EventCreationDTO request = new EventCreationDTO(
                eventTypeId, matchId, null, playerId, EventPossession.OPPONENT,
                1200, 1200, null, 1, Event.ORIGIN_POST_CAPTURE, null, null
        );

        BusinessException ex = assertThrows(BusinessException.class, () -> eventService.saveEvent(request));
        assertTrue(ex.getMessage().contains("No se puede asignar un jugador a un evento del equipo rival"));
    }

    @Test
    @DisplayName("saveEvent: Permite registrar evento del equipo rival sin jugador asignado")
    void saveEvent_shouldSucceed_whenOpponentEventHasNullPlayer() {
        UUID matchId = UUID.randomUUID();
        UUID eventTypeId = UUID.randomUUID();

        EventType eventType = new EventType();
        eventType.setId(eventTypeId);
        eventType.setName("Try Rival");
        eventType.setIsScoring(true);
        eventType.setPoints(5);
        when(eventTypeService.findEventTypeEntityById(eventTypeId)).thenReturn(eventType);

        Match match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);

        EventCreationDTO request = new EventCreationDTO(
                eventTypeId, matchId, null, null, EventPossession.OPPONENT,
                1500, 1500, null, 1, Event.ORIGIN_POST_CAPTURE, null, null
        );

        Event savedEvent = new Event();
        savedEvent.setId(UUID.randomUUID());
        savedEvent.setEventType(eventType);
        savedEvent.setMatch(match);
        savedEvent.setPeriod(1);
        savedEvent.setMatchTime(1500);
        savedEvent.setTeamPossession(EventPossession.OPPONENT);
        savedEvent.setOrigin(Event.ORIGIN_POST_CAPTURE);

        when(eventRepository.save(any(Event.class))).thenReturn(savedEvent);

        EventResponseDTO res = eventService.saveEvent(request);
        assertNotNull(res);
        assertNull(res.playerId());
        assertEquals(EventPossession.OPPONENT, res.teamPossession());
    }

    @Test
    @DisplayName("updateEvent: Lanza BusinessException si se intenta asignar jugador a un evento del equipo rival")
    void updateEvent_shouldThrowBusinessException_whenOpponentEventHasPlayer() {
        UUID eventId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();

        Match match = new Match();
        match.setId(UUID.randomUUID());

        EventType eventType = new EventType();
        eventType.setId(UUID.randomUUID());

        Event existingEvent = new Event();
        existingEvent.setId(eventId);
        existingEvent.setEventType(eventType);
        existingEvent.setMatch(match);
        existingEvent.setTeamPossession(EventPossession.OPPONENT);
        existingEvent.setPeriod(1);
        existingEvent.setMatchTime(1000);

        when(eventRepository.findActiveEventById(eventId)).thenReturn(existingEvent);

        EventUpdateDTO updateDTO = new EventUpdateDTO(
                null, playerId, null, null, null, null, null, null, null, null
        );

        BusinessException ex = assertThrows(BusinessException.class, () -> eventService.updateEvent(eventId, updateDTO));
        assertTrue(ex.getMessage().contains("No se puede asignar un jugador a un evento del equipo rival"));
    }

    @Test
    @DisplayName("updateEvent: Limpia el jugador si la posesión cambia a OPPONENT")
    void updateEvent_shouldClearPlayer_whenPossessionChangedToOpponent() {
        UUID eventId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();

        Match match = new Match();
        match.setId(UUID.randomUUID());

        Person person = new Person();
        person.setId(playerId);
        person.setFirstName("Juan");
        person.setLastName("Perez");

        EventType eventType = new EventType();
        eventType.setId(UUID.randomUUID());
        eventType.setIsScoring(false);

        Event existingEvent = new Event();
        existingEvent.setId(eventId);
        existingEvent.setMatch(match);
        existingEvent.setEventType(eventType);
        existingEvent.setTeamPossession(EventPossession.OWN);
        existingEvent.setPlayer(person);
        existingEvent.setPeriod(1);
        existingEvent.setMatchTime(1000);

        when(eventRepository.findActiveEventById(eventId)).thenReturn(existingEvent);
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EventUpdateDTO updateDTO = new EventUpdateDTO(
                null, null, EventPossession.OPPONENT, null, null, null, null, null, null, null
        );

        EventResponseDTO res = eventService.updateEvent(eventId, updateDTO);
        assertNotNull(res);
        assertNull(res.playerId());
        assertEquals(EventPossession.OPPONENT, res.teamPossession());
        assertNull(existingEvent.getPlayer());
    }

    @Test
    @DisplayName("updateEvent: Permite asignar jugador sin enviar atributos aunque el tipo de evento tenga campos requeridos")
    void updateEvent_shouldSucceed_whenAttributesNullEvenIfEventTypeHasRequiredFields() {
        UUID eventId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();

        Match match = new Match();
        match.setId(matchId);

        Person person = new Person();
        person.setId(playerId);
        person.setFirstName("Agustin");
        person.setLastName("Creevy");

        com.ovaltrack.backend.division.domain.DivisionPlayer divPlayer = new com.ovaltrack.backend.division.domain.DivisionPlayer();
        divPlayer.setPerson(person);

        com.ovaltrack.backend.match.domain.MatchPlayer matchPlayer = new com.ovaltrack.backend.match.domain.MatchPlayer();
        matchPlayer.setDivisionPlayer(divPlayer);
        match.setRoster(List.of(matchPlayer));

        com.ovaltrack.backend.event.domain.TemplateField requiredField = new com.ovaltrack.backend.event.domain.TemplateField(
                "passType", "Tipo de pase", "select", "live", true, null, null, null, null, null, null, null
        );
        EventType eventType = new EventType();
        eventType.setId(UUID.randomUUID());
        eventType.setTemplateEventFields(List.of(requiredField));

        Event existingEvent = new Event();
        existingEvent.setId(eventId);
        existingEvent.setMatch(match);
        existingEvent.setEventType(eventType);
        existingEvent.setTeamPossession(EventPossession.OWN);
        existingEvent.setPeriod(1);
        existingEvent.setMatchTime(500);

        when(eventRepository.findActiveEventById(eventId)).thenReturn(existingEvent);
        when(personService.findPersonEntityById(playerId)).thenReturn(person);
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EventUpdateDTO updateDTO = new EventUpdateDTO(
                null, playerId, EventPossession.OWN, null, null, null, null, null, null, null
        );

        EventResponseDTO res = eventService.updateEvent(eventId, updateDTO);
        assertNotNull(res);
        assertEquals(playerId, res.playerId());
        assertEquals(person, existingEvent.getPlayer());
    }

    @Test
    @DisplayName("saveEvent: Recalcula tanteador sumando al local si es OWN o tiene jugador, y al rival si es OPPONENT")
    void saveEvent_shouldRecalculateScoresProperly() {
        UUID matchId = UUID.randomUUID();
        UUID tryTypeId = UUID.randomUUID();

        EventType tryType = new EventType();
        tryType.setId(tryTypeId);
        tryType.setIsScoring(true);
        tryType.setPoints(5);

        Match match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.IN_PROGRESS);

        when(eventTypeService.findEventTypeEntityById(tryTypeId)).thenReturn(tryType);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);

        Person player = new Person();
        player.setId(UUID.randomUUID());

        Event ownTry = new Event();
        ownTry.setEventType(tryType);
        ownTry.setTeamPossession(EventPossession.OWN);
        ownTry.setPlayer(player);

        Event opponentTry = new Event();
        opponentTry.setEventType(tryType);
        opponentTry.setTeamPossession(EventPossession.OPPONENT);

        when(eventRepository.findEventsByMatchId(matchId)).thenReturn(List.of(ownTry, opponentTry));
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> {
            Event e = i.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        EventCreationDTO request = new EventCreationDTO(
                tryTypeId, matchId, null, null, EventPossession.OWN,
                100, 100, null, 1, "APP", null, null
        );

        eventService.saveEvent(request);

        assertEquals(5, match.getHomeScore());
        assertEquals(5, match.getAwayScore());
        verify(matchRepository).save(match);
    }

    private EventType createSampleTypeWithFields() {
        TemplateField penaltyTypeField = new TemplateField(
                "penaltyType", "Causa del penal", "select", "live", false,
                List.of(
                        new TemplateField.Option("OFFSIDE", "Offside", null, null),
                        new TemplateField.Option("NOT_RELEASING", "No suelta", null, null)
                ),
                null, null, null, null, null, null
        );
        TemplateField metersField = new TemplateField(
                "metersGained", "Metros ganados", "number", "post", false,
                null, 0.0, 100.0, null, null, null, null
        );
        TemplateField badPassField = new TemplateField(
                "isBadPass", "Pase defectuoso", "boolean", "post", false,
                null, null, null, null, null, "Sí", "No"
        );

        EventType type = new EventType();
        type.setId(UUID.randomUUID());
        type.setName("Infracción");
        type.setTemplateEventFields(List.of(penaltyTypeField, metersField, badPassField));
        return type;
    }

    @Test
    @DisplayName("updateEvent: Guarda atributos tácticos válidos correctamente")
    void updateEvent_shouldSaveValidAttributes() {
        UUID eventId = UUID.randomUUID();
        EventType type = createSampleTypeWithFields();

        Event event = new Event();
        event.setId(eventId);
        event.setEventType(type);
        event.setPeriod(1);
        event.setMatchTime(200);
        Match match = new Match();
        match.setId(UUID.randomUUID());
        event.setMatch(match);

        when(eventRepository.findActiveEventById(eventId)).thenReturn(event);
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));

        Map<String, Object> attrs = Map.of(
                "penaltyType", "OFFSIDE",
                "metersGained", 15,
                "isBadPass", true
        );
        EventUpdateDTO dto = new EventUpdateDTO(null, null, null, null, null, null, null, attrs, null, null);

        EventResponseDTO res = eventService.updateEvent(eventId, dto);
        assertNotNull(res);
        assertEquals(attrs, res.attributes());
        assertEquals(attrs, event.getAttributes());
    }

    @Test
    @DisplayName("updateEvent: Falla con BusinessException cuando valor numérico supera el máximo permitido")
    void updateEvent_shouldThrowWhenNumericAttributeExceedsMax() {
        UUID eventId = UUID.randomUUID();
        EventType type = createSampleTypeWithFields();

        Event event = new Event();
        event.setId(eventId);
        event.setEventType(type);
        event.setPeriod(1);
        event.setMatchTime(200);

        when(eventRepository.findActiveEventById(eventId)).thenReturn(event);

        Map<String, Object> attrs = Map.of("metersGained", 150);
        EventUpdateDTO dto = new EventUpdateDTO(null, null, null, null, null, null, null, attrs, null, null);

        BusinessException ex = assertThrows(BusinessException.class, () -> eventService.updateEvent(eventId, dto));
        assertTrue(ex.getMessage().contains("máximo"));
    }

    @Test
    @DisplayName("updateEvent: Falla con BusinessException cuando valor numérico es menor al mínimo permitido")
    void updateEvent_shouldThrowWhenNumericAttributeBelowMin() {
        UUID eventId = UUID.randomUUID();
        EventType type = createSampleTypeWithFields();

        Event event = new Event();
        event.setId(eventId);
        event.setEventType(type);
        event.setPeriod(1);
        event.setMatchTime(200);

        when(eventRepository.findActiveEventById(eventId)).thenReturn(event);

        Map<String, Object> attrs = Map.of("metersGained", -10);
        EventUpdateDTO dto = new EventUpdateDTO(null, null, null, null, null, null, null, attrs, null, null);

        BusinessException ex = assertThrows(BusinessException.class, () -> eventService.updateEvent(eventId, dto));
        assertTrue(ex.getMessage().contains("mínimo"));
    }

    @Test
    @DisplayName("updateEvent: Falla con BusinessException cuando opción de select es inválida")
    void updateEvent_shouldThrowWhenSelectOptionInvalid() {
        UUID eventId = UUID.randomUUID();
        EventType type = createSampleTypeWithFields();

        Event event = new Event();
        event.setId(eventId);
        event.setEventType(type);
        event.setPeriod(1);
        event.setMatchTime(200);

        when(eventRepository.findActiveEventById(eventId)).thenReturn(event);

        Map<String, Object> attrs = Map.of("penaltyType", "OPCION_INEXISTENTE");
        EventUpdateDTO dto = new EventUpdateDTO(null, null, null, null, null, null, null, attrs, null, null);

        BusinessException ex = assertThrows(BusinessException.class, () -> eventService.updateEvent(eventId, dto));
        assertTrue(ex.getMessage().contains("Opción inválida"));
    }

    @Test
    @DisplayName("updateEvent: Falla con BusinessException cuando se envía una clave no permitida")
    void updateEvent_shouldThrowWhenAttributeKeyUndeclared() {
        UUID eventId = UUID.randomUUID();
        EventType type = createSampleTypeWithFields();

        Event event = new Event();
        event.setId(eventId);
        event.setEventType(type);
        event.setPeriod(1);
        event.setMatchTime(200);

        when(eventRepository.findActiveEventById(eventId)).thenReturn(event);

        Map<String, Object> attrs = Map.of("campoInexistente", 99);
        EventUpdateDTO dto = new EventUpdateDTO(null, null, null, null, null, null, null, attrs, null, null);

        BusinessException ex = assertThrows(BusinessException.class, () -> eventService.updateEvent(eventId, dto));
        assertTrue(ex.getMessage().contains("Atributo no permitido"));
    }

    @Test
    @DisplayName("updateEvent: Resetea los atributos huérfanos a null cuando cambia el tipo de evento sin nuevos atributos")
    void updateEvent_shouldResetAttributes_whenEventTypeChangesWithoutAttributes() {
        UUID eventId = UUID.randomUUID();
        EventType oldType = createSampleTypeWithFields();

        UUID newTypeId = UUID.randomUUID();
        EventType newType = new EventType();
        newType.setId(newTypeId);
        newType.setName("Try");
        newType.setTemplateEventFields(List.of());

        Event event = new Event();
        event.setId(eventId);
        event.setEventType(oldType);
        event.setPeriod(1);
        event.setMatchTime(200);
        event.setAttributes(Map.of("penaltyType", "OFFSIDE", "metersGained", 10));
        Match match = new Match();
        match.setId(UUID.randomUUID());
        event.setMatch(match);

        when(eventRepository.findActiveEventById(eventId)).thenReturn(event);
        when(eventTypeService.findEventTypeEntityById(newTypeId)).thenReturn(newType);
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));

        EventUpdateDTO dto = new EventUpdateDTO(newTypeId, null, null, null, null, null, null, null, null, null);

        EventResponseDTO res = eventService.updateEvent(eventId, dto);
        assertNotNull(res);
        assertNull(res.attributes());
        assertNull(event.getAttributes());
        assertEquals(newType, event.getEventType());
    }
}
