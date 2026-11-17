package com.ovaltrack.backend.division.domain.dto.divisioncoachdto;

import java.time.LocalDate;
import java.util.UUID;

public record DivisionCoachResponseDTO(
        UUID id,

        UUID personId,

        UUID divisionId,

        LocalDate startDate,
        LocalDate endDate,
        String firstName,
        String lastName,
        String contactEmail,
        String contactPhone
) {
}