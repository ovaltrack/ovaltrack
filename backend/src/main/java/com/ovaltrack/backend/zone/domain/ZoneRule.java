package com.ovaltrack.backend.zone.domain;

import java.util.List;
import java.util.Map;
import java.util.Optional;

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

    /** Celda final del evento (vista del equipo que lo ejecuta); vacío si falta un eje o la celda no está permitida. */
    public Optional<ZoneCell> place(Map<String, Object> attributes, Optional<ZoneCell> tramoCell) {
        throw new UnsupportedOperationException("Sin implementar");
    }

    /** Verdadero si la regla determina fila y columna sin necesitar ningún tramo. */
    public boolean isFixed(Map<String, Object> attributes) {
        throw new UnsupportedOperationException("Sin implementar");
    }

    /** Texto de lo permitido para los mensajes de error (ej.: "las columnas 2 a 5"). */
    public String describeAllowed() {
        throw new UnsupportedOperationException("Sin implementar");
    }
}
