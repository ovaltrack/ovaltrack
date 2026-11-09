package com.ovaltrack.backend.user.domain.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import com.ovaltrack.backend.club.domain.ClubStatus;
import com.ovaltrack.backend.division.domain.dto.divisiondto.DivisionResponseDTO;
import com.ovaltrack.backend.user.domain.UserRole;
import com.ovaltrack.backend.user.domain.UserStatus;

import io.swagger.v3.oas.annotations.media.Schema;

/** Perfil del usuario autenticado: cuenta, datos personales, club y divisiones. */
@Schema(description = "Perfil del usuario autenticado")
public record UserProfileDTO(
        AccountData account,
        @Schema(description = "Datos personales; null si la cuenta no tiene persona asociada")
        PersonData person,
        @Schema(description = "Club del usuario; null si no pertenece a ninguno")
        ClubData club,
        List<DivisionResponseDTO> divisions) {

    public record AccountData(
            UUID userId,
            String loginEmail,
            UserRole role,
            UserStatus status,
            LocalDateTime memberSince,
            String termsVersion,
            LocalDateTime termsAcceptedAt) {
    }

    public record PersonData(
            UUID personId,
            String firstName,
            String lastName,
            LocalDate birthDate,
            String contactEmail,
            String contactPhone) {
    }

    public record ClubData(
            UUID id,
            String name,
            String city,
            String logoUrl,
            ClubStatus status,
            String contactEmail,
            String contactPhone,
            @Schema(description = "Nombre y apellido del administrador del club")
            String adminName) {
    }
}
