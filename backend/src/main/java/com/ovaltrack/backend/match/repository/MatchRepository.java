package com.ovaltrack.backend.match.repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ovaltrack.backend.match.domain.Match;

public interface MatchRepository extends JpaRepository<Match, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Match m WHERE m.id = :id")
    java.util.Optional<Match> findByIdForUpdate(@Param("id") UUID id);

    @Query("SELECT m FROM Match m JOIN FETCH m.opponent WHERE m.division.club.id = :clubId")
    Collection<Match> findAllMatchesByClubId(@Param("clubId") UUID clubId);

    @Query("SELECT m FROM Match m JOIN FETCH m.opponent WHERE m.division.id = :divisionId ORDER BY m.status DESC, m.date")
    Collection<Match> findAllMatchesByDivisionId(@Param("divisionId") UUID divisionId);

    @Query("""
        SELECT m
        FROM Match m
        WHERE m.division.id = :divisionId
        AND m.date > :overlapStart
        AND m.date < :newEnd
        AND m.status != MatchStatus.CANCELLED
    """)
    Match findByDivisionIdAndTimeFrame(
        @Param("divisionId") UUID divisionId,
        @Param("overlapStart") LocalDateTime overlapStart,
        @Param("newEnd") LocalDateTime newEnd
    );

    @Query("""
        SELECT m
        FROM Match m
        WHERE m.division.id = :divisionId
        AND m.id <> :matchId
        AND m.status IN (MatchStatus.IN_PROGRESS, MatchStatus.HALFTIME)
        ORDER BY m.date
    """)
    List<Match> findOtherLiveMatchesInDivision(
        @Param("divisionId") UUID divisionId,
        @Param("matchId") UUID matchId
    );

    @Query("""
        SELECT m
        FROM Match m
        JOIN FETCH m.opponent
        WHERE m.division.id = :divisionId
        AND m.status = MatchStatus.FINISHED
        AND m.date >= :from
        AND m.date < :toExclusive
        ORDER BY m.date ASC
    """)
    Collection<Match> findFinishedByDivisionIdAndDateRange(
        @Param("divisionId") UUID divisionId,
        @Param("from") LocalDateTime from,
        @Param("toExclusive") LocalDateTime toExclusive
    );
}
