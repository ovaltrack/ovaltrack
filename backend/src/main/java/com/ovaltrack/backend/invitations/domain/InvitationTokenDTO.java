package com.ovaltrack.backend.invitations.domain;

import jakarta.validation.constraints.NotBlank;

public record InvitationTokenDTO(
    @NotBlank(message = "El enlace de invitación no es válido. Revisá que esté completo o pedile al club uno nuevo.") 
    String token
) {
}