package com.ovaltrack.backend.event.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.domain.EventPossession;

public interface EventRepository extends JpaRepository<Event, UUID> {

    @Query("SELECT e FROM Event e WHERE e.active = true AND e.match.division.club.id = :clubId")
    Collection<Event> findEventsByClubId(@Param("clubId") UUID clubId);

    @Query("SELECT e FROM Event e WHERE e.active = true AND e.match.division.id = :divisionId")
    Collection<Event> findEventsByDivisionId(@Param("divisionId") UUID divisionId);

    @Query("SELECT e FROM Event e WHERE e.active = true AND e.match.id = :matchId ORDER BY e.period, e.matchTime, e.realTime")
    Collection<Event> findEventsByMatchId(@Param("matchId") UUID matchId);

    /** Eventos activos de varios partidos en una sola consulta (evita una consulta por partido). */
    @Query("SELECT e FROM Event e JOIN FETCH e.eventType JOIN FETCH e.match WHERE e.active = true AND e.match.id IN :matchIds ORDER BY e.period, e.matchTime, e.realTime")
    Collection<Event> findEventsByMatchIds(@Param("matchIds") Collection<UUID> matchIds);

    @Query("SELECT e FROM Event e JOIN FETCH e.eventType LEFT JOIN FETCH e.player WHERE e.active = true AND e.match.id = :matchId ORDER BY e.period, e.matchTime, e.realTime")
    Collection<Event> findPostMatchEventsByMatchId(@Param("matchId") UUID matchId);

    /**
     * Cobertura de análisis por partido sin traer los eventos: jugadas activas de tipos activos y cuántas no tienen
     * jugador (las del rival nunca llevan jugador del plantel, así que no cuentan como pendientes).
     * Los partidos sin jugadas no aparecen en el resultado.
     */
    @Query("""
            SELECT e.match.id AS matchId,
                   COUNT(e) AS totalEvents,
                   SUM(CASE WHEN e.player IS NULL AND (e.teamPossession IS NULL OR e.teamPossession <> :opponent)
                            THEN 1 ELSE 0 END) AS withoutPlayer
            FROM Event e
            WHERE e.active = true AND e.eventType.isActive = true AND e.match.id IN :matchIds
            GROUP BY e.match.id
            """)
    List<MatchCoverageCount> countCoverageByMatchIds(@Param("matchIds") Collection<UUID> matchIds,
            @Param("opponent") EventPossession opponent);

    @Query("SELECT e FROM Event e WHERE e.active = true AND e.id = :eventId AND e.match.id = :matchId")
    Event findEventByIdAndMatchId(@Param("eventId") UUID eventId, @Param("matchId") UUID matchId);

    @Query("SELECT e FROM Event e WHERE e.active = true AND e.id = :eventId")
    Event findActiveEventById(@Param("eventId") UUID eventId);

    Event findByClientEventId(UUID clientEventId);

}
