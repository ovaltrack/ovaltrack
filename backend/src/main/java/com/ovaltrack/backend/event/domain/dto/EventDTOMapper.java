package com.ovaltrack.backend.event.domain.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.ovaltrack.backend.event.domain.Actor;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.domain.PossessionAfter;
import com.ovaltrack.backend.event.domain.dto.event.EventCreationDTO;
import com.ovaltrack.backend.event.domain.dto.event.EventResponseDTO;
import com.ovaltrack.backend.event.domain.dto.event.MatchTimelineEventResponseDTO;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.person.domain.Person;

public final class EventDTOMapper {

    private EventDTOMapper() {
    }

    public static Event toEntity(EventCreationDTO request, Match match, EventType eventType, Person player) {
        if (request == null) {
            return null;
        }

        Event event = new Event();
        event.setClientEventId(request.clientEventId());
        event.setEventType(eventType);
        event.setMatch(match);
        event.setPlayer(player);
        event.setTeamPossession(request.teamPossession());
        event.setMatchTime(request.matchTime());
        event.setAbsoluteMatchTime(request.absoluteMatchTime());
        event.setRealTime(request.realTime() != null ? request.realTime() : LocalDateTime.now());
        event.setPeriod(request.period());
        event.setOrigin(request.origin());
        event.setAttributes(request.attributes());
        event.setSynchronizedAt(LocalDateTime.now());
        event.setActive(true);
        return event;
    }

    public static EventResponseDTO toResponseDTO(Event event) {
        if (event == null) {
            return null;
        }

        return new EventResponseDTO(
                event.getId(),
                event.getClientEventId(),
                event.getEventType() == null ? null : event.getEventType().getId(),
                event.getMatch() == null ? null : event.getMatch().getId(),
                event.getPlayer() == null ? null : event.getPlayer().getId(),
                event.getTeamPossession(),
                event.getMatchTime(),
                event.getAbsoluteMatchTime(),
                event.getRealTime(),
                event.getPeriod(),
                event.getOrigin(),
                event.getAttributes(),
                event.getCreatedAt(),
                event.getSynchronizedAt(),
                event.getActive(),
                event.getNote());
    }

    public static EventTypeResponseDTO toResponseDTO(EventType eventType) {
        if (eventType == null) {
            return null;
        }

        return new EventTypeResponseDTO(
                eventType.getId(),
                eventType.getName(),
                eventType.getGroupName(),
                eventType.getCategory(),
                Boolean.TRUE.equals(eventType.getIsScoring()),
                eventType.getPoints(),
                Boolean.TRUE.equals(eventType.getRequiresPlayer()),
                Boolean.TRUE.equals(eventType.getIsActive()),
                eventType.getCode(),
                Boolean.TRUE.equals(eventType.getShowInPalette()),
                eventType.getFollowUpEventTypeId(),
                eventType.getStatView(),
                eventType.getActor() == null ? Actor.ATTACKING : eventType.getActor(),
                eventType.getPossessionAfter() == null ? PossessionAfter.KEEP : eventType.getPossessionAfter(),
                eventType.getFollowUpChoices() == null ? List.of() : eventType.getFollowUpChoices(),
                eventType.getTemplateEventFields(),
                null);
    }

    public static MatchTimelineEventResponseDTO toTimelineResponseDTO(Event event) {
        if (event == null) {
            return null;
        }

        String eventTypeName = event.getEventType() != null ? event.getEventType().getName() : null;
        String playerName = null;
        if (event.getPlayer() != null) {
            playerName = (event.getPlayer().getFirstName() + " " + event.getPlayer().getLastName()).trim();
        }

        return new MatchTimelineEventResponseDTO(
                event.getId(),
                event.getEventType() != null ? event.getEventType().getId() : null,
                eventTypeName,
                event.getPlayer() != null ? event.getPlayer().getId() : null,
                playerName,
                null,
                event.getMatchTime(),
                event.getAbsoluteMatchTime(),
                event.getRealTime(),
                event.getPeriod(),
                event.getTeamPossession(),
                event.getOrigin(),
                event.getAttributes(),
                event.getNote(),
                null);
    }
}