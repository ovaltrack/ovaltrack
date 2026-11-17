package com.ovaltrack.backend.match.controller;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;

import com.ovaltrack.backend.match.business.MatchService;
import com.ovaltrack.backend.match.domain.MatchStatus;
import com.ovaltrack.backend.match.domain.dto.MatchCreationDTO;
import com.ovaltrack.backend.match.domain.dto.MatchResponseDTO;
import com.ovaltrack.backend.match.domain.dto.MatchUpdateDTO;
import com.ovaltrack.backend.match.domain.dto.RosterDTO;
import com.ovaltrack.backend.match.domain.dto.MatchRosterDTO;
import com.ovaltrack.backend.match.domain.dto.MatchRosterPlayerDTO;
import com.ovaltrack.backend.match.domain.dto.LiveMatchStateDTO;
import com.ovaltrack.backend.match.domain.dto.MatchTransitionDTO;
import com.ovaltrack.backend.common.dto.response.MessageResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("matches")
@Tag(name = "Matches", description = "Create, query, update, and delete matches")
@CrossOrigin(origins = "http://localhost:4200")
@RequiredArgsConstructor
public class MatchController {

    private final MatchService matchService;

    @Operation(summary = "List matches for a club", description = "Returns all matches associated with the club identified by the clubId query parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Matches returned successfully, even if there are none."),
            @ApiResponse(responseCode = "409", description = "The club or request could not be processed because of a business conflict.")
    })
    @GetMapping(value = "/club", params = "clubId")
    public ResponseEntity<Object> findAllMatchesByClubId(@RequestParam UUID clubId) {
        return ResponseEntity.ok(matchService.findAllMatchesByClubId(clubId));
    }

    @Operation(summary = "List matches for a division", description = "Returns all matches associated with the division identified by the divisionId query parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Matches returned successfully, even if there are none."),
            @ApiResponse(responseCode = "409", description = "The division or request could not be processed because of a business conflict.")
    })
    @GetMapping(value = "/division", params = "divisionId")
    public ResponseEntity<Object> findAllMatchesByDivisionId(@RequestParam UUID divisionId) {
        return ResponseEntity.ok(matchService.findAllMatchesByDivisionId(divisionId));
    }

    @Operation(summary = "Find a match", description = "Returns the match identified by the matchId path parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Match returned successfully."),
            @ApiResponse(responseCode = "404", description = "No match exists with the specified ID.")
    })
    @GetMapping("/{matchId}")
    public ResponseEntity<Object> findMatchById(@PathVariable UUID matchId) {
        MatchResponseDTO result = matchService.findMatchById(matchId);
        return (result != null) ? ResponseEntity.ok(result)
                : ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("No se encontro el partido"));
    }

    @Operation(summary = "Get the persisted live state of a match", description = "Returns the operational state currently persisted for the match.")
    @GetMapping("/{matchId}/live-state")
    public ResponseEntity<Object> getLiveMatchState(@PathVariable UUID matchId) {
        return ResponseEntity.ok(matchService.getLiveMatchState(matchId));
    }

    @Operation(summary = "Get the complete live capture bootstrap", description = "Returns the persisted match state, active match events, and event catalog needed to initialize live capture.")
    @GetMapping("/{matchId}/live-bootstrap")
    public ResponseEntity<Object> getLiveMatchBootstrap(@PathVariable UUID matchId) {
        return ResponseEntity.ok(matchService.getLiveMatchBootstrap(matchId));
    }

    @Operation(summary = "Get matches played by the authenticated player", description = "Returns the finished matches in which the authenticated user's person was part of the roster, "
            + "ordered by date descending. Each match includes the opponent, division, final score and the "
            + "player's role (TITULAR or SUPLENTE). Returns an empty list if the user has no associated person "
            + "or has not played any match.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Played matches retrieved successfully."),
            @ApiResponse(responseCode = "401", description = "No authenticated session."),
            @ApiResponse(responseCode = "404", description = "Authenticated user not found.")
    })
    @GetMapping("/me")
    public ResponseEntity<Object> findMyPlayedMatches(Authentication authentication) {
        return ResponseEntity.ok(matchService.findMyPlayedMatches(authentication));
    }

    @Operation(summary = "Update the persisted live state of a match", description = "Persists the operational state of the match using last-write-wins semantics.")
    @PutMapping("/{matchId}/live-state")
    public ResponseEntity<Object> updateLiveMatchState(
            @PathVariable UUID matchId,
            @Valid @RequestBody LiveMatchStateDTO request) {
        return ResponseEntity.ok(matchService.updateLiveMatchState(matchId, request));
    }

    @Operation(summary = "Create a match", description = "Creates a match from the request body and returns the created match.", requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Match data required to create a match.", required = true, content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = MatchCreationDTO.class))))
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Match created successfully."),
            @ApiResponse(responseCode = "400", description = "The request body contains malformed JSON or invalid request data."),
            @ApiResponse(responseCode = "409", description = "The match cannot be created because of a business or data-integrity conflict.")
    })
    @PostMapping
    public ResponseEntity<Object> saveMatch(@Valid @RequestBody MatchCreationDTO match) {
        return ResponseEntity.ok(matchService.saveMatch(match));
    }

    @Operation(summary = "Update a match", description = "Updates the match identified by the matchId path parameter and returns the updated match.", requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Match data required to update a match.", required = true, content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = MatchUpdateDTO.class))))
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Match updated successfully."),
            @ApiResponse(responseCode = "400", description = "The request body contains malformed JSON or invalid request data."),
            @ApiResponse(responseCode = "409", description = "The match cannot be updated because of a business or data-integrity conflict.")
    })
    @PutMapping("/{matchId}")
    public ResponseEntity<Object> updateMatch(
            @PathVariable UUID matchId,
            @Valid @RequestBody MatchUpdateDTO request) {
        return ResponseEntity.ok(matchService.updateMatch(matchId, request));
    }

    @Operation(summary = "Starts a match", description = "Starts the match identified by the matchId path parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Match started successfully."),
    })
    @PutMapping("/{matchId}/start")
    public ResponseEntity<Object> startMatch(
            @PathVariable UUID matchId,
            @RequestBody(required = false) MatchTransitionDTO request) {
        return ResponseEntity.ok(matchService.changeMatchStatus(matchId, MatchStatus.IN_PROGRESS, occurredAt(request)));
    }

    @Operation(summary = "Finish a match", description = "Finishes the match identified by the matchId path parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Match finished successfully."),
    })
    @PutMapping("/{matchId}/finish")
    public ResponseEntity<Object> finishMatch(
            @PathVariable UUID matchId,
            @RequestBody(required = false) MatchTransitionDTO request) {
        return ResponseEntity.ok(matchService.changeMatchStatus(matchId, MatchStatus.FINISHED, occurredAt(request)));
    }

    private static Instant occurredAt(MatchTransitionDTO request) {
        return request == null ? null : request.occurredAt();
    }

    @Operation(summary = "Cancels a match", description = "Softly deletes the match identified by the matchId path parameter.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Match cancelled successfully."),
    })
    @DeleteMapping("/{matchId}/cancel")
    public ResponseEntity<Object> cancelMatch(@PathVariable UUID matchId) {
        return ResponseEntity.ok(matchService.changeMatchStatus(matchId, MatchStatus.CANCELLED));
    }

    @PostMapping("/{matchId}/roster")
    public ResponseEntity<Void> saveMatchRoster(
            @PathVariable UUID matchId,
            @RequestBody MatchRosterDTO request,
            Authentication authentication) {
        matchService.saveMatchRoster(matchId, request.titulares(), request.suplentes(), authentication);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{matchId}/roster")
    public ResponseEntity<RosterDTO> getMatchRoster(@PathVariable UUID matchId, Authentication authentication) {
        RosterDTO roster = matchService.getSavedRoster(matchId, authentication);
        return ResponseEntity.ok(roster);
    }

    @Operation(summary = "Get roster players of the match", description = "Returns the players officially assigned to the match roster (starters and substitutes) ordered by role and name.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Match roster players returned successfully."),
            @ApiResponse(responseCode = "404", description = "Match not found.")
    })
    @GetMapping("/{matchId}/roster/players")
    public ResponseEntity<List<MatchRosterPlayerDTO>> getMatchRosterPlayers(
            @PathVariable UUID matchId, Authentication authentication) {
        return ResponseEntity.ok(matchService.getMatchRosterPlayers(matchId, authentication));
    }

    @Operation(summary = "Close first half of a match", description = "Closes the first half of an in-progress match, transitioning to HALFTIME.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "First half closed successfully."),
            @ApiResponse(responseCode = "403", description = "Access denied: insufficient permissions."),
            @ApiResponse(responseCode = "404", description = "Match not found."),
            @ApiResponse(responseCode = "409", description = "Match not in valid state to close first half.")
    })
    @PutMapping("/{matchId}/close-first-half")
    public ResponseEntity<Object> closeFirstHalf(@PathVariable UUID matchId, Authentication authentication) {
        return ResponseEntity.ok(matchService.closeFirstHalf(matchId, authentication));
    }

    @Operation(summary = "Start second half of a match", description = "Starts the second half of a match that is in HALFTIME, transitioning to IN_PROGRESS with period 2.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Second half started successfully."),
            @ApiResponse(responseCode = "403", description = "Access denied: insufficient permissions."),
            @ApiResponse(responseCode = "404", description = "Match not found."),
            @ApiResponse(responseCode = "409", description = "Match not in HALFTIME state.")
    })
    @PutMapping("/{matchId}/start-second-half")
    public ResponseEntity<Object> startSecondHalf(@PathVariable UUID matchId, Authentication authentication) {
        return ResponseEntity.ok(matchService.startSecondHalf(matchId, authentication));
    }
}