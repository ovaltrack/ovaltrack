package com.ovaltrack.backend.division.domain.dto.divisionplayerdto;

public enum DivisionPlayerImportStatus {
    IMPORTED,
    /** Fila válida en una vista previa (dryRun): se crearía al confirmar. */
    READY,
    DUPLICATE,
    INVALID
}
