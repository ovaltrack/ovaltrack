package com.ovaltrack.backend.division.domain.dto.divisionplayerdto;

import java.time.LocalDate;
import java.util.UUID;

public record DivisionPlayerResponseDTO(
        UUID id,

        UUID personId,

        UUID divisionId,

        Integer jerseyNumber,

        String position,

        LocalDate startDate,

        LocalDate endDate,
        String firstName,
        String lastName,
        String contactEmail,
        String contactPhone
) {
}