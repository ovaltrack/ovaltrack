package com.ovaltrack.backend.zone.business;

import com.ovaltrack.backend.event.business.EventRules;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.zone.domain.ZoneQuery;
import com.ovaltrack.backend.zone.domain.ZoneRule;

/**
 * Regla única de qué eventos cortan un tramo y dónde: después de un tanteo el juego se reinicia con un saque, así que
 * el tramo que lo contiene termina en el minuto siguiente al suyo. Lo comparten el validador (409 al crear o editar un
 * tramo) y el recorte automático (al guardar el tanteo).
 */
public final class TramoCuts {

    private TramoCuts() {
    }

    /** El evento cierra el tramo: su tipo lo declara en la regla de zona y el tanteo cuenta (un Kick H errado no corta). */
    public static boolean closes(Event event) {
        ZoneRule rule = ZoneQuery.of(event).rule();
        return rule != null && rule.cutsTramo() && EventRules.countsAsScoring(event.getEventType(), event.getAttributes());
    }

    /** Minuto en que termina el tramo que contiene al evento (el tiempo añadido cuenta como el último segundo del tiempo). */
    public static int endMinute(Event event) {
        return ZoneGrid.effectiveSeconds(event.getPeriod(), event.getMatchTime()) / ZoneGrid.SECONDS_PER_MINUTE + 1;
    }
}
