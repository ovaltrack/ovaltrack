package com.ovaltrack.backend.event.domain.dto;

import java.util.List;
import java.util.UUID;

import com.ovaltrack.backend.event.domain.Actor;
import com.ovaltrack.backend.event.domain.EventCategory;
import com.ovaltrack.backend.event.domain.FollowUpChoice;
import com.ovaltrack.backend.event.domain.PossessionAfter;
import com.ovaltrack.backend.event.domain.TemplateField;
import com.ovaltrack.backend.zone.domain.ZoneRule;

public record EventTypeResponseDTO(
    UUID id,

    String name,

    String groupName,

    EventCategory category,

    boolean isScoring,

    Integer points,

    boolean requiresPlayer,

    boolean isActive,

    String code,

    boolean showInPalette,

    UUID followUpEventTypeId,

    List<String> statView,

    Actor actor,

    PossessionAfter possessionAfter,

    List<FollowUpChoice> followUpChoices,

    List<TemplateField> templateEventFields,

    ZoneRule zoneRule
) {
}
