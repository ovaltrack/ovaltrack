package com.ovaltrack.backend.division.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ovaltrack.backend.division.domain.DivisionPlayer;

public interface DivisionPlayerRepository extends JpaRepository<DivisionPlayer, UUID> {

	@Query("""
                SELECT dp 
                FROM DivisionPlayer dp 
                WHERE dp.division.id = :divisionId 
                AND dp.endDate IS NULL 
                ORDER BY person.id, startDate
            """)
	Page<DivisionPlayer> findPaginatedActiveDivisionPlayersByDivision(@Param("divisionId") UUID divisionId, Pageable pageable);

	@Query("""
                SELECT dp 
                FROM DivisionPlayer dp 
                WHERE dp.division.id = :divisionId 
                AND dp.person.id = :personId
                ORDER BY startDate DESC
            """)
	Collection<DivisionPlayer> findDivisionPlayersByDivisionIdAndPersonId(@Param("divisionId") UUID divisionId, @Param ("personId") UUID personId);

	@Query("SELECT COUNT(dp) > 0 FROM DivisionPlayer dp " + "WHERE dp.division.id = :divisionId AND dp.person.id = :personId " + "AND dp.endDate IS NULL")
	boolean existsActiveAssociation(@Param("divisionId") UUID divisionId, @Param("personId") UUID personId);
	
	List<DivisionPlayer> findByDivisionId(UUID divisionId);

    @Query("""
            SELECT dp, p, u
            FROM DivisionPlayer dp
            JOIN dp.person p
            LEFT JOIN User u ON u.person.id = p.id
            WHERE dp.division.id = :divisionId
            ORDER BY p.lastName, p.firstName
        """)
    List<Object[]> findDivisionPlayersWithPersonAndUser(@Param("divisionId") UUID divisionId);

    /** Jugadores activos de todas las divisiones del club, con persona y división (una sola consulta). */
    @Query("""
            SELECT dp
            FROM DivisionPlayer dp
            JOIN FETCH dp.person p
            JOIN FETCH dp.division d
            WHERE d.club.id = :clubId
            AND dp.endDate IS NULL
            ORDER BY p.lastName, p.firstName, dp.startDate DESC
        """)
    List<DivisionPlayer> findActiveByClubId(@Param("clubId") UUID clubId);

    @Query("SELECT dp FROM DivisionPlayer dp JOIN FETCH dp.division d WHERE dp.person.id = :personId AND dp.endDate IS NULL")
    Collection<DivisionPlayer> findActiveByPersonId(@Param("personId") UUID personId);

}