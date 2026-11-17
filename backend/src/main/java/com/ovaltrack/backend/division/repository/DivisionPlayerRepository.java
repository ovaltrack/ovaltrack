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
import com.ovaltrack.backend.division.domain.dto.DivisionHistoryPersonDTO;

public interface DivisionPlayerRepository extends JpaRepository<DivisionPlayer, UUID> {

	@Query("""
                SELECT dp 
                FROM DivisionPlayer dp 
                WHERE dp.division.id = :divisionId 
                AND dp.endDate IS NULL 
                ORDER BY person.id, startDate
            """)
	Page<DivisionPlayer> findPaginatedActiveDivisionPlayersByDivision(@Param("divisionId") UUID divisionId, Pageable pageable);

	@Query(value = """
		SELECT dp.* FROM division_players dp
		JOIN persons p ON p.id = dp.person_id
		WHERE dp.division_id = :divisionId AND dp.end_date IS NULL
		AND (
		  translate(lower(concat(p.first_name, ' ', p.last_name)), 'áéíóúüñ', 'aeiouun') LIKE translate(lower(concat('%', :search, '%')), 'áéíóúüñ', 'aeiouun')
		  OR translate(lower(concat(p.last_name, ' ', p.first_name)), 'áéíóúüñ', 'aeiouun') LIKE translate(lower(concat('%', :search, '%')), 'áéíóúüñ', 'aeiouun')
		  OR lower(coalesce(p.contact_email, '')) LIKE lower(concat('%', :search, '%'))
		  OR cast(dp.jersey_number AS text) LIKE concat('%', :search, '%')
		)
		ORDER BY p.last_name, p.first_name
		""",
		countQuery = """
		SELECT count(*) FROM division_players dp
		JOIN persons p ON p.id = dp.person_id
		WHERE dp.division_id = :divisionId AND dp.end_date IS NULL
		AND (
		  translate(lower(concat(p.first_name, ' ', p.last_name)), 'áéíóúüñ', 'aeiouun') LIKE translate(lower(concat('%', :search, '%')), 'áéíóúüñ', 'aeiouun')
		  OR translate(lower(concat(p.last_name, ' ', p.first_name)), 'áéíóúüñ', 'aeiouun') LIKE translate(lower(concat('%', :search, '%')), 'áéíóúüñ', 'aeiouun')
		  OR lower(coalesce(p.contact_email, '')) LIKE lower(concat('%', :search, '%'))
		  OR cast(dp.jersey_number AS text) LIKE concat('%', :search, '%')
		)
		""", nativeQuery = true)
	Page<DivisionPlayer> findPaginatedActiveDivisionPlayersByDivisionAndSearch(
			@Param("divisionId") UUID divisionId, @Param("search") String search, Pageable pageable);

	@Query("""
                SELECT dp 
                FROM DivisionPlayer dp 
                WHERE dp.division.id = :divisionId 
                AND dp.person.id = :personId
                ORDER BY startDate DESC
            """)
	Collection<DivisionPlayer> findDivisionPlayersByDivisionIdAndPersonId(@Param("divisionId") UUID divisionId, @Param ("personId") UUID personId);

	@Query("""
	    SELECT new com.ovaltrack.backend.division.domain.dto.DivisionHistoryPersonDTO(
	      p.id, p.firstName, p.lastName, p.contactEmail,
	      CASE WHEN SUM(CASE WHEN dp.endDate IS NULL THEN 1 ELSE 0 END) > 0 THEN true ELSE false END,
	      MIN(dp.startDate), MAX(dp.endDate))
	    FROM DivisionPlayer dp JOIN dp.person p
	    WHERE dp.division.id = :divisionId
	      AND (LOWER(CONCAT(p.firstName, ' ', p.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
	           OR LOWER(CONCAT(p.lastName, ' ', p.firstName)) LIKE LOWER(CONCAT('%', :search, '%'))
	           OR LOWER(COALESCE(p.contactEmail, '')) LIKE LOWER(CONCAT('%', :search, '%')))
	    GROUP BY p.id, p.firstName, p.lastName, p.contactEmail
	    ORDER BY p.lastName, p.firstName
	""")
	Page<DivisionHistoryPersonDTO> findHistoryPeople(@Param("divisionId") UUID divisionId, @Param("search") String search, Pageable pageable);

	@Query("SELECT COUNT(dp) > 0 FROM DivisionPlayer dp " + "WHERE dp.division.id = :divisionId AND dp.person.id = :personId " + "AND dp.endDate IS NULL")
	boolean existsActiveAssociation(@Param("divisionId") UUID divisionId, @Param("personId") UUID personId);
	
	@Query("SELECT dp FROM DivisionPlayer dp JOIN FETCH dp.person WHERE dp.division.id = :divisionId")
	List<DivisionPlayer> findByDivisionId(@Param("divisionId") UUID divisionId);

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