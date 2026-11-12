package com.ovaltrack.backend.zone.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

@DisplayName("ZoneRule: celda donde un tipo de evento puede ocurrir")
class ZoneRuleTest {

    private static final ZoneRule TRY = new ZoneRule(List.of(6), null, "zone");
    private static final ZoneRule TRY_PENALTY = new ZoneRule(List.of(6), List.of(2), null);
    private static final ZoneRule FIXED_COLUMN = new ZoneRule(List.of(5), null, null);
    private static final ZoneRule FIELD_PLAY = new ZoneRule(List.of(2, 3, 4, 5), null, null);
    private static final ZoneRule FIELD_PLAY_WITH_SIDE = new ZoneRule(List.of(2, 3, 4, 5), null, "zone");
    private static final ZoneRule NO_RESTRICTION = new ZoneRule(null, null, null);

    private static Optional<ZoneCell> cell(int row, int col) {
        return Optional.of(new ZoneCell(row, col));
    }

    @Nested
    @DisplayName("place: la columna fija sale de la regla")
    class FixedColumn {

        @ParameterizedTest(name = "lado {0} -> fila {1}")
        @MethodSource("com.ovaltrack.backend.zone.domain.ZoneRuleTest#sides")
        @DisplayName("La fila sale del atributo aunque el tramo diga otra cosa")
        void shouldTakeRowFromAttribute(String side, int row) {
            assertEquals(cell(row, 6), TRY.place(Map.of("zone", side), cell(2, 3)));
        }

        @Test
        @DisplayName("Sin tramo, la fila del atributo alcanza para fijar la celda")
        void shouldPlaceWithoutAssignment() {
            assertEquals(cell(3, 6), TRY.place(Map.of("zone", "right"), Optional.empty()));
        }

        @Test
        @DisplayName("Sin el atributo toma la fila del tramo")
        void shouldFallBackToAssignmentRow() {
            assertEquals(cell(1, 6), TRY.place(Map.of(), cell(1, 2)));
        }

        @Test
        @DisplayName("Sin el atributo y sin tramo no hay celda")
        void shouldReturnEmptyWithoutRowSource() {
            assertTrue(TRY.place(Map.of(), Optional.empty()).isEmpty());
        }

        @Test
        @DisplayName("Un valor de atributo desconocido se ignora y se usa el tramo")
        void shouldIgnoreUnknownAttributeValue() {
            assertEquals(cell(2, 6), TRY.place(Map.of("zone", "up"), cell(2, 4)));
        }

        @Test
        @DisplayName("Fila y columna fijas: ni el tramo ni los atributos las cambian")
        void shouldIgnoreAssignmentWhenBothAxesAreFixed() {
            assertEquals(cell(2, 6), TRY_PENALTY.place(null, cell(1, 1)));
            assertEquals(cell(2, 6), TRY_PENALTY.place(Map.of(), Optional.empty()));
        }

        @Test
        @DisplayName("La fila del tramo se conserva cuando solo la columna es fija")
        void shouldKeepAssignmentRow() {
            assertEquals(cell(3, 5), FIXED_COLUMN.place(Map.of(), cell(3, 2)));
        }

        @Test
        @DisplayName("Con la columna fija pero sin fila no hay celda")
        void shouldReturnEmptyWhenRowIsUnknown() {
            assertTrue(FIXED_COLUMN.place(Map.of(), Optional.empty()).isEmpty());
        }

        @Test
        @DisplayName("Una fila del atributo fuera de las filas permitidas no deja celda")
        void shouldRejectRowOutsideAllowedRows() {
            ZoneRule onlyCenter = new ZoneRule(List.of(6), List.of(2), "zone");

            assertTrue(onlyCenter.place(Map.of("zone", "right"), Optional.empty()).isEmpty());
        }
    }

    @Nested
    @DisplayName("place: la columna sale del tramo")
    class AssignmentColumn {

        @ParameterizedTest(name = "tramo en columna {0}")
        @MethodSource("com.ovaltrack.backend.zone.domain.ZoneRuleTest#fieldColumns")
        @DisplayName("Dentro de las columnas permitidas se conserva la celda del tramo")
        void shouldKeepAssignmentCellInsideAllowedColumns(int col) {
            assertEquals(cell(2, col), FIELD_PLAY.place(Map.of(), cell(2, col)));
        }

        @ParameterizedTest(name = "tramo en columna {0}")
        @MethodSource("com.ovaltrack.backend.zone.domain.ZoneRuleTest#ingoalColumns")
        @DisplayName("En el in-goal no hay celda: el tramo la deja prohibida")
        void shouldReturnEmptyOutsideAllowedColumns(int col) {
            assertTrue(FIELD_PLAY.place(Map.of(), cell(2, col)).isEmpty());
        }

        @Test
        @DisplayName("Sin tramo no hay celda")
        void shouldReturnEmptyWithoutAssignment() {
            assertTrue(FIELD_PLAY.place(Map.of(), Optional.empty()).isEmpty());
        }

        @Test
        @DisplayName("La fila sale del atributo y la columna del tramo")
        void shouldCombineAttributeRowWithAssignmentColumn() {
            assertEquals(cell(1, 5), FIELD_PLAY_WITH_SIDE.place(Map.of("zone", "left"), cell(2, 5)));
        }

        @Test
        @DisplayName("La fila del atributo no alcanza si la columna del tramo está prohibida")
        void shouldStillRejectProhibitedColumn() {
            assertTrue(FIELD_PLAY_WITH_SIDE.place(Map.of("zone", "left"), cell(2, 6)).isEmpty());
        }

        @Test
        @DisplayName("Sin restricción devuelve la celda del tramo tal cual")
        void shouldPassAssignmentThroughWithoutRestriction() {
            assertEquals(cell(3, 6), NO_RESTRICTION.place(Map.of(), cell(3, 6)));
            assertTrue(NO_RESTRICTION.place(Map.of(), Optional.empty()).isEmpty());
        }
    }

    @Nested
    @DisplayName("isFixed: la celda no depende de ningún tramo")
    class Fixed {

        @Test
        @DisplayName("Columna fija y fila por atributo presente: es fija")
        void shouldBeFixedWhenRowComesFromPresentAttribute() {
            assertTrue(TRY.isFixed(Map.of("zone", "left")));
        }

        @Test
        @DisplayName("Columna fija pero fila ausente: depende del tramo")
        void shouldNotBeFixedWithoutRowSource() {
            assertFalse(TRY.isFixed(Map.of()));
            assertFalse(TRY.isFixed(null));
        }

        @Test
        @DisplayName("Fila y columna únicas: es fija")
        void shouldBeFixedWithSingleRowAndColumn() {
            assertTrue(TRY_PENALTY.isFixed(Map.of()));
        }

        @Test
        @DisplayName("Solo la columna fija o ninguna restricción: no es fija")
        void shouldNotBeFixedWithoutRow() {
            assertFalse(FIXED_COLUMN.isFixed(Map.of()));
            assertFalse(FIELD_PLAY.isFixed(Map.of()));
            assertFalse(NO_RESTRICTION.isFixed(Map.of()));
        }
    }

    @Nested
    @DisplayName("cutsTramo: el evento cierra el tramo que lo contiene")
    class CutsTramo {

        @Test
        @DisplayName("Con closesTramo verdadero corta el tramo")
        void shouldCutWhenDeclared() {
            assertTrue(new ZoneRule(List.of(6), null, "zone", true).cutsTramo());
        }

        @Test
        @DisplayName("Con closesTramo falso o ausente no corta")
        void shouldNotCutOtherwise() {
            assertFalse(new ZoneRule(List.of(2, 3, 4, 5), null, null, false).cutsTramo());
            assertFalse(FIELD_PLAY.cutsTramo());
        }
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("com.ovaltrack.backend.zone.domain.ZoneRuleTest#descriptions")
    @DisplayName("describeAllowed: texto de lo permitido para el mensaje de error")
    void shouldDescribeWhatIsAllowed(ZoneRule rule, String expected) {
        assertEquals(expected, rule.describeAllowed());
    }

    static Stream<Arguments> sides() {
        return Stream.of(Arguments.of("left", 1), Arguments.of("center", 2), Arguments.of("right", 3));
    }

    static Stream<Integer> fieldColumns() {
        return Stream.of(2, 3, 4, 5);
    }

    static Stream<Integer> ingoalColumns() {
        return Stream.of(1, 6);
    }

    static Stream<Arguments> descriptions() {
        return Stream.of(
                Arguments.of(new ZoneRule(List.of(2, 3, 4, 5), null, null), "las columnas 2 a 5"),
                Arguments.of(new ZoneRule(List.of(6), null, "zone"), "la columna 6"),
                Arguments.of(new ZoneRule(List.of(5), null, null), "la columna 5"),
                Arguments.of(new ZoneRule(List.of(1, 6), null, null), "las columnas 1 y 6"),
                Arguments.of(new ZoneRule(List.of(6), List.of(2), null), "la columna 6 y la fila C"),
                Arguments.of(new ZoneRule(null, List.of(1, 3), null), "las filas I y D"));
    }
}
