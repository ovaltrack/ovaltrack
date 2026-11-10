package com.ovaltrack.backend.event.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ovaltrack.backend.zone.domain.ZoneRule;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "event_types")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class EventType {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Column(nullable = false)
    private String name;

    private String groupName;

    @Enumerated(EnumType.STRING)
    private EventCategory category;

    private Boolean isScoring;

    private Integer points;

    private Boolean requiresPlayer;

    @Builder.Default
    private Boolean isActive = true;

    private String code;

    private Boolean showInPalette;
    
    private UUID followUpEventTypeId; // UUID plano, sin @ManyToOne

    /** Indica sobre que vistas puede aparecer la estadistica del evento
     * <p>Valores:
     * <p>'basic' indica que su estadistica puede aparecer en el modal de estadisticas
     * <p>'intermediate' indica que su estadistica puede aparecer en la pantalla de entretiempo
     * <p>Todos los eventos aparecen en la pantalla post-partido
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> statView;

    /** Qué equipo ejecuta el evento (relativo a quién tiene la pelota). */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Actor actor = Actor.ATTACKING;

    /** Posesión resultante, relativa al equipo que ejecuta el evento. */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PossessionAfter possessionAfter = PossessionAfter.KEEP;

    /** Eventos entre los que el analista elige al guardar este tipo (cómo se juega un penal, etc.). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<FollowUpChoice> followUpChoices;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<TemplateField> templateEventFields; // antes: Map<String,Object>

    /** Zonas de la cancha donde este tipo de evento puede ocurrir; null = sin restricción. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private ZoneRule zoneRule;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
