package com.ovaltrack.backend.statistic.domain.dto;

/** Cantidad de eventos del jugador de un tipo; `made` (aciertos) solo en los tipos con resultado, como los pateos a palos. */
public record PlayerActionCountDTO(
    String code,
    String name,
    String groupName,
    int count,
    Integer made
) {
}
