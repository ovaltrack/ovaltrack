package com.ovaltrack.backend.division.domain.dto.divisionplayerdto;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DivisionPlayerImportRequestDTO(
        @NotNull(message = "El ID de la division es obligatorio")
        UUID divisionId,

        /** true: solo valida y detecta duplicados, sin crear nada (vista previa). */
        boolean dryRun,

        @NotEmpty(message = "La planilla no tiene jugadores para importar")
        @Size(max = DivisionPlayerImportRequestDTO.MAX_ROWS, message = "La planilla no puede tener más de 300 jugadores")
        List<DivisionPlayerImportRowDTO> rows
) {
    public static final int MAX_ROWS = 300;
}
