package com.ovaltrack.backend.invitations.service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.ovaltrack.backend.invitations.domain.Invitation;
import com.ovaltrack.backend.invitations.domain.PlayerAccountStatus;
import com.ovaltrack.backend.person.domain.Person;

/** Regla única del estado de la cuenta de un jugador; la usan la tabla y el envío de invitaciones. */
@Component
public class PlayerAccountStatusResolver {

    /**
     * @param personIdsWithAccount personas que ya tienen cuenta
     * @param usedLoginEmails      correos de acceso en uso (minúsculas)
     * @param invitations          invitaciones de esta persona (cualquier división)
     */
    public PlayerAccountStatus resolve(Person person, Set<UUID> personIdsWithAccount,
            Set<String> usedLoginEmails, List<Invitation> invitations) {
        if (personIdsWithAccount.contains(person.getId())) {
            return PlayerAccountStatus.LINKED;
        }
        String email = normalizedEmail(person);
        if (email == null) {
            return PlayerAccountStatus.NO_EMAIL;
        }
        if (usedLoginEmails.contains(email)) {
            return PlayerAccountStatus.EMAIL_IN_USE;
        }
        return latest(invitations)
                .map(PlayerAccountStatusResolver::fromInvitation)
                .orElse(PlayerAccountStatus.NOT_INVITED);
    }

    public Optional<Invitation> latest(List<Invitation> invitations) {
        return invitations.stream().max(Comparator.comparing(Invitation::getSentAt));
    }

    /** Correo de contacto en minúsculas; null si no tiene. */
    public static String normalizedEmail(Person person) {
        String email = person.getContactEmail();
        return email == null || email.isBlank() ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    private static PlayerAccountStatus fromInvitation(Invitation invitation) {
        if (invitation.isPending()) {
            return PlayerAccountStatus.INVITED;
        }
        // Enlace usado sin cuenta (p. ej. cuenta eliminada) o anulado: se puede invitar de nuevo
        boolean expired = !invitation.getToken().isUsed()
                && !invitation.getToken().getExpiresAt().isAfter(LocalDateTime.now());
        return expired ? PlayerAccountStatus.EXPIRED : PlayerAccountStatus.NOT_INVITED;
    }
}
