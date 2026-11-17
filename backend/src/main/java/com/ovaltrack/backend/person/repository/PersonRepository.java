package com.ovaltrack.backend.person.repository;

import com.ovaltrack.backend.person.domain.Person;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PersonRepository extends JpaRepository<Person, UUID> {

    Optional<Person> findByContactEmail(String contactEmail);

    boolean existsByContactEmail(String contactEmail);

    boolean existsByContactEmailIgnoreCase(String contactEmail);

    boolean existsByContactEmailIgnoreCaseAndIdNot(String contactEmail, UUID id);

    boolean existsByContactPhone(String contactPhone);

    Optional<Person> findFirstByContactEmailIgnoreCase(String contactEmail);

    Optional<Person> findFirstByClubIdAndFirstNameIgnoreCaseAndLastNameIgnoreCaseAndBirthDate(
            UUID clubId, String firstName, String lastName, LocalDate birthDate);

    List<Person> findAllByClubId(UUID clubId);

    @Query("""
        SELECT DISTINCT p
        FROM Person p
        WHERE p.club.id = :clubId
        AND NOT EXISTS (
            SELECT activeDp
            FROM DivisionPlayer activeDp
            WHERE activeDp.person.id = p.id
                AND activeDp.division.id = :divisionId
                AND activeDp.endDate IS NULL
        )
        AND NOT EXISTS (
            SELECT activeDc
            FROM DivisionCoach activeDc
            WHERE activeDc.person.id = p.id
                AND activeDc.division.id = :divisionId
                AND activeDc.endDate IS NULL
        )
        ORDER BY p.lastName, p.firstName
    """)
    Page<Person> findPaginatedInactivePlayersByClubAndDivision(@Param("clubId") UUID clubId, @Param ("divisionId") UUID divisionId, Pageable pageable);

    @Query("""
        SELECT DISTINCT p
        FROM Person p
        WHERE p.club.id = :clubId
        AND NOT EXISTS (
            SELECT activeDp
            FROM DivisionPlayer activeDp
            WHERE activeDp.person.id = p.id
                AND activeDp.division.id = :divisionId
                AND activeDp.endDate IS NULL
        )
        AND NOT EXISTS (
            SELECT activeDc
            FROM DivisionCoach activeDc
            WHERE activeDc.person.id = p.id
                AND activeDc.division.id = :divisionId
                AND activeDc.endDate IS NULL
        )
        AND (
            LOWER(CONCAT(p.firstName, ' ', p.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
            OR LOWER(CONCAT(p.lastName, ' ', p.firstName)) LIKE LOWER(CONCAT('%', :search, '%'))
            OR LOWER(COALESCE(p.contactEmail, '')) LIKE LOWER(CONCAT('%', :search, '%'))
        )
        ORDER BY p.lastName, p.firstName
    """)
    Page<Person> searchPaginatedInactivePlayersByClubAndDivision(
            @Param("clubId") UUID clubId, @Param("divisionId") UUID divisionId,
            @Param("search") String search, Pageable pageable);
    
    @Query("""
        SELECT DISTINCT p
        FROM Person p
        JOIN DivisionPlayer dp ON dp.person.id = p.id
        WHERE dp.division.id = :divisionId
        AND dp.endDate IS NULL
        ORDER BY p.lastName, p.firstName
    """)
    Page<Person> findAllPlayersByDivision(UUID divisionId, Pageable pageable);

}
