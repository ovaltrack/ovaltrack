package com.ovaltrack.backend.zone.business;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import com.ovaltrack.backend.zone.domain.ZoneCell;

@DisplayName("ZoneGrid: espejo y etiqueta de las celdas")
class ZoneGridTest {

    @ParameterizedTest(name = "fila {0} columna {1} -> fila {2} columna {3}")
    @CsvSource({"1,1,3,6", "1,6,3,1", "2,3,2,4", "2,6,2,1", "3,5,1,2"})
    @DisplayName("El espejo invierte la columna (6 <-> 1) y la fila (I <-> D)")
    void shouldMirrorBothAxes(int row, int col, int mirroredRow, int mirroredCol) {
        assertEquals(new ZoneCell(mirroredRow, mirroredCol), ZoneGrid.mirror(new ZoneCell(row, col)));
    }

    @Test
    @DisplayName("Espejar dos veces devuelve la celda original")
    void shouldBeItsOwnInverse() {
        for (int row = 1; row <= ZoneGrid.ROWS; row++) {
            for (int col = 1; col <= ZoneGrid.COLS; col++) {
                ZoneCell cell = new ZoneCell(row, col);
                assertEquals(cell, ZoneGrid.mirror(ZoneGrid.mirror(cell)));
            }
        }
    }

    @ParameterizedTest(name = "fila {0} columna {1} -> {2}")
    @CsvSource({"1,1,I1", "2,4,C4", "3,6,D6"})
    @DisplayName("La etiqueta es la letra de la fila seguida de la columna")
    void shouldLabelCells(int row, int col, String label) {
        assertEquals(label, ZoneGrid.label(new ZoneCell(row, col)));
    }
}
