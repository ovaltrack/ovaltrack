package com.ovaltrack.backend.person.repository;

import com.ovaltrack.backend.person.domain.Person;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PersonRepository extends JpaRepository<Person, UUID> {

    Optional<Person> findByContactEmail(String contactEmail);

    boolean existsByContactEmail(String contactEmail);

    boolean existsByContactEmailIgnoreCase(String contactEmail);

    boolean existsByContactEmailIgnoreCaseAndIdNot(String contactEmail, UUID id);

    boolean existsByContactPhone(String contactPhone);

    List<Person> findAllByClubId(UUID clubId);

    @Query("""
        SELECT DISTINCT p
        FROM Person p
        JOIN DivisionPlayer dp ON dp.person.id = p.id
        JOIN dp.division d
        JOIN d.club c
        WHERE c.id = :clubId
        AND NOT EXISTS (
            SELECT activeDp
            FROM DivisionPlayer activeDp
            WHERE activeDp.person.id = p.id
                AND activeDp.division.id = :divisionId
                AND activeDp.endDate IS NULL
        )
        ORDER BY p.lastName, p.firstName
    """)
    Page<Person> findPaginatedInactivePlayersByClubAndDivision(@Param("clubId") UUID clubId, @Param ("divisionId") UUID divisionId, Pageable pageable);
    
    @Query("""
        SELECT DISTINCT p
        FROM Person p
        JOIN DivisionPlayer dp ON dp.person.id = p.id
        WHERE dp.division.id = :divisionId
        ORDER BY p.lastName, p.firstName
    """)
    Page<Person> findAllPlayersByDivision(UUID divisionId, Pageable pageable);

}
