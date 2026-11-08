package com.ovaltrack.backend.club.controller;

import java.util.Collection;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestBody;

import com.ovaltrack.backend.club.business.ClubService;
import com.ovaltrack.backend.club.domain.dto.ClubCreationDTO;
import com.ovaltrack.backend.club.domain.dto.ClubResponseDTO;
import com.ovaltrack.backend.club.domain.dto.ClubUpdateDTO;
import com.ovaltrack.backend.common.dto.response.MessageResponse;
import com.ovaltrack.backend.member.dto.bussines.MemberService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RequestParam;

@RestController
@RequestMapping("club")
@Tag(name = "Clubs", description = "Create, query, update, and delete clubs")
@RequiredArgsConstructor
public class ClubController {

    private final ClubService clubService;
    private final MemberService memberService; // <- Inyectar el MemberService

    @Operation(summary = "Get current authenticated user's club", description = "Returns the club managed by the authenticated club admin.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Club returned successfully."),
            @ApiResponse(responseCode = "404", description = "No club is associated with the authenticated user."),
            @ApiResponse(responseCode = "409", description = "Business conflict or unauthenticated access.")
    })
    
    @GetMapping("/my-club")
    public ResponseEntity<Object> getMyClub(org.springframework.security.core.Authentication authentication) {
        ClubResponseDTO result = clubService.findClubForAuthenticatedUser(authentication);
        return (result != null) ? ResponseEntity.ok(result)
                : ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Club no encontrado"));
    }

    // Reemplaza el método getMyClubMembers por este:
    @Operation(summary = "Get current authenticated club's members", description = "Returns the members/persons associated with the authenticated user's club.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Members returned successfully."),
            @ApiResponse(responseCode = "404", description = "No club is associated with the authenticated user.")
    })
    @GetMapping("/my-club/members")
    public ResponseEntity<Object> getMyClubMembers(org.springframework.security.core.Authentication authentication) {
        // Obtenemos primero el club del usuario autenticado a través del servicio que ya funciona
        ClubResponseDTO club = clubService.findClubForAuthenticatedUser(authentication);
        if (club == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Club no encontrado"));
        }
        
        // Retornamos la lista combinada (Personas + Usuarios) usando el club.id()
        return ResponseEntity.ok(memberService.getClubMembers(club.id()));
    }

    @Operation(summary = "List all clubs in the system", description = "Returns every club registered in the system.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Clubs returned successfully, even if there are none.")
    })
    @GetMapping
    public ResponseEntity<Object> findAllClubs() {
        return ResponseEntity.ok(clubService.findAllClubs());
    }

    @Operation(summary = "List active clubs available for registration", description = "Returns public club identification details for registration forms.")
    @GetMapping("/registration-options")
    public ResponseEntity<Object> findRegistrationOptions() {
        return ResponseEntity.ok(clubService.findRegistrationOptions());
    }

    @Operation(summary = "Find a specific club in the system", description = "Return the specified club in the path variable.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Clubs returned successfully."),
            @ApiResponse(responseCode = "404", description = "The ID does not belong to any club in the system.")
    })
    @GetMapping("/{clubId}")
    public ResponseEntity<Object> findClubById(@PathVariable UUID clubId) {
        ClubResponseDTO result = clubService.findClubById(clubId);
        return (result != null) ? ResponseEntity.ok(result)
                : ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Club no encontrado"));
    }

    @GetMapping("/actives-clubs")
    public Collection<ClubResponseDTO> findAllActives() {
        return this.clubService.findAllActives();
    }

    @GetMapping("/search/{term}")
    public ResponseEntity<Collection<ClubResponseDTO>> search(@PathVariable("term") String term) {

        return ResponseEntity.ok(this.clubService.search(term));
    }

    @Operation(summary = "Create a club in the system", description = "Creates a club in the system and returns it", requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Club data required to create a club.", required = true, content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = ClubCreationDTO.class))))
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Club created successfully."),
            @ApiResponse(responseCode = "400", description = "The request body contains malformed JSON or invalid request data."),
            @ApiResponse(responseCode = "409", description = "The request is invalid or the club cannot be saved because of a business or data-integrity conflict.")
    })
    @PostMapping
    public ResponseEntity<Object> saveClub(@Valid @RequestBody ClubCreationDTO aClub) {
        return ResponseEntity.ok(clubService.saveClub(aClub));
    }

    @Operation(summary = "Updates a club in the system", description = "Updates a club in the system and returns it", requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "Club data required to update a club.", required = true, content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = ClubUpdateDTO.class))))
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Club updated successfully."),
            @ApiResponse(responseCode = "400", description = "The request body contains malformed JSON or invalid request data."),
            @ApiResponse(responseCode = "409", description = "The club cannot be updated because of a business or data-integrity conflict.")
    })
    @PutMapping("/{clubId}")
    public ResponseEntity<Object> updateClub(@PathVariable UUID clubId, @Valid @RequestBody ClubUpdateDTO request) {
        return ResponseEntity.ok(clubService.updateClub(clubId, request));
    }

    @Operation(summary = "Delete a club", description = "Deletes the club identified by the UUID. The operation fails when related entities prevent deletion.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Club deleted successfully."),
            @ApiResponse(responseCode = "409", description = "The club cannot be deleted because of a business or data-integrity conflict.")
    })
    @DeleteMapping("/{clubId}")
    public ResponseEntity<Object> deleteClub(@PathVariable UUID clubId) {
        clubService.deleteClub(clubId);
        return ResponseEntity.ok(new MessageResponse("Club eliminado correctamente"));
    }
}
