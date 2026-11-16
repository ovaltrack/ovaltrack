package com.ovaltrack.backend.division.domain.dto.divisionplayerdto;

import java.util.List;

public record DivisionPlayerImportResultDTO(
        int imported,
        int skipped,
        List<DivisionPlayerImportRowResultDTO> rows
) {
}
