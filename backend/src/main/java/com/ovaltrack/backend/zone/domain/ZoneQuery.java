package com.ovaltrack.backend.zone.domain;

import java.util.Map;

import com.ovaltrack.backend.event.domain.EventPossession;

/** Todo lo que el resolver necesita para ubicar un evento: su regla, quién lo ejecuta, sus atributos y su minuto. */
public record ZoneQuery(ZoneRule rule, EventPossession possession, Map<String, Object> attributes,
                        Integer period, Integer matchTime) {
}
