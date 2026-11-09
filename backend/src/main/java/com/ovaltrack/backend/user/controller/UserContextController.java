package com.ovaltrack.backend.user.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ovaltrack.backend.user.business.UserContextService;
import com.ovaltrack.backend.user.business.UserProfileService;
import com.ovaltrack.backend.user.domain.dto.UpdateContactRequest;
import com.ovaltrack.backend.user.domain.dto.UserProfileDTO;
import com.ovaltrack.backend.user.domain.dto.UserContextDTO;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/me")
@Tag(name = "User Context", description = "Contextual information and club membership for the currently authenticated user")
@RequiredArgsConstructor
public class UserContextController {

    private final UserContextService userContextService;
    private final UserProfileService userProfileService;

    @Operation(summary = "Get current authenticated user context", description = "Returns identity, person details, assigned club, and active divisions for the authenticated user.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User context returned successfully."),
            @ApiResponse(responseCode = "401", description = "Unauthorized - Missing or invalid token."),
            @ApiResponse(responseCode = "404", description = "User not found.")
    })
    @GetMapping
    public ResponseEntity<UserContextDTO> getMe(Authentication authentication) {
        return ResponseEntity.ok(userContextService.getUserContext(authentication));
    }

    @Operation(summary = "Get the authenticated user's profile", description = "Account, personal data, club and divisions of the authenticated user.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Profile returned successfully."),
            @ApiResponse(responseCode = "401", description = "Unauthorized - Missing or invalid token.")
    })
    @GetMapping("/profile")
    public ResponseEntity<UserProfileDTO> getProfile(Authentication authentication) {
        return ResponseEntity.ok(userProfileService.getProfile(authentication.getName()));
    }

    @Operation(summary = "Update the authenticated user's contact data", description = "Updates contact email and phone. The login email does not change.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Contact updated; returns the updated profile."),
            @ApiResponse(responseCode = "401", description = "Unauthorized - Missing or invalid token."),
            @ApiResponse(responseCode = "409", description = "Invalid data or contact email already in use.")
    })
    @PatchMapping("/profile/contact")
    public ResponseEntity<UserProfileDTO> updateContact(Authentication authentication,
            @Valid @RequestBody UpdateContactRequest request) {
        return ResponseEntity.ok(userProfileService.updateContact(authentication.getName(), request));
    }
}
