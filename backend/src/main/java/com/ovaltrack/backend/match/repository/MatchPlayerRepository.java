package com.ovaltrack.backend.match.repository;

import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.match.domain.MatchPlayer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.UUID;

@Repository
public interface MatchPlayerRepository extends JpaRepository<MatchPlayer, UUID> {
    void deleteByMatch(Match match);

    @Query("""
                SELECT mp FROM MatchPlayer mp
                JOIN FETCH mp.match m
                JOIN FETCH m.opponent
                JOIN FETCH m.division
                WHERE mp.divisionPlayer.person.id = :personId
                AND m.status = MatchStatus.FINISHED
                ORDER BY m.date DESC
            """)
    Collection<MatchPlayer> findPlayedByPersonId(@Param("personId") UUID personId);

    /** Planteles de uno o varios partidos, con la persona de cada jugador, ordenados por slotOrder. */
    @Query("""
                SELECT mp FROM MatchPlayer mp
                JOIN FETCH mp.divisionPlayer dp
                JOIN FETCH dp.person
                WHERE mp.match.id IN :matchIds
                ORDER BY mp.slotOrder
            """)
    Collection<MatchPlayer> findRosterByMatchIds(@Param("matchIds") Collection<UUID> matchIds);

    /** Si la persona está en la nómina del partido (titular o suplente), en una sola consulta. */
    @Query("""
                SELECT CASE WHEN COUNT(mp) > 0 THEN true ELSE false END FROM MatchPlayer mp
                WHERE mp.match.id = :matchId
                AND mp.divisionPlayer.person.id = :personId
            """)
    boolean existsInRoster(@Param("matchId") UUID matchId, @Param("personId") UUID personId);

}