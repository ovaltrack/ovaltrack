package com.ovaltrack.backend.event.business;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

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
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("EventService: al guardar un tanteo se acorta el tramo que lo contiene")
class EventServiceTramoTrimTest {

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
    private UUID tryTypeId;
    private EventType tryType;
    private Match match;

    @BeforeEach
    void setUp() {
        matchId = UUID.randomUUID();
        tryTypeId = UUID.randomUUID();
        tryType = new EventType();
        tryType.setId(tryTypeId);
        tryType.setName("Try");
        tryType.setIsScoring(true);
        match = new Match();
        match.setId(matchId);
        match.setStatus(MatchStatus.FINISHED);
        lenient().when(eventRepository.save(any(Event.class))).thenAnswer(call -> {
            Event saved = call.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });
    }

    private EventCreationDTO creation(String origin) {
        return new EventCreationDTO(tryTypeId, matchId, null, null, EventPossession.OPPONENT,
                1350, 1350, null, 1, origin, Map.of(), null);
    }

    private Event existingTry() {
        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setMatch(match);
        event.setEventType(tryType);
        event.setTeamPossession(EventPossession.OPPONENT);
        event.setPeriod(1);
        event.setMatchTime(300);
        event.setActive(true);
        return event;
    }

    private EventUpdateDTO update(Integer matchTime, Map<String, Object> attributes, String note) {
        return new EventUpdateDTO(null, null, null, matchTime, null, null, null, attributes, null, note);
    }

    @Nested
    @DisplayName("saveEvent")
    class SaveEvent {

        @BeforeEach
        void stubCreation() {
            lenient().when(eventTypeService.findEventTypeEntityById(tryTypeId)).thenReturn(tryType);
            lenient().when(matchService.findMatchEntityById(matchId)).thenReturn(match);
        }

        @Test
        @DisplayName("Un alta post_capture acorta el tramo después de guardar el evento")
        void shouldTrimAfterSavingPostCaptureEvent() {
            eventService.saveEvent(creation(Event.ORIGIN_POST_CAPTURE), authentication);

            InOrder order = inOrder(eventRepository, tramoTrimmer);
            order.verify(eventRepository).save(any(Event.class));
            ArgumentCaptor<Event> trimmed = ArgumentCaptor.forClass(Event.class);
            order.verify(tramoTrimmer).trimAt(trimmed.capture());
            assertEquals(tryType, trimmed.getValue().getEventType());
        }

        @Test
        @DisplayName("Un alta de captura en vivo también acorta el tramo, aunque el partido ya esté finalizado")
        void shouldTrimAfterSavingLiveEvent() {
            eventService.saveEvent(creation("live-capture"), authentication);

            verify(tramoTrimmer).trimAt(any(Event.class));
        }

        @Test
        @DisplayName("Un alta repetida (mismo clientEventId) no vuelve a acortar nada")
        void shouldNotTrimAnAlreadySavedEvent() {
            UUID clientEventId = UUID.randomUUID();
            Event existing = existingTry();
            existing.setClientEventId(clientEventId);
            when(eventRepository.findByClientEventId(clientEventId)).thenReturn(existing);

            eventService.saveEvent(new EventCreationDTO(tryTypeId, matchId, clientEventId, null, EventPossession.OPPONENT,
                    1350, 1350, null, 1, "live-capture", Map.of(), null), authentication);

            verify(tramoTrimmer, never()).trimAt(any(Event.class));
        }
    }

    @Nested
    @DisplayName("updateEvent")
    class UpdateEvent {

        private Event event;

        @BeforeEach
        void stubExisting() {
            event = existingTry();
            when(eventRepository.findActiveEventById(event.getId())).thenReturn(event);
        }

        @Test
        @DisplayName("Corregir el tiempo del tanteo acorta el tramo que ahora lo contiene")
        void shouldTrimWhenTimeChanges() {
            eventService.updateEvent(event.getId(), update(1350, null, null), authentication);

            InOrder order = inOrder(eventRepository, tramoTrimmer);
            order.verify(eventRepository).save(event);
            order.verify(tramoTrimmer).trimAt(event);
        }

        @Test
        @DisplayName("Cambiar los atributos (Kick H de errado a convertido) vuelve a evaluar el corte")
        void shouldTrimWhenAttributesChange() {
            eventService.updateEvent(event.getId(), update(null, Map.of(), null), authentication);

            verify(tramoTrimmer).trimAt(event);
        }

        @Test
        @DisplayName("Editar solo la nota no toca los tramos")
        void shouldNotTrimWhenOnlyNoteChanges() {
            eventService.updateEvent(event.getId(), update(null, null, "buena jugada"), authentication);

            verify(tramoTrimmer, never()).trimAt(any(Event.class));
        }
    }

    @Test
    @DisplayName("Eliminar el tanteo no restaura el tramo: no hay nada que acortar ni que devolver")
    void shouldNotTouchTramosWhenDeletingEvent() {
        Event event = existingTry();
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));

        eventService.deleteEvent(event.getId(), authentication);

        verify(tramoTrimmer, never()).trimAt(any(Event.class));
    }
}
