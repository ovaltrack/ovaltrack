package com.ovaltrack.backend.zone.domain;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.IntFunction;
import java.util.stream.Stream;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Regla de zona de un tipo de evento, declarada en el catálogo. Todo está visto desde el equipo que ejecuta el evento.
 * <ul>
 *   <li>{@code columns} / {@code rows}: celdas permitidas (null o vacío = sin restricción en ese eje).</li>
 *   <li>{@code rowFrom}: clave del atributo (left | center | right) de la que sale la fila.</li>
 * </ul>
 * Un eje con un único valor permitido queda fijo; si no, sale del tramo que contiene el minuto del evento.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ZoneRule(List<Integer> columns, List<Integer> rows, String rowFrom) {

    private static final Map<String, Integer> ROW_BY_SIDE = Map.of("left", 1, "center", 2, "right", 3);

    /** Celda final del evento (vista del equipo que lo ejecuta); vacío si falta un eje o la celda no está permitida. */
    public Optional<ZoneCell> place(Map<String, Object> attributes, Optional<ZoneCell> tramoCell) {
        Optional<Integer> row = rowFromAttribute(attributes)
                .or(() -> onlyValue(rows))
                .or(() -> tramoCell.map(ZoneCell::row));
        Optional<Integer> col = onlyValue(columns)
                .or(() -> tramoCell.map(ZoneCell::col));

        return row.flatMap(r -> col.map(c -> new ZoneCell(r, c))).filter(this::allows);
    }

    /** Verdadero si la regla determina fila y columna sin necesitar ningún tramo. */
    public boolean isFixed(Map<String, Object> attributes) {
        return onlyValue(columns).isPresent()
                && (rowFromAttribute(attributes).isPresent() || onlyValue(rows).isPresent());
    }

    /** Texto de lo permitido para los mensajes de error (ej.: "las columnas 2 a 5"). */
    public String describeAllowed() {
        return Stream.of(
                        describeAxis(columns, "columna", String::valueOf),
                        describeAxis(rows, "fila", ZoneCell::rowLetter))
                .flatMap(Optional::stream)
                .reduce((columnsText, rowsText) -> columnsText + " y " + rowsText)
                .orElse("cualquier celda");
    }

    private boolean allows(ZoneCell cell) {
        return allowsValue(columns, cell.col()) && allowsValue(rows, cell.row());
    }

    private static boolean allowsValue(List<Integer> allowed, int value) {
        return allowed == null || allowed.isEmpty() || allowed.contains(value);
    }

    private static Optional<Integer> onlyValue(List<Integer> values) {
        return Optional.ofNullable(values).filter(list -> list.size() == 1).map(list -> list.get(0));
    }

    private Optional<Integer> rowFromAttribute(Map<String, Object> attributes) {
        return Optional.ofNullable(rowFrom)
                .flatMap(key -> Optional.ofNullable(attributes).map(values -> values.get(key)))
                .map(ROW_BY_SIDE::get);
    }

    private static Optional<String> describeAxis(List<Integer> values, String noun, IntFunction<String> name) {
        if (values == null || values.isEmpty()) {
            return Optional.empty();
        }
        List<String> names = values.stream().sorted().map(name::apply).toList();
        if (names.size() == 1) {
            return Optional.of("la %s %s".formatted(noun, names.get(0)));
        }
        return Optional.of("las %ss %s".formatted(noun, isContiguousRange(values) && names.size() > 2
                ? names.get(0) + " a " + names.get(names.size() - 1)
                : String.join(", ", names.subList(0, names.size() - 1)) + " y " + names.get(names.size() - 1)));
    }

    private static boolean isContiguousRange(List<Integer> values) {
        List<Integer> sorted = values.stream().sorted().toList();
        return sorted.get(sorted.size() - 1) - sorted.get(0) == sorted.size() - 1;
    }
}
