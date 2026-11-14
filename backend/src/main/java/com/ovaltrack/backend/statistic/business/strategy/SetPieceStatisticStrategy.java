package com.ovaltrack.backend.statistic.business.strategy;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.domain.PossessionAfter;
import com.ovaltrack.backend.event.domain.TemplateField;
import com.ovaltrack.backend.statistic.business.advanced.PlayRules;
import com.ovaltrack.backend.statistic.domain.dto.PeriodStatisticDTO;

/**
 * Estrategia encargada de calcular formaciones fijas (Scrums y Line-outs): cuántas hubo y,
 * sobre el saque propio, cuántas se ganaron y cuántas se perdieron.
 *
 * <p>Una formación fija es "ganada" cuando la posesión queda en el equipo que la ejecutó y
 * "perdida" cuando pasa al rival. Se decide con la misma regla que usa la carga en vivo: la
 * posesión de la opción de resultado elegida en el evento y, si el tipo no tiene campo de
 * resultado, la posesión por defecto del tipo. Si el tipo tiene resultado pero el evento aún
 * no lo cargó, la formación cuenta en el total pero no como ganada ni perdida.
 */
@Component
public class SetPieceStatisticStrategy implements PeriodStatisticStrategy {

    private static final String SCRUM = "SCRUM";
    private static final String LINEOUT = "LINEOUT";

    @Override
    public void calculate(Collection<Event> periodEvents, PeriodStatisticDTO.Builder builder) {
        int scrumsTotal = 0;
        int lineoutsTotal = 0;
        int ownScrumsWon = 0;
        int ownScrumsLost = 0;
        int ownLineoutsWon = 0;
        int ownLineoutsLost = 0;

        for (Event event : periodEvents) {
            String code = PlayRules.code(event);
            boolean isScrum = SCRUM.equals(code);
            boolean isLineout = LINEOUT.equals(code);
            if (!isScrum && !isLineout) {
                continue;
            }

            if (isScrum) {
                scrumsTotal++;
            } else {
                lineoutsTotal++;
            }

            if (event.getTeamPossession() != EventPossession.OWN) {
                continue;
            }
            Boolean retained = retainedByActor(event);
            if (retained == null) {
                continue;
            }
            if (isScrum) {
                if (retained) ownScrumsWon++; else ownScrumsLost++;
            } else {
                if (retained) ownLineoutsWon++; else ownLineoutsLost++;
            }
        }

        builder.scrumsTotal(scrumsTotal)
               .lineoutsTotal(lineoutsTotal)
               .ownScrumsWon(ownScrumsWon)
               .ownScrumsLost(ownScrumsLost)
               .ownLineoutsWon(ownLineoutsWon)
               .ownLineoutsLost(ownLineoutsLost);
    }

    /**
     * @return TRUE si la posesión queda en quien ejecutó la formación, FALSE si pasa al rival,
     *         null si el resultado todavía no está cargado.
     */
    private Boolean retainedByActor(Event event) {
        EventType type = event.getEventType();
        if (type == null) {
            return null;
        }

        boolean hasOutcomeField = false;
        List<TemplateField> fields = type.getTemplateEventFields();
        Map<String, Object> attributes = event.getAttributes();
        if (fields != null) {
            for (TemplateField field : fields) {
                if (!"select".equals(field.type()) || field.options() == null) {
                    continue;
                }
                boolean fieldHasPossession = field.options().stream().anyMatch(o -> o.possession() != null);
                if (!fieldHasPossession) {
                    continue;
                }
                hasOutcomeField = true;

                Object chosen = attributes != null ? attributes.get(field.key()) : null;
                for (TemplateField.Option option : field.options()) {
                    if (chosen != null && option.possession() != null && option.value().equals(String.valueOf(chosen))) {
                        return !PossessionAfter.OTHER.name().equals(option.possession());
                    }
                }
            }
        }

        if (hasOutcomeField) {
            return null;
        }
        return type.getPossessionAfter() != PossessionAfter.OTHER;
    }
}
