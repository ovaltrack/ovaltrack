package com.ovaltrack.backend.auth.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.ovaltrack.backend.auth.dto.AuthResponse;
import com.ovaltrack.backend.auth.dto.LoginRequest;
import com.ovaltrack.backend.auth.dto.PasswordResetConfirmRequest;
import com.ovaltrack.backend.auth.dto.PasswordResetLinkResponse;
import com.ovaltrack.backend.auth.dto.PasswordResetRequest;
import com.ovaltrack.backend.auth.dto.PasswordResetTokenRequest;
import com.ovaltrack.backend.auth.dto.RegisterFromInvitationRequest;
import com.ovaltrack.backend.auth.registration.domain.dto.ClubRegistrationDTO;
import com.ovaltrack.backend.auth.registration.domain.dto.MemberRegistrationDTO;
import com.ovaltrack.backend.auth.service.AuthService;
import com.ovaltrack.backend.auth.service.PasswordResetService;
import com.ovaltrack.backend.common.dto.response.MessageResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication", description = "Registration, login, and password recovery")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    public AuthController(AuthService authService, PasswordResetService passwordResetService) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
    }

    @Operation(summary = "Register a new player or coach", description = "Creates a player or coach account and a registration request pending approval. "
            + "To register a club and its administrator, use POST /register-club.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Registration request created successfully. Pending approval."),
            @ApiResponse(responseCode = "409", description = "The request contains invalid or incomplete data, or violates a business rule.")
    })
    @PostMapping("/register")
    public ResponseEntity<MessageResponse> registrar(@Valid @RequestBody MemberRegistrationDTO request) {
        authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new MessageResponse("Solicitud de registro creada con éxito. Pendiente de aprobación"));
    }

    @Operation(summary = "Register a new club and its administrator", description = "Creates a club administrator account together with a club registration request. "
            + "Both remain pending until a platform administrator approves them and associates the administrator with the club.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Club registration request created successfully. Pending approval."),
            @ApiResponse(responseCode = "400", description = "The request contains invalid or incomplete data, or violates a business rule.")
    })
    @PostMapping("/register-club")
    public ResponseEntity<MessageResponse> registrarClub(@Valid @RequestBody ClubRegistrationDTO request) {
        authService.registerClub(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new MessageResponse("Solicitud de registro creada con éxito. Pendiente de aprobación"));
    }

    @Operation(summary = "Log in a user", description = "Authenticates the supplied credentials and returns a JWT token.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Credentials accepted and token returned."),
            @ApiResponse(responseCode = "400", description = "The credentials are invalid.")
    })
    @PostMapping("/login")
    public ResponseEntity<Object> login(@RequestBody LoginRequest request) {
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new MessageResponse("Credencial inválida"));
        }
    }

    @Operation(summary = "Request a password reset", description = "Accepts a password reset request for the supplied email address.")
    @ApiResponses({
            @ApiResponse(responseCode = "202", description = "Password reset request accepted.")
    })
    @PostMapping("/password-reset/request")
    public ResponseEntity<MessageResponse> passwordReset(@Valid @RequestBody PasswordResetRequest request) {
        passwordResetService.request(request.email());
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(new MessageResponse(PasswordResetService.REQUEST_ACCEPTED_MESSAGE));
    }

    @Operation(summary = "Validate a password reset link", description = "Checks that the link is unused, not expired and issued for password recovery.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "The link can be used; returns the account login email."),
            @ApiResponse(responseCode = "409", description = "The link is invalid, used or expired.")
    })
    @PostMapping("/password-reset/validate")
    public ResponseEntity<PasswordResetLinkResponse> validatePasswordReset(@Valid @RequestBody PasswordResetTokenRequest request) {
        return ResponseEntity.ok(new PasswordResetLinkResponse(passwordResetService.validate(request.token())));
    }

    @Operation(summary = "Set a new password from a reset link", description = "Consumes the link, changes the password and closes every open session of the account.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Password changed."),
            @ApiResponse(responseCode = "409", description = "The link is invalid, used or expired, or the password does not meet the policy.")
    })
    @PostMapping("/password-reset/confirm")
    public ResponseEntity<MessageResponse> confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest request) {
        passwordResetService.reset(request.token(), request.password());
        return ResponseEntity.ok(new MessageResponse(PasswordResetService.PASSWORD_CHANGED_MESSAGE));
    }

    // ---- AuthController (agrega este método junto a los otros) ----

    @Operation(summary = "Create an account from an invitation", description = "Creates the player's account linked to the invited person and consumes the invitation token.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Account created and linked to the person."),
            @ApiResponse(responseCode = "400", description = "Invalid data, invalid or expired token, or an account already exists.")
    })
    @PostMapping("/register/invitation")
    public ResponseEntity<MessageResponse> registerFromInvitation(
            @Valid @RequestBody RegisterFromInvitationRequest request) {
        authService.registerFromInvitation(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(new MessageResponse("Cuenta creada con éxito"));
    }
}