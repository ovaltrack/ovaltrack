package com.ovaltrack.backend.invitations.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ovaltrack.backend.invitations.domain.ClubPlayerResponse;
import com.ovaltrack.backend.invitations.domain.InvitationSummaryResponse;
import com.ovaltrack.backend.invitations.domain.InvitationTokenDTO;
import com.ovaltrack.backend.invitations.domain.InvitePlayerRequest;
import com.ovaltrack.backend.invitations.service.InvitationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/invitation")
@RequiredArgsConstructor
@Tag(name = "Invitations", description = "Player invitations to create their account")
public class InvitationController {

    private final InvitationService service;

    @Operation(summary = "List the players the caller can invite", description = "Club admins see every active player of the club; coaches only the players of the divisions they coach. Each row carries the account/invitation status.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Players returned, even if there are none."),
            @ApiResponse(responseCode = "403", description = "The caller is not a club admin or coach.")
    })
    @PreAuthorize("hasAnyRole('ADMIN_CLUB','COACH_ANALYST')")
    @GetMapping("/players")
    public ResponseEntity<List<ClubPlayerResponse>> findPlayers(Authentication authentication) {
        return ResponseEntity.ok(service.findPlayers(authentication));
    }

    @Operation(summary = "Invite a player (or resend the invitation)", description = "Sends a 72-hour link to the player's contact email. A pending link is replaced by the new one.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Invitation sent; returns the updated player row."),
            @ApiResponse(responseCode = "403", description = "The player is outside the caller's club or divisions."),
            @ApiResponse(responseCode = "404", description = "The player is not active in the club."),
            @ApiResponse(responseCode = "409", description = "The player already has an account, has no email or the email belongs to another account."),
            @ApiResponse(responseCode = "502", description = "The email could not be sent; nothing was saved.")
    })
    @PreAuthorize("hasAnyRole('ADMIN_CLUB','COACH_ANALYST')")
    @PostMapping
    public ResponseEntity<ClubPlayerResponse> invite(@Valid @RequestBody InvitePlayerRequest request,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.invite(request.personId(), authentication));
    }

    @Operation(summary = "Validate an invitation link", description = "Public. Returns what the sign-up form shows; does not consume the link.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "The link can be used."),
            @ApiResponse(responseCode = "409", description = "The link is invalid, used or expired, or the account already exists.")
    })
    @PostMapping("/validate")
    public ResponseEntity<InvitationSummaryResponse> validate(@Valid @RequestBody InvitationTokenDTO token) {
        return ResponseEntity.ok(service.validate(token.token()));
    }
}
