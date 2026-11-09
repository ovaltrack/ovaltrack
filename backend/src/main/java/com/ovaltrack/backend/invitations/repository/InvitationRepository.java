package com.ovaltrack.backend.invitations.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ovaltrack.backend.invitations.domain.Invitation;

public interface InvitationRepository extends JpaRepository<Invitation, UUID> {

    /** Invitaciones (con su token) de varias personas: una sola consulta para la tabla de jugadores. */
    @Query("SELECT i FROM Invitation i JOIN FETCH i.token WHERE i.person.id IN :personIds")
    List<Invitation> findWithTokenByPersonIds(@Param("personIds") Collection<UUID> personIds);

    /** Invitación con todo lo que muestra el formulario de alta. */
    @Query("""
            SELECT i FROM Invitation i
            JOIN FETCH i.token t
            JOIN FETCH i.person p
            JOIN FETCH i.club
            JOIN FETCH i.division
            WHERE t.hash = :hash
            """)
    Optional<Invitation> findByTokenHash(@Param("hash") String hash);
}
