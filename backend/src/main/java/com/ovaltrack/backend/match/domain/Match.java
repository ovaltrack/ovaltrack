package com.ovaltrack.backend.match.domain;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.event.domain.EventPossession;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.DynamicUpdate;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "matches", indexes = {@Index(name = "idx_matches_division", columnList = "division_id")})
@DynamicUpdate
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class Match {

    public static final int HALF_DURATION_SECONDS = 40 * 60;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    private LocalDateTime date;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "division_id", nullable = false)
    private Division division;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opponent_id", nullable = false)
    private Opponent opponent;

    @Enumerated(EnumType.STRING)
    private MatchStatus status;

    @Column(name = "current_period", nullable = false)
    @Builder.Default
    private Integer currentPeriod = 1;

    @Column(name = "clock_elapsed_seconds", nullable = false)
    @Builder.Default
    private Integer clockElapsedSeconds = 0;

    @Column(name = "clock_paused", nullable = false)
    @Builder.Default
    private Boolean clockPaused = true;

    @Column(name = "clock_updated_at")
    private LocalDateTime clockUpdatedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "current_possession", nullable = false)
    @Builder.Default
    private EventPossession currentPossession = EventPossession.OWN;

    @Column(name = "home_score", nullable = false)
    @Builder.Default
    private Integer homeScore = 0;

    @Column(name = "away_score", nullable = false)
    @Builder.Default
    private Integer awayScore = 0;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;


    @OneToMany(mappedBy = "match", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("slotOrder ASC")
    @Builder.Default
    private List<MatchPlayer> roster = new ArrayList<>();

    public boolean isTerminal() {
        return this.status == MatchStatus.FINISHED || this.status == MatchStatus.CANCELLED;
    }

    public void ensureNotTerminal() {
        if (isTerminal()) {
            throw new BusinessException("El partido ya fue finalizado o cancelado");
        }
    }

    public void closeFirstHalf() {
        ensureNotTerminal();
        if (this.status == MatchStatus.HALFTIME || (this.currentPeriod != null && this.currentPeriod == 2)) {
            throw new BusinessException("El primer tiempo ya ha sido cerrado");
        }

        this.status = MatchStatus.HALFTIME;
        this.currentPeriod = 1;
        moveClockToSecondHalf(true);
    }

    public void startSecondHalf() {
        ensureNotTerminal();

        this.status = MatchStatus.IN_PROGRESS;
        this.currentPeriod = 2;
        moveClockToSecondHalf(false);
    }

    private void moveClockToSecondHalf(boolean paused) {
        int elapsed = this.clockElapsedSeconds == null ? 0 : this.clockElapsedSeconds;
        this.clockElapsedSeconds = Math.max(HALF_DURATION_SECONDS, elapsed);
        this.clockPaused = paused;
        this.clockUpdatedAt = LocalDateTime.now();
    }
}
