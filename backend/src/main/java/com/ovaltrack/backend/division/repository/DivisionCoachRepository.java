package com.ovaltrack.backend.division.repository;

import java.util.Collection;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ovaltrack.backend.division.domain.DivisionCoach;
import com.ovaltrack.backend.division.domain.dto.DivisionHistoryPersonDTO;
import org.springframework.data.domain.Sort;
import java.util.List;

public interface DivisionCoachRepository extends JpaRepository<DivisionCoach, UUID> {

    @Query("SELECT dc FROM DivisionCoach dc WHERE dc.division.id = :divisionId AND dc.endDate IS NULL")
    Collection<DivisionCoach> findActiveDivisionCoachesByDivisionId(@Param("divisionId") UUID divisionId);

    @Query("""
            SELECT COUNT(dc) > 0
            FROM DivisionCoach dc 
            WHERE dc.division.id = :divisionId
            AND dc.person.id = :personId 
            AND dc.endDate IS NULL
        """)
    boolean existsActiveAssociation(@Param("divisionId") UUID divisionId,
            @Param("personId") UUID personId);

    @Query("SELECT dc FROM DivisionCoach dc JOIN FETCH dc.division d WHERE dc.person.id = :personId AND dc.endDate IS NULL")
    Collection<DivisionCoach> findActiveByPersonId(@Param("personId") UUID personId);

	@Query("""
            SELECT dc 
            FROM DivisionCoach dc 
            WHERE dc.division.id = :divisionId 
            AND dc.person.id = :personId
            ORDER BY startDate DESC
            """)
	Collection<DivisionCoach> findDivisionCoachesByDivisionIdAndPersonId(@Param("divisionId") UUID divisionId, @Param ("personId") UUID personId);

	@Query("""
	    SELECT new com.ovaltrack.backend.division.domain.dto.DivisionHistoryPersonDTO(
	      p.id, p.firstName, p.lastName, p.contactEmail,
	      CASE WHEN SUM(CASE WHEN dc.endDate IS NULL THEN 1 ELSE 0 END) > 0 THEN true ELSE false END,
	      MIN(dc.startDate), MAX(dc.endDate))
	    FROM DivisionCoach dc JOIN dc.person p
	    WHERE dc.division.id = :divisionId
	      AND (LOWER(CONCAT(p.firstName, ' ', p.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
	           OR LOWER(CONCAT(p.lastName, ' ', p.firstName)) LIKE LOWER(CONCAT('%', :search, '%'))
	           OR LOWER(COALESCE(p.contactEmail, '')) LIKE LOWER(CONCAT('%', :search, '%')))
	    GROUP BY p.id, p.firstName, p.lastName, p.contactEmail
	    ORDER BY p.lastName, p.firstName
	""")
	List<DivisionHistoryPersonDTO> findHistoryPeople(@Param("divisionId") UUID divisionId, @Param("search") String search);

}