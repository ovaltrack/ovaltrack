package com.ovaltrack.backend.user.domain.dto;

import java.util.List;
import java.util.UUID;

import com.ovaltrack.backend.club.domain.dto.ClubResponseDTO;
import com.ovaltrack.backend.division.domain.dto.divisiondto.DivisionResponseDTO;
import com.ovaltrack.backend.user.domain.UserRole;

public record UserContextDTO(
    UUID userId,
    String email,
    UserRole role,
    UUID personId,
    String firstName,
    String lastName,
    ClubResponseDTO club,
    List<DivisionResponseDTO> activeDivisions,
    /** Cuenta nueva que todavía no vio la guía de funcionalidades: el frontend la arranca sola una vez. */
    boolean tutorialPending
) {
}
