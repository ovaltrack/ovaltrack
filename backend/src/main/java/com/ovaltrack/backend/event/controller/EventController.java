package com.ovaltrack.backend.event.controller;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;

import com.ovaltrack.backend.event.business.EventService;
import com.ovaltrack.backend.event.domain.dto.event.EventCreationDTO;
import com.ovaltrack.backend.event.domain.dto.event.EventResponseDTO;
import com.ovaltrack.backend.event.domain.dto.event.EventUpdateDTO;
import com.ovaltrack.backend.common.dto.response.MessageResponse;
import com.ovaltrack.backend.zone.business.PostMatchZoneEnricher;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("event")
@Tag(name = "Events", description = "Create, query, update, and delete match events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;
    private final PostMatchZoneEnricher postMatchZoneEnricher;

    @Operation(summary = "List events for a club", description = "Returns all events associated with the club identified by the clubId query parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Events returned successfully, even if there are none."),
            @ApiResponse(responseCode = "409", description = "The club or request could not be processed because of a business conflict.")
    })
    @GetMapping("/club")
    public ResponseEntity<Object> findEventsByClubId(@RequestParam UUID clubId) {
        return ResponseEntity.ok(eventService.findEventsByClubId(clubId));
    }

    @Operation(summary = "List events for a division", description = "Returns all events associated with the division identified by the divisionId query parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Events returned successfully, even if there are none."),
            @ApiResponse(responseCode = "409", description = "The division or request could not be processed because of a business conflict.")
    })
    @GetMapping("/division")
    public ResponseEntity<Object> findEventsByDivisionId(@RequestParam UUID divisionId) {
        return ResponseEntity.ok(eventService.findEventsByDivisionId(divisionId));
    }

    @Operation(summary = "List events for a match", description = "Returns all events associated with the match identified by the matchId query parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Events returned successfully, even if there are none."),
            @ApiResponse(responseCode = "409", description = "The match or request could not be processed because of a business conflict.")
    })
    @GetMapping("/match")
    public ResponseEntity<Object> findEventsByMatchId(@RequestParam UUID matchId) {
        return ResponseEntity.ok(eventService.findEventsByMatchId(matchId));
    }

    @Operation(summary = "List events for a closed match review", description = "Returns all events for a match, strictly validating that the match is in FINISHED state.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Events returned successfully."),
            @ApiResponse(responseCode = "403", description = "Forbidden: user cannot manage this match."),
            @ApiResponse(responseCode = "409", description = "The match is not closed or cannot be processed.")
    })
    @GetMapping("/match/post-match")
    @PreAuthorize("hasAnyRole('ADMIN_OVALTRACK', 'ADMIN_CLUB', 'COACH_ANALYST')")
    public ResponseEntity<Object> findPostMatchEvents(@RequestParam UUID matchId, Authentication authentication) {
        return ResponseEntity
                .ok(postMatchZoneEnricher.enrich(matchId, eventService.findPostMatchEvents(matchId, authentication)));
    }

    @Operation(summary = "Find an event", description = "Returns the event identified by the eventId path parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Event returned successfully."),
            @ApiResponse(responseCode = "404", description = "No event exists with the specified ID.")
    })
    @GetMapping("/{eventId}")
    public ResponseEntity<Object> findEventById(@PathVariable UUID eventId) {
        EventResponseDTO result = eventService.findEventById(eventId);
        return (result != null) ? ResponseEntity.ok(result)
                : ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Evento no encontrado"));
    }

    @Operation(summary = "Create an event", description = "Creates an event from the request body and returns the created event.", requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Event data required to create an event.", required = true, content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = EventCreationDTO.class))))
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Event created successfully."),
            @ApiResponse(responseCode = "400", description = "The request body contains malformed JSON or invalid request data."),
            @ApiResponse(responseCode = "409", description = "The request is invalid or the event cannot be saved because of a business or data-integrity conflict.")
    })
    @PostMapping
    public ResponseEntity<Object> saveEvent(@Valid @RequestBody EventCreationDTO eventRequest,
            Authentication authentication) {
        return ResponseEntity.ok(eventService.saveEvent(eventRequest, authentication));
    }

    @Operation(summary = "Delete an event", description = "Deletes the event identified by the eventId path parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Event deleted successfully."),
            @ApiResponse(responseCode = "409", description = "The event cannot be deleted because of a business or data-integrity conflict.")
    })
    @DeleteMapping("/{eventId}")
    public ResponseEntity<EventResponseDTO> deleteEvent(@PathVariable UUID eventId, Authentication authentication) {
        return ResponseEntity.ok(eventService.deleteEvent(eventId, authentication));
    }

    @Operation(summary = "Update an event", description = "Updates the event identified by the eventId path parameter and returns the updated event.", requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Event data required for update.", required = true, content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = EventUpdateDTO.class))))
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Event updated successfully."),
            @ApiResponse(responseCode = "400", description = "The request body contains malformed JSON or invalid request data."),
            @ApiResponse(responseCode = "409", description = "The event cannot be updated because of a business or data-integrity conflict.")
    })
    @PatchMapping("/{eventId}")
    public ResponseEntity<Object> updateEvent(@PathVariable UUID eventId, @Valid @RequestBody EventUpdateDTO request,
            Authentication authentication) {
        return ResponseEntity.ok(eventService.updateEvent(eventId, request, authentication));
    }

}
