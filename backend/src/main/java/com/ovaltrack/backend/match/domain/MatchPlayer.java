package com.ovaltrack.backend.match.domain;

import com.ovaltrack.backend.division.domain.DivisionPlayer;
import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(
        name = "matches_players",
        indexes = {
                @Index(name = "idx_matches_players_match", columnList = "match_id"),
                @Index(name = "idx_matches_players_division_player", columnList = "division_id")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_match_player_number", columnNames = {"match_id", "number"})
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class MatchPlayer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "match_id", nullable = false)
    private Match match;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "division_id", nullable = false)
    private DivisionPlayer divisionPlayer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MatchPlayerRole role;

    /** Posición dentro de su rol (titulares 0-14, suplentes 0-7). Null en planteles anteriores a esta columna. */
    @Column(name = "slot_order")
    private Integer slotOrder;

    /** Número permanente del jugador dentro de este partido. */
    @Column(name = "number")
    private Integer number;

    /** Ubicación actual, recalculada a partir del replay de sustituciones. */
    @Enumerated(EnumType.STRING)
    @Column(name = "field_status")
    private MatchPlayerStatus fieldStatus;

    /** Posición actual en la grilla de cancha; es null cuando el jugador está en banco. */
    @Column(name = "field_slot")
    private Integer fieldSlot;
}
