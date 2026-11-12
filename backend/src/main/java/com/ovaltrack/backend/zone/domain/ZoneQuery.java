package com.ovaltrack.backend.zone.domain;

import java.util.Map;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;

/** Todo lo que el resolver necesita para ubicar un evento: su regla, quién lo ejecuta, sus atributos y su minuto. */
public record ZoneQuery(ZoneRule rule, EventPossession possession, Map<String, Object> attributes,
                        Integer period, Integer matchTime) {

    public static ZoneQuery of(Event event) {
        ZoneRule rule = event.getEventType() == null ? null : event.getEventType().getZoneRule();
        return new ZoneQuery(rule, event.getTeamPossession(), event.getAttributes(), event.getPeriod(), event.getMatchTime());
    }
}
