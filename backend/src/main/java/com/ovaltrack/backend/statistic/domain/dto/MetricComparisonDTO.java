package com.ovaltrack.backend.statistic.domain.dto;

/**
 * Una métrica del jugador comparada con el promedio del plantel de su división.
 * Los valores son null cuando no hay datos (por ejemplo, un porcentaje sin intentos).
 */
public record MetricComparisonDTO(
    String key,
    Double playerValue,
    Double squadValue,
    MetricFormat format,
    /** false en métricas donde estar por debajo del promedio es lo deseable (penales, errores). */
    boolean higherIsBetter,
    ComparisonVerdict verdict
) {
    public enum MetricFormat { PER_MATCH, PERCENT }

    public enum ComparisonVerdict { ABOVE, EQUAL, BELOW, NO_DATA }
}
