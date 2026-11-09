package com.ovaltrack.backend.user.domain;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.person.domain.Person;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @EqualsAndHashCode.Include
    private UUID id;

    @Column(name = "login_email", nullable = false, unique = true)
    private String loginEmail;

    @Column(name = "password_hash", nullable = false)
    @JsonIgnore
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_status")
    @Builder.Default
    private UserStatus accountStatus = UserStatus.PENDING_APPROVAL;

    @OneToOne(optional = true)
    @JoinColumn(name = "person_id", nullable = true, unique = true)
    private Person person;
    
    @Builder.Default
    private Boolean active = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /** Momento en que aceptó los Términos y la Política de Privacidad (null: cuenta creada por un administrador). */
    @Column(name = "terms_accepted_at")
    private LocalDateTime termsAcceptedAt;

    /** Versión de los textos legales que aceptó. */
    @Column(name = "terms_version", length = 20)
    private String termsVersion;

    /** Registra la aceptación de la versión indicada de los textos legales. */
    public void acceptTerms(String version) {
        this.termsAcceptedAt = LocalDateTime.now();
        this.termsVersion = version;
    }

    public boolean isDeactivated() {
        return Boolean.FALSE.equals(this.active);
    }

    public boolean isActivated() {
        return Boolean.TRUE.equals(this.active);
    }

    public void activate() {
        if (isActivated()) {
            throw new BusinessException("El usuario ya se encuentra dado de alta");
        }
        this.active = true;
        this.accountStatus = UserStatus.ACTIVE;
    }

    public void deactivate() {
        if (isDeactivated()) {
            throw new BusinessException("El usuario ya se encuentra dado de baja");
        }
        this.active = false;
        this.accountStatus = UserStatus.SUSPENDED;
    }
}
