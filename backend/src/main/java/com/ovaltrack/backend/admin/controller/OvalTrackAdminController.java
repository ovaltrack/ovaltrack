package com.ovaltrack.backend.admin.controller;

import java.util.Collection;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ovaltrack.backend.admin.service.AdminService;
import com.ovaltrack.backend.club.business.ClubService;
import com.ovaltrack.backend.club.domain.ClubStatus;
import com.ovaltrack.backend.club.domain.dto.ClubResponseDTO;
import com.ovaltrack.backend.common.dto.response.MessageResponse;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.UserStatus;
import com.ovaltrack.backend.user.domain.dto.UserClubRegistration;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/admin/ovaltrack")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN_OVALTRACK')")
public class OvalTrackAdminController {

    private final AdminService adminService;
    private final UserService userService;
    private final ClubService clubService;

    /* ---------- Listados ---------- */

    /** Clubes pendientes de aprobación. */
    @GetMapping("/clubs/pending")
    public ResponseEntity<Collection<ClubResponseDTO>> getPendingClubs() {
        return ResponseEntity.ok(clubService.findClubByStatus(ClubStatus.PENDING));
    }

    /** Cuentas pendientes de aprobación. */
    @GetMapping("/users/pending")
    public ResponseEntity<Collection<UserClubRegistration>> getPendingUsers() {
        return ResponseEntity
                .ok(userService.findAllClubRegistrationsByStatusAndActive(UserStatus.PENDING_APPROVAL, null));
    }

    /**
     * Cuentas ya revisadas (excluye pendientes y ADMIN_OVALTRACK).
     * Sin parámetro devuelve activas e inactivas; con ?active=true|false filtra.
     */
    @GetMapping("/users")
    public ResponseEntity<Collection<UserClubRegistration>> getUsers(
            @RequestParam(required = false) Boolean active) {
        if (active == null) {
            return ResponseEntity.ok(userService.findAllClubRegistrationsByStatusAndActive(null, null));
        }
        return ResponseEntity.ok(userService.findAllClubRegistrationsByStatusAndActive(null, active));
    }

    /**
     * Clubes ya revisados. Sin parámetro devuelve ACTIVE y REJECTED;
     * con ?status=ACTIVE o ?status=REJECTED filtra.
     */
    @GetMapping("/clubs")
    public ResponseEntity<Collection<ClubResponseDTO>> getClubs(
            @RequestParam(required = false) ClubStatus status) {
        if (status == null) {
            return ResponseEntity.ok(clubService.findAllClubs());
        }
        return ResponseEntity.ok(clubService.findClubByStatus(status));
    }
    /* ---------- Clubes ---------- */

    @PostMapping("/clubs/{clubId}/approve")
    public ResponseEntity<MessageResponse> approveClub(
            @PathVariable UUID clubId, 
            @RequestParam UUID adminUserId) {
        adminService.approveClub(clubId,adminUserId);
        return ResponseEntity.ok(new MessageResponse("El club fue aprobado con éxito."));
    }

    @PostMapping("/clubs/{clubId}/reject")
    public ResponseEntity<MessageResponse> rejectClub(
            @PathVariable UUID clubId,
            Authentication authentication) {
        adminService.rejectClub(clubId);
        return ResponseEntity.ok(new MessageResponse("El club fue rechazado."));
    }

    @PostMapping("/clubs/{clubId}/reactivate")
    public ResponseEntity<MessageResponse> reactivateClub(@PathVariable UUID clubId) {
        adminService.reactivateClub(clubId);
        return ResponseEntity.ok(new MessageResponse("El club fue reactivado."));
    }

    /* ---------- Cuentas ---------- */

    @PostMapping("/users/{userId}/approve")
    public ResponseEntity<MessageResponse> approveAccount(
            @PathVariable UUID userId) {
        adminService.approveAccount(userId);
        return ResponseEntity.ok(new MessageResponse("La cuenta fue aprobada con éxito."));
    }

    @PostMapping("/users/{userId}/reject")
    public ResponseEntity<MessageResponse> rejectAccount(
            @PathVariable UUID userId,
            Authentication authentication) {
        adminService.rejectAccount(userId);
        return ResponseEntity.ok(new MessageResponse("La cuenta fue rechazada."));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<MessageResponse> activateUser(@PathVariable UUID id) {
        adminService.activateAccount(id);
        return ResponseEntity.ok(new MessageResponse("La cuenta del usuario a sido activada correctamente."));
    }

    @DeleteMapping("/{id}/deactivate")
    public ResponseEntity<MessageResponse> deactivateUser(@PathVariable UUID id) {
        adminService.deactivateAccount(id);
        return ResponseEntity.ok(new MessageResponse("La cuenta del usuario a sido desactivada correctamente."));
    }

}