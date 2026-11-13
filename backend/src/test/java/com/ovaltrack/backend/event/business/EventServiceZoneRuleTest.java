package com.ovaltrack.backend.event.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.domain.dto.event.EventCreationDTO;
import com.ovaltrack.backend.event.domain.dto.event.EventUpdateDTO;
import com.ovaltrack.backend.event.repository.EventRepository;
import com.ovaltrack.backend.match.business.MatchSecurityValidator;
import com.ovaltrack.backend.match.business.MatchService;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.match.domain.MatchStatus;
import com.ovaltrack.backend.match.repository.MatchRepository;
import com.ovaltrack.backend.zone.business.EventZoneRuleValidator;
import com.ovaltrack.backend.zone.business.TramoTrimmer;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("EventService: la regla de zona del tipo solo se valida en el post-partido")
class EventServiceZoneRuleTest {

    @Mock private EventRepository eventRepository;
    @Mock private EventTypeService eventTypeService;
    @Mock private MatchService matchService;
    @Mock private MatchRepository matchRepository;
    @Mock private MatchSecurityValidator matchSecurityValidator;
    @Mock private ZoneAssignmentRepository zoneAssignmentRepository;
    @Mock private EventZoneRuleValidator zoneRuleValidator;
    @Mock private TramoTrimmer tramoTrimmer;
    @Mock private Authentication authentication;

    @InjectMocks private EventService eventService;

    private UUID matchId;
    private UUID scrumTypeId;
    private EventType scrum;
    private Match match;
    private List<ZoneAssignment> assignments;

    @BeforeEach
    void setUp() {
        matchId = UUID.randomUUID();
        scrumTypeId = UUID.randomUUID();
        scrum = new EventType();
        scrum.setId(scrumTypeId);
        scrum.setName("Scrum");
        scrum.setIsScoring(false);
        match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);
        assignments = List.of(new ZoneAssignment());
    }

    private EventCreationDTO creation(String origin) {
        return new EventCreationDTO(scrumTypeId, matchId, null, null, EventPossession.OPPONENT,
                1320, 1320, null, 1, origin, Map.of(), null);
    }

    private void stubCreation() {
        when(eventTypeService.findEventTypeEntityById(scrumTypeId)).thenReturn(scrum);
        when(matchService.findMatchEntityById(matchId)).thenReturn(match);
    }

    private void stubSave() {
        when(eventRepository.save(any(Event.class))).thenAnswer(call -> {
            Event saved = call.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });
    }

    private Event existingEvent(MatchStatus status) {
        match.setStatus(status);
        EventType tackle = new EventType();
        tackle.setId(UUID.randomUUID());
        tackle.setName("Tackle completado");
        tackle.setIsScoring(false);
        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setMatch(match);
        event.setEventType(tackle);
        event.setTeamPossession(EventPossession.NEUTRAL);
        event.setPeriod(1);
        event.setMatchTime(1320);
        event.setActive(true);
        return event;
    }

    @Nested
    @DisplayName("saveEvent")
    class SaveEvent {

        @Test
        @DisplayName("Un alta post_capture en un partido finalizado se valida contra los tramos del partido")
        void shouldValidatePostCaptureEventOfFinishedMatch() {
            stubCreation();
            stubSave();
            when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(assignments);

            eventService.saveEvent(creation(Event.ORIGIN_POST_CAPTURE), authentication);

            ArgumentCaptor<Event> validated = ArgumentCaptor.forClass(Event.class);
            verify(zoneRuleValidator).validateEvent(validated.capture(), eq(assignments));
            assertEquals(scrum, validated.getValue().getEventType());
            assertEquals(EventPossession.OPPONENT, validated.getValue().getTeamPossession());
        }

        @Test
        @DisplayName("Si la regla lo rechaza, el evento no se guarda")
        void shouldNotSaveWhenRuleValidatorRejects() {
            stubCreation();
            when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(assignments);
            doThrow(new BusinessException("Scrum (1T 22:00) no puede quedar en C6"))
                    .when(zoneRuleValidator).validateEvent(any(Event.class), any());

            assertThrows(BusinessException.class, () -> eventService.saveEvent(creation(Event.ORIGIN_POST_CAPTURE), authentication));
            verify(eventRepository, never()).save(any(Event.class));
        }

        @Test
        @DisplayName("Un evento de captura en vivo nunca se valida, aunque el partido ya esté finalizado")
        void shouldNeverValidateLiveCapture() {
            stubCreation();
            stubSave();

            eventService.saveEvent(creation("live-capture"), authentication);

            verify(zoneRuleValidator, never()).validateEvent(any(), any());
        }

        @Test
        @DisplayName("Un alta post_capture en un partido que no está finalizado no se valida")
        void shouldNotValidateWhenMatchIsNotFinished() {
            match.setStatus(MatchStatus.IN_PROGRESS);
            stubCreation();
            stubSave();

            eventService.saveEvent(creation(Event.ORIGIN_POST_CAPTURE), authentication);

            verify(zoneRuleValidator, never()).validateEvent(any(), any());
        }
    }

    @Nested
    @DisplayName("updateEvent")
    class UpdateEvent {

        @Test
        @DisplayName("Valida el evento ya modificado (tipo nuevo) cuando el partido está finalizado")
        void shouldValidateUpdatedEventOfFinishedMatch() {
            Event event = existingEvent(MatchStatus.FINISHED);
            when(eventRepository.findActiveEventById(event.getId())).thenReturn(event);
            when(eventTypeService.findEventTypeEntityById(scrumTypeId)).thenReturn(scrum);
            when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(assignments);
            when(eventRepository.save(any(Event.class))).thenAnswer(call -> call.getArgument(0));

            eventService.updateEvent(event.getId(),
                    new EventUpdateDTO(scrumTypeId, null, null, null, null, null, null, null, null, null), authentication);

            ArgumentCaptor<Event> validated = ArgumentCaptor.forClass(Event.class);
            verify(zoneRuleValidator).validateEvent(validated.capture(), eq(assignments));
            assertEquals(scrum, validated.getValue().getEventType());
        }

        @Test
        @DisplayName("Valida el evento con el tiempo corregido")
        void shouldValidateEventWithCorrectedTime() {
            Event event = existingEvent(MatchStatus.FINISHED);
            when(eventRepository.findActiveEventById(event.getId())).thenReturn(event);
            when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(assignments);
            when(eventRepository.save(any(Event.class))).thenAnswer(call -> call.getArgument(0));

            eventService.updateEvent(event.getId(),
                    new EventUpdateDTO(null, null, null, 1800, null, null, null, null, null, null), authentication);

            ArgumentCaptor<Event> validated = ArgumentCaptor.forClass(Event.class);
            verify(zoneRuleValidator).validateEvent(validated.capture(), eq(assignments));
            assertEquals(1800, validated.getValue().getMatchTime());
        }

        @Test
        @DisplayName("Si la regla lo rechaza, el evento no se guarda")
        void shouldNotSaveWhenRuleValidatorRejects() {
            Event event = existingEvent(MatchStatus.FINISHED);
            when(eventRepository.findActiveEventById(event.getId())).thenReturn(event);
            when(eventTypeService.findEventTypeEntityById(scrumTypeId)).thenReturn(scrum);
            when(zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId)).thenReturn(assignments);
            doThrow(new BusinessException("Scrum (1T 22:00) no puede quedar en C6"))
                    .when(zoneRuleValidator).validateEvent(any(Event.class), any());

            assertThrows(BusinessException.class, () -> eventService.updateEvent(event.getId(),
                    new EventUpdateDTO(scrumTypeId, null, null, null, null, null, null, null, null, null), authentication));
            verify(eventRepository, never()).save(any(Event.class));
        }

        @Test
        @DisplayName("En un partido que no está finalizado no se valida")
        void shouldNotValidateWhenMatchIsNotFinished() {
            Event event = existingEvent(MatchStatus.IN_PROGRESS);
            when(eventRepository.findActiveEventById(event.getId())).thenReturn(event);
            when(eventRepository.save(any(Event.class))).thenAnswer(call -> call.getArgument(0));

            eventService.updateEvent(event.getId(),
                    new EventUpdateDTO(null, null, null, 1800, null, null, null, null, null, null), authentication);

            verify(zoneRuleValidator, never()).validateEvent(any(), any());
        }
    }
}
