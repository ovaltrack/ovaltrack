package com.ovaltrack.backend.division.controller;

import java.util.UUID;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;

import com.ovaltrack.backend.division.business.DivisionPlayerImportService;
import com.ovaltrack.backend.division.business.DivisionPlayerService;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerCreationDTO;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerImportRequestDTO;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerImportResultDTO;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerPersonUserResponseDTO;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerResponseDTO;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerUpdateDTO;
import com.ovaltrack.backend.division.domain.dto.DivisionHistoryPersonDTO;
import com.ovaltrack.backend.common.dto.response.MessageResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("players")
@Tag(name = "Division players", description = "Manage players registered in divisions")
@RequiredArgsConstructor
public class DivisionPlayerController {

    private final DivisionPlayerService divisionPlayerService;
    private final DivisionPlayerImportService divisionPlayerImportService;
   
    @Operation(
        summary = "List a page of the active players in a division",
        description = "Returns a page of active players associated with the division identified by the divisionId query parameter."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Division players returned successfully, even if there are none."),
        @ApiResponse(responseCode = "409", description = "The division or request could not be processed because of a business conflict.")
    })
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Object> findPaginatedActiveDivisionPlayersByDivision(
            @RequestParam UUID divisionId,
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(divisionPlayerService.findPaginatedActiveDivisionPlayersByDivision(divisionId, page, size, search, authentication));
    }

    @GetMapping("/history/people")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<org.springframework.data.domain.Page<DivisionHistoryPersonDTO>> findHistoryPeople(
            @RequestParam UUID divisionId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size, @RequestParam(required = false) String search,
            Authentication authentication) {
        return ResponseEntity.ok(divisionPlayerService.findHistoryPeople(divisionId, page, size, search, authentication));
    }

    @Operation(
        summary = "List division players with person and user data",
        description = "Returns the division-player associations joined with their person and optional user account."
    )
    @GetMapping("/with-user")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<List<DivisionPlayerPersonUserResponseDTO>> findDivisionPlayersWithPersonAndUser(
            @RequestParam UUID divisionId,
            Authentication authentication) {
        return ResponseEntity.ok(
                divisionPlayerService.findDivisionPlayersWithPersonAndUser(divisionId, authentication));
    }

    @Operation(
        summary = "List the history of a DivisionPlayer",
        description = "Returns all DivisionPlayers based on the request parameters divisionId and personId"
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Division players returned successfully, even if there are none."),
        @ApiResponse(responseCode = "409", description = "The division or request could not be processed because of a business conflict.")
    })
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Object> findDivisionPlayersByDivisionIdAndPersonId(
            @RequestParam UUID divisionId,
            @RequestParam UUID personId,
            Authentication authentication) {
        return ResponseEntity.ok(divisionPlayerService.findDivisionPlayersByDivisionIdAndPersonId(divisionId, personId, authentication));
    }



    @Operation(
        summary = "Find a division player",
        description = "Returns the division-player association identified by the divisionPlayerId path parameter."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Division player returned successfully."),
        @ApiResponse(responseCode = "404", description = "No player association exists with the specified ID.")
    })
    @GetMapping("/{divisionPlayerId}")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Object> findDivisionPlayerById(
            @PathVariable UUID divisionPlayerId,
            Authentication authentication) {
        DivisionPlayerResponseDTO result = divisionPlayerService.findDivisionPlayerById(divisionPlayerId, authentication);
        return (result != null) ? ResponseEntity.ok(result)
        : ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("No se encontro al jugador asociado a la division"));
    }

    @Operation(
        summary = "Register a player in a division",
        description = "Creates a division-player association from the request body and returns it.",
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            description = "Player data required to register a player in a division.",
            required = true,
            content = @io.swagger.v3.oas.annotations.media.Content(
                schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = DivisionPlayerCreationDTO.class)
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Player registered in the division successfully."),
        @ApiResponse(responseCode = "400", description = "The request body contains malformed JSON or invalid request data."),
        @ApiResponse(responseCode = "409", description = "The association cannot be created because of a business or data-integrity conflict.")
    })
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Object> saveDivisionPlayer(
            @Valid @RequestBody DivisionPlayerCreationDTO aDivisionPlayerRequest,
            Authentication authentication) {
        return ResponseEntity.ok(divisionPlayerService.saveDivisionPlayer(aDivisionPlayerRequest, authentication));
    }

    @Operation(
        summary = "Import a division's roster in bulk",
        description = "Creates the players of a spreadsheet in the division. Each row is resolved on its own: "
                + "IMPORTED, DUPLICATE (already in the club or repeated in the file) or INVALID (with the column and reason). "
                + "With dryRun=true nothing is created and valid rows come back as READY (preview)."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Rows processed; the body reports the result of each one."),
        @ApiResponse(responseCode = "403", description = "Only the club admin or an assigned coach of the division can import."),
        @ApiResponse(responseCode = "409", description = "The division does not exist or the request is empty or too large.")
    })
    @PostMapping("/import")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST')")
    public ResponseEntity<DivisionPlayerImportResultDTO> importDivisionPlayers(
            @Valid @RequestBody DivisionPlayerImportRequestDTO request,
            Authentication authentication) {
        return ResponseEntity.ok(divisionPlayerImportService.importPlayers(request, authentication));
    }

    @Operation(
        summary = "Remove a player from a division",
        description = "Deletes the division-player association identified by the divisionPlayerId path parameter."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Player removed from the division successfully."),
        @ApiResponse(responseCode = "409", description = "The association cannot be deleted because of a business or data-integrity conflict.")
    })
    @DeleteMapping("/{divisionPlayerId}")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Object> deleteDivisionPlayer(
            @PathVariable UUID divisionPlayerId,
            Authentication authentication) {
        divisionPlayerService.deleteDivisionPlayer(divisionPlayerId, authentication);
        return ResponseEntity.ok(new MessageResponse("Jugador eliminado correctamente"));
    }

    @Operation(
        summary = "Update a division player",
        description = "Updates the division-player association identified by the divisionPlayerId path parameter.",
        requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
            description = "Player data required to update the division-player association.",
            required = true,
            content = @io.swagger.v3.oas.annotations.media.Content(
                schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = DivisionPlayerUpdateDTO.class)
            )
        )
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Division player updated successfully."),
        @ApiResponse(responseCode = "400", description = "The request body contains malformed JSON or invalid request data."),
        @ApiResponse(responseCode = "409", description = "The association cannot be updated because of a business or data-integrity conflict.")
    })
    @PutMapping("/{divisionPlayerId}")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<Object> updateDivisionPlayer(
            @PathVariable UUID divisionPlayerId,
            @Valid @RequestBody DivisionPlayerUpdateDTO request,
            Authentication authentication) {
        return ResponseEntity.ok(divisionPlayerService.updateDivisionPlayer(divisionPlayerId, request, authentication));
    }

}
