package com.ovaltrack.backend.invitations.domain;

import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.token.domain.Token;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "invitations",
       uniqueConstraints = @UniqueConstraint(
           name = "uk_invitation_person_division",
           columnNames = { "person_id", "division_id" }))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Invitation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Club que envía la invitación. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "club_id", nullable = false)
    private Club club;

    /** División activa del jugador al invitarlo. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "division_id", nullable = false)
    private Division division;

    /** Persona a la que se quiere asociar la cuenta. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "person_id", nullable = false)
    private Person person;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "token_id", nullable = false)
    private Token token;

    /** Último envío: se renueva al reenviar. */
    @CreationTimestamp
    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;

    /** Reenvío: el enlace anterior deja de servir y se registra el nuevo envío. */
    public void resend(Token newToken) {
        if (this.token != null) {
            this.token.setUsed(true);
        }
        this.token = newToken;
        this.sentAt = LocalDateTime.now();
    }

    public boolean isPending() {
        return token != null && !token.isUsed() && token.getExpiresAt().isAfter(LocalDateTime.now());
    }
}
