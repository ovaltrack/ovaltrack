package com.ovaltrack.backend.member.dto;

import java.time.LocalDate;
import java.util.UUID;

public record MemberResponseDTO(
    UUID id,             // ID del Usuario (si tiene cuenta)
    UUID personId,       // ID de la Persona
    String firstName,
    String lastName,
    String email,        // Email de contacto de la persona
    String loginEmail,   // Email con el que inicia sesión (si tiene cuenta)
    String role,         // Rol del usuario (ej. ADMIN_CLUB, PLAYER)
    Boolean active,       // Si está activo o dado de baja
    LocalDate birthDate,    // <-- ¿Está este campo?
    String contactPhone
) {}