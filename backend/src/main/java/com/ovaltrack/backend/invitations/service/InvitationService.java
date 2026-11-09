package com.ovaltrack.backend.invitations.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.config.exceptions.EntityNotFoundException;
import com.ovaltrack.backend.common.config.exceptions.MailDeliveryException;
import com.ovaltrack.backend.common.mail.service.EmailService;
import com.ovaltrack.backend.division.business.DivisionPlayerService;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.division.domain.DivisionPlayer;
import com.ovaltrack.backend.invitations.domain.ClubPlayerResponse;
import com.ovaltrack.backend.invitations.domain.ClubPlayerResponse.DivisionSummary;
import com.ovaltrack.backend.invitations.domain.Invitation;
import com.ovaltrack.backend.invitations.domain.InvitationSummaryResponse;
import com.ovaltrack.backend.invitations.domain.PlayerAccountStatus;
import com.ovaltrack.backend.invitations.repository.InvitationRepository;
import com.ovaltrack.backend.person.business.PersonService;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.token.domain.Token;
import com.ovaltrack.backend.token.domain.TokenPurpose;
import com.ovaltrack.backend.token.service.TokenService;
import com.ovaltrack.backend.user.business.UserService;

import lombok.RequiredArgsConstructor;

/**
 * Invitaciones de jugadores a crear su cuenta: tabla de jugadores con su estado, envío y reenvío
 * del enlace, y validación del enlace antes del alta.
 */
@Service
@RequiredArgsConstructor
public class InvitationService {

    public static final Duration LINK_TTL = Duration.ofHours(72);

    static final String INVALID_LINK = "El enlace de invitación no es válido. Revisá que esté completo o pedile al club uno nuevo.";
    static final String USED_LINK = "Esta invitación ya se usó. Si ya creaste tu cuenta, iniciá sesión.";
    static final String EXPIRED_LINK = "Esta invitación venció. Pedile al club que te envíe una nueva.";

    private static final Logger logger = LoggerFactory.getLogger(InvitationService.class);

    private final InvitationRepository repository;
    private final DivisionPlayerService divisionPlayerService;
    private final PersonService personService;
    private final TokenService tokenService;
    private final EmailService emailService;
    private final UserService userService;
    private final InviterScopeResolver scopeResolver;
    private final PlayerAccountStatusResolver statusResolver;

    // <==================== Tabla de jugadores ====================>

    /** Jugadores activos que quien consulta puede invitar (club entero o sus divisiones), con su estado. */
    @Transactional(readOnly = true)
    public List<ClubPlayerResponse> findPlayers(Authentication authentication) {
        InviterScope scope = scopeResolver.resolve(authentication);
        List<DivisionPlayer> rows = divisionPlayerService.findActivePlayersByClubId(scope.club().getId()).stream()
                .filter(dp -> scope.covers(dp.getDivision()))
                .toList();
        return toResponses(rows);
    }

    // <==================== Envío y reenvío ====================>

    /**
     * Envía el enlace para crear la cuenta; si ya tenía uno, lo reemplaza (el anterior deja de servir).
     * Si el correo no sale, no queda nada guardado.
     */
    @Transactional
    public ClubPlayerResponse invite(UUID personId, Authentication authentication) {
        InviterScope scope = scopeResolver.resolve(authentication);

        Person person = personService.findPersonEntityById(personId);
        if (person == null || person.getClub() == null || !scope.club().getId().equals(person.getClub().getId())) {
            throw new EntityNotFoundException("No encontramos a ese jugador en tu club.");
        }
        List<Invitation> invitations = repository.findWithTokenByPersonIds(List.of(personId));
        ensureCanInvite(person, statusFor(person, invitations));

        List<DivisionPlayer> activeInClub = divisionPlayerService.findActivePlayersByClubId(scope.club().getId()).stream()
                .filter(dp -> dp.getPerson().getId().equals(personId))
                .toList();
        if (activeInClub.isEmpty()) {
            throw new BusinessException(person.getFirstName() + " " + person.getLastName()
                    + " no está en ninguna división activa. Asignalo a una antes de invitarlo.");
        }
        List<DivisionPlayer> allowed = activeInClub.stream().filter(dp -> scope.covers(dp.getDivision())).toList();
        if (allowed.isEmpty()) {
            throw new AccessDeniedException("Solo podés invitar a jugadores de las divisiones que entrenás.");
        }

        Division division = chooseDivision(allowed, invitations);
        String rawToken = tokenService.generateRawValue();
        Token token = tokenService.create(person.getContactEmail().trim(), LINK_TTL, rawToken, TokenPurpose.INVITATION).token();

        Invitation invitation = invitations.stream()
                .filter(i -> i.getDivision().getId().equals(division.getId()))
                .findFirst()
                .orElseGet(() -> newInvitation(person, division));
        // Un solo enlace vigente por persona: se anulan los de otras divisiones
        invitations.stream().filter(i -> i != invitation).forEach(i -> i.getToken().setUsed(true));
        boolean resend = invitation.getId() != null;
        if (resend) {
            invitation.resend(token);
        } else {
            invitation.setToken(token);
        }
        repository.saveAndFlush(invitation);

        sendMail(person, rawToken);
        logger.info("{} de invitación a la persona {} (división {})", resend ? "Reenvío" : "Envío", personId, division.getId());

        return toResponses(allowed).get(0);
    }

    // <==================== Enlace del correo ====================>

    /** Datos que muestra el formulario de alta; falla con un mensaje específico si el enlace no sirve. */
    @Transactional(readOnly = true)
    public InvitationSummaryResponse validate(String rawToken) {
        Invitation invitation = findValidInvitation(rawToken);
        Person person = invitation.getPerson();
        return new InvitationSummaryResponse(person.getFirstName(), person.getLastName(),
                person.getContactEmail(), invitation.getClub().getName(), invitation.getDivision().getName());
    }

    /** Invitación de un enlace vigente cuya persona todavía puede crear su cuenta. La usa el alta. */
    @Transactional(readOnly = true)
    public Invitation findValidInvitation(String rawToken) {
        Token token = rawToken == null || rawToken.isBlank() ? null : tokenService.findUsable(rawToken);
        if (token == null || !token.isFor(TokenPurpose.INVITATION)) {
            throw new BusinessException(INVALID_LINK);
        }
        Invitation invitation = repository.findByTokenHash(token.getHash())
                .orElseThrow(() -> new BusinessException(INVALID_LINK));
        if (token.isUsed()) {
            throw new BusinessException(USED_LINK);
        }
        if (!token.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw new BusinessException(EXPIRED_LINK);
        }
        Person person = invitation.getPerson();
        if (userService.findUserByPersonId(person.getId()) != null) {
            throw new BusinessException("Ya tenés una cuenta en OvalTrack. Iniciá sesión con tu correo.");
        }
        if (userService.existsByEmail(person.getContactEmail())) {
            throw new BusinessException("Ya existe una cuenta con el correo " + person.getContactEmail()
                    + ". Pedile al club que actualice tu correo de contacto.");
        }
        return invitation;
    }

    // <==================== Internos ====================>

    private PlayerAccountStatus statusFor(Person person, List<Invitation> invitations) {
        String email = PlayerAccountStatusResolver.normalizedEmail(person);
        return statusResolver.resolve(person,
                userService.findPersonIdsWithAccount(List.of(person.getId())),
                email == null ? Set.of() : userService.findUsedLoginEmails(List.of(email)),
                invitations);
    }

    private static void ensureCanInvite(Person person, PlayerAccountStatus status) {
        String name = person.getFirstName() + " " + person.getLastName();
        switch (status) {
            case LINKED -> throw new BusinessException(name + " ya tiene una cuenta vinculada.");
            case NO_EMAIL -> throw new BusinessException(
                    name + " no tiene correo de contacto. Cargalo antes de invitarlo.");
            case EMAIL_IN_USE -> throw new BusinessException("El correo " + person.getContactEmail()
                    + " ya es de otra cuenta. Actualizá el correo de contacto de " + name + ".");
            default -> {
                // NOT_INVITED, INVITED (reenvío) o EXPIRED: se puede enviar
            }
        }
    }

    /** Reutiliza la división de una invitación previa si sigue permitida; si no, la asociación más reciente. */
    private static Division chooseDivision(List<DivisionPlayer> allowed, List<Invitation> invitations) {
        Set<UUID> allowedIds = allowed.stream().map(dp -> dp.getDivision().getId()).collect(Collectors.toSet());
        return invitations.stream()
                .sorted(Comparator.comparing(Invitation::getSentAt).reversed())
                .map(Invitation::getDivision)
                .filter(d -> allowedIds.contains(d.getId()))
                .findFirst()
                .orElseGet(() -> allowed.stream()
                        .max(Comparator.comparing(DivisionPlayer::getStartDate,
                                Comparator.nullsFirst(Comparator.naturalOrder())))
                        .map(DivisionPlayer::getDivision)
                        .orElseThrow());
    }

    private static Invitation newInvitation(Person person, Division division) {
        Invitation invitation = new Invitation();
        invitation.setPerson(person);
        invitation.setDivision(division);
        invitation.setClub(division.getClub());
        return invitation;
    }

    private void sendMail(Person person, String rawToken) {
        try {
            emailService.sendInvitation(person, rawToken);
        } catch (Exception e) {
            logger.error("No se pudo enviar la invitación a la persona {}: {}", person.getId(), e.getMessage());
            throw new MailDeliveryException("No pudimos enviar el correo a " + person.getContactEmail()
                    + ". Revisá que esté bien escrito e intentá de nuevo en unos minutos.", e);
        }
    }

    /** Agrupa por persona (un jugador puede estar en varias divisiones) y calcula el estado con 3 consultas. */
    private List<ClubPlayerResponse> toResponses(List<DivisionPlayer> rows) {
        Map<UUID, List<DivisionPlayer>> byPerson = rows.stream()
                .collect(Collectors.groupingBy(dp -> dp.getPerson().getId(), LinkedHashMap::new, Collectors.toList()));
        if (byPerson.isEmpty()) {
            return List.of();
        }
        Set<UUID> withAccount = userService.findPersonIdsWithAccount(byPerson.keySet());
        Set<String> usedEmails = userService.findUsedLoginEmails(byPerson.values().stream()
                .map(list -> PlayerAccountStatusResolver.normalizedEmail(list.get(0).getPerson()))
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));
        Map<UUID, List<Invitation>> invitationsByPerson = repository.findWithTokenByPersonIds(byPerson.keySet()).stream()
                .collect(Collectors.groupingBy(i -> i.getPerson().getId()));

        return byPerson.values().stream().map(list -> {
            Person person = list.get(0).getPerson();
            List<Invitation> invitations = invitationsByPerson.getOrDefault(person.getId(), List.of());
            PlayerAccountStatus status = statusResolver.resolve(person, withAccount, usedEmails, invitations);
            Invitation last = statusResolver.latest(invitations).orElse(null);
            boolean showInvitation = last != null && status != PlayerAccountStatus.LINKED;
            return new ClubPlayerResponse(
                    person.getId(),
                    person.getFirstName(),
                    person.getLastName(),
                    person.getContactEmail(),
                    list.stream().map(dp -> new DivisionSummary(dp.getDivision().getId(), dp.getDivision().getName()))
                            .distinct().toList(),
                    status,
                    showInvitation ? last.getSentAt() : null,
                    showInvitation ? last.getToken().getExpiresAt() : null);
        }).toList();
    }
}
