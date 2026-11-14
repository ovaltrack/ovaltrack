package com.ovaltrack.backend.statistic.business.advanced;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.ovaltrack.backend.event.business.EventRules;
import com.ovaltrack.backend.event.domain.Actor;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.domain.PossessionAfter;
import com.ovaltrack.backend.event.domain.TemplateField;

/**
 * Reglas de quién tiene la pelota y a quién se le acreditan los puntos, las mismas que usa la carga en vivo
 * ({@code event-rules.ts} y {@code derivePossession}). {@code teamPossession} guarda el equipo que ejecutó el evento.
 */
final class PlayRules {

    private PlayRules() {
    }

    static EventPossession opposite(EventPossession team) {
        return team == EventPossession.OWN ? EventPossession.OPPONENT : EventPossession.OWN;
    }

    /** Equipo que ejecutó el evento; null si es neutral. */
    static EventPossession actor(Event event) {
        EventPossession team = event.getTeamPossession();
        return team == EventPossession.OWN || team == EventPossession.OPPONENT ? team : null;
    }

    /** Quién tenía la pelota cuando ocurrió el evento; null si el tipo no lo informa (actor CHOOSE). */
    static EventPossession holderBefore(Event event) {
        EventPossession actor = actor(event);
        if (actor == null || event.getEventType() == null) {
            return null;
        }
        return switch (actorOf(event.getEventType())) {
            case ATTACKING -> actor;
            case DEFENDING -> opposite(actor);
            case CHOOSE -> null;
        };
    }

    /** Quién tiene la pelota después del evento; null si el evento no la cambia ni informa quién la tiene. */
    static EventPossession holderAfter(Event event) {
        EventPossession actor = actor(event);
        EventType type = event.getEventType();
        if (actor == null || type == null) {
            return null;
        }
        return switch (possessionRule(type, event.getAttributes())) {
            case ACTOR -> actor;
            case OTHER -> opposite(actor);
            case KEEP -> holderBefore(event);
        };
    }

    /**
     * Regla de posesión de un evento ya cargado: la de la opción elegida, la de un campo boolean con efecto
     * {@code possession} (si es false no cambia), o la del tipo.
     */
    static PossessionAfter possessionRule(EventType type, Map<String, Object> attributes) {
        List<TemplateField> fields = type.getTemplateEventFields() == null ? List.of() : type.getTemplateEventFields();
        for (TemplateField field : fields) {
            Object value = attributes == null ? null : attributes.get(field.key());
            if ("select".equals(field.type()) && field.options() != null && value != null) {
                for (TemplateField.Option option : field.options()) {
                    if (option.possession() != null && Objects.equals(option.value(), String.valueOf(value))) {
                        return PossessionAfter.valueOf(option.possession());
                    }
                }
            }
            if ("boolean".equals(field.type()) && field.effects() != null && field.effects().contains("possession")
                    && Boolean.FALSE.equals(value)) {
                return PossessionAfter.KEEP;
            }
        }
        return type.getPossessionAfter() == null ? PossessionAfter.KEEP : type.getPossessionAfter();
    }

    /** Puntos que suma el evento (0 si no suma o el intento falló). */
    static int points(Event event) {
        EventType type = event.getEventType();
        if (type == null || type.getPoints() == null || !EventRules.countsAsScoring(type, event.getAttributes())) {
            return 0;
        }
        return type.getPoints();
    }

    /** Equipo al que se le suman los puntos: la misma regla que el marcador (un NEUTRAL con jugador es propio). */
    static EventPossession scoringTeam(Event event) {
        if (event.getTeamPossession() == EventPossession.OPPONENT) {
            return EventPossession.OPPONENT;
        }
        if (event.getTeamPossession() == EventPossession.OWN || event.getPlayer() != null) {
            return EventPossession.OWN;
        }
        return null;
    }

    static String code(Event event) {
        return event.getEventType() == null || event.getEventType().getCode() == null ? "" : event.getEventType().getCode();
    }

    /** Valor del campo select del evento, o null. */
    static String option(Event event, String key) {
        Object value = event.getAttributes() == null ? null : event.getAttributes().get(key);
        return value == null ? null : String.valueOf(value);
    }

    private static Actor actorOf(EventType type) {
        return type.getActor() == null ? Actor.ATTACKING : type.getActor();
    }
}
