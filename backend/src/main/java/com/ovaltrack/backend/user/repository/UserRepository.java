package com.ovaltrack.backend.user.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ovaltrack.backend.auth.access.UserAccessView;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.UserRole;
import com.ovaltrack.backend.user.domain.UserStatus;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByLoginEmail(String loginEmail);

    boolean existsByLoginEmail(String loginEmail);

    boolean existsByLoginEmailIgnoreCaseAndIdNot(String loginEmail, UUID id);

    boolean existsByRole(UserRole role);

    List<User> findAllByActiveTrueOrderByCreatedAtDesc();

    Optional<User> findByPersonId(UUID personId);

    /** Datos mínimos para revisar el acceso (cuenta activa y estado del club). */
    @Query("SELECT u.active AS active, u.role AS role, c.status AS clubStatus FROM User u LEFT JOIN u.person p LEFT JOIN p.club c WHERE u.id = :userId")
    Optional<UserAccessView> findAccessById(@Param("userId") UUID userId);

    @Query("SELECT u FROM User u WHERE u.person.club.id = :clubId")
    List<User> findAllByClubId(@Param("clubId") UUID clubId);

    @Query("SELECT COUNT(u) > 0 FROM User u WHERE u.person.club.id = :clubId AND u.role = :role AND (u.active IS NULL OR u.active = true) AND u.id != :excludeUserId")
    boolean existsActiveAdminInClubExcludingUser(
            @Param("clubId") UUID clubId,
            @Param("role") UserRole role,
            @Param("excludeUserId") UUID excludeUserId);

    default Optional<User> findByEmail(String email) {
        return findByLoginEmail(email);
    }

    default boolean existsByEmail(String email) {
        return existsByLoginEmail(email);
    }

    List<User> findByRoleNot(UserRole role);

    Collection<User> findAllByAccountStatus(UserStatus status);

    Collection<User> findAllByActive(boolean active);

    @Query(value = """
                    SELECT u, c
                    FROM User u
                    JOIN u.person p
                    JOIN p.club c
                    WHERE u.role = 'ADMIN_CLUB'
                    AND (u.accountStatus = :status OR :status IS NULL) 
                    AND (u.active = :active OR :active IS NULL) 
                    """)
    Collection<Object[]> findUserWithAssociatedClubByStatusAndActive(
        @Param ("status")UserStatus status,
        @Param ("active")Boolean active);
}