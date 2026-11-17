package com.ovaltrack.backend.division.controller;

import java.util.UUID;
import java.util.Collection;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;

import com.ovaltrack.backend.division.business.DivisionCoachService;
import com.ovaltrack.backend.division.domain.dto.divisioncoachdto.DivisionCoachCreationDTO;
import com.ovaltrack.backend.division.domain.dto.divisioncoachdto.DivisionCoachResponseDTO;
import com.ovaltrack.backend.division.domain.dto.DivisionHistoryPersonDTO;
import com.ovaltrack.backend.common.dto.response.MessageResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("coaches")
@Tag(name = "Division coaches", description = "Manage coaches registered in divisions")
@RequiredArgsConstructor
public class DivisionCoachController {

    private final DivisionCoachService divisionCoachService;

    @Operation(
        summary = "List active coaches in a division",
        description = "Returns all active coaches associated with the division identified by the divisionId query parameter."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Division coaches returned successfully, even if there are none."),
        @ApiResponse(responseCode = "409", description = "The division or request could not be processed because of a business conflict.")
    })
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Object> findActiveDivisionCoachesByDivisionId(
            @RequestParam UUID divisionId,
            Authentication authentication) {
        return ResponseEntity.ok(divisionCoachService.findActiveDivisionCoachesByDivisionId(divisionId, authentication));
    }

    @GetMapping("/history/people")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Collection<DivisionHistoryPersonDTO>> findHistoryPeople(
            @RequestParam UUID divisionId, @RequestParam(required = false) String search,
            Authentication authentication) {
        return ResponseEntity.ok(divisionCoachService.findHistoryPeople(divisionId, search, authentication));
    }

    @Operation(
        summary = "List history of a coach in a division",
        description = "Returns the history of a coach associated with the division identified by the divisionId query parameter and personId."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Division coaches returned successfully, even if there are none."),
        @ApiResponse(responseCode = "409", description = "The division or request could not be processed because of a business conflict.")
    })
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Object> findActiveDivisionCoachesByDivisionId(
            @RequestParam UUID divisionId,
            @RequestParam UUID personId,
            Authentication authentication) {
        return ResponseEntity.ok(divisionCoachService.findDivisionCoachesByDivisionIdAndPersonId(divisionId, personId, authentication));
    }


    @Operation(
        summary = "Find a division coach",
        description = "Returns the division-coach association identified by the divisionCoachId path parameter."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Division coach returned successfully."),
        @ApiResponse(responseCode = "404", description = "No coach association exists with the specified ID.")
    })
    @GetMapping("/{divisionCoachId}")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Object> findDivisionCoachById(
            @PathVariable UUID divisionCoachId,
            Authentication authentication) {
        DivisionCoachResponseDTO result = divisionCoachService.findDivisionCoachById(divisionCoachId, authentication);
        return (result != null) ? ResponseEntity.ok(result)
        : ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("No se encontro al entrenador asociado a la division"));

    }

    @Operation(
        summary = "Register a coach in a division",
        description = "Creates a division-coach association from the request body and returns it.",
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            description = "Coach data required to register a coach in a division.",
            required = true,
            content = @io.swagger.v3.oas.annotations.media.Content(
                schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = DivisionCoachCreationDTO.class)
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Coach registered in the division successfully."),
        @ApiResponse(responseCode = "400", description = "The request body contains malformed JSON or invalid request data."),
        @ApiResponse(responseCode = "409", description = "The association cannot be created because of a business or data-integrity conflict.")
    })
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Object> saveDivisionCoach(
            @Valid @RequestBody DivisionCoachCreationDTO divisionCoach,
            Authentication authentication) {
        return ResponseEntity.ok(divisionCoachService.saveDivisionCoach(divisionCoach, authentication));
    }

    @Operation(
        summary = "Remove a coach from a division",
        description = "Deletes the division-coach association identified by the divisionCoachId path parameter."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Coach removed from the division successfully."),
        @ApiResponse(responseCode = "409", description = "The association cannot be deleted because of a business or data-integrity conflict.")
    })
    @DeleteMapping("/{divisionCoachId}")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Object> deleteDivisionCoach(
            @PathVariable UUID divisionCoachId,
            Authentication authentication) {
        divisionCoachService.deleteDivisionCoach(divisionCoachId, authentication);
        return ResponseEntity.ok(new MessageResponse("Entrenador eliminado correctamente"));
    }

}
