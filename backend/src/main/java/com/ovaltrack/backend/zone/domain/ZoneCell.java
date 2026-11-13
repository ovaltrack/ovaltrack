package com.ovaltrack.backend.zone.domain;

/** Celda de la grilla de la cancha, indexada desde 1. */
public record ZoneCell(int row, int col) {

    private static final String ROW_LETTERS = "ICD";

    /** Letra de la fila: 1 = I (izquierda), 2 = C (centro), 3 = D (derecha). */
    public static String rowLetter(int row) {
        return String.valueOf(ROW_LETTERS.charAt(row - 1));
    }
}
