package com.ovaltrack.backend.token.repository;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ovaltrack.backend.token.domain.Token;
import com.ovaltrack.backend.token.domain.TokenPurpose;

public interface TokenRepository extends JpaRepository<Token, UUID> {
    @Query("SELECT t FROM Token t WHERE t.hash=?1")
    Token findByHash(String hash);

    @Modifying
    @Query("UPDATE Token t SET t.used = true WHERE t.hash = :hash AND t.used = false AND t.expiresAt > :now")
    int markAsUsed(@Param("hash") String hash, @Param("now") LocalDateTime now);

    @Modifying
    @Query("UPDATE Token t SET t.used = true WHERE t.hash = :hash AND t.purpose = :purpose AND t.used = false AND t.expiresAt > :now")
    int markAsUsed(@Param("hash") String hash, @Param("purpose") TokenPurpose purpose, @Param("now") LocalDateTime now);

    /** Anula los tokens sin usar de un correo para un propósito (p. ej. al pedir un enlace nuevo). */
    @Modifying
    @Query("UPDATE Token t SET t.used = true WHERE LOWER(t.email) = LOWER(:email) AND t.purpose = :purpose AND t.used = false")
    int revokeActive(@Param("email") String email, @Param("purpose") TokenPurpose purpose);
}
