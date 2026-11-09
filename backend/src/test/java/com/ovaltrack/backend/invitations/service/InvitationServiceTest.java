package com.ovaltrack.backend.invitations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.config.exceptions.EntityNotFoundException;
import com.ovaltrack.backend.common.config.exceptions.MailDeliveryException;
import com.ovaltrack.backend.common.mail.service.EmailService;
import com.ovaltrack.backend.division.business.DivisionPlayerService;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.division.domain.DivisionPlayer;
import com.ovaltrack.backend.invitations.domain.ClubPlayerResponse;
import com.ovaltrack.backend.invitations.domain.Invitation;
import com.ovaltrack.backend.invitations.domain.PlayerAccountStatus;
import com.ovaltrack.backend.invitations.repository.InvitationRepository;
import com.ovaltrack.backend.person.business.PersonService;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.token.domain.Token;
import com.ovaltrack.backend.token.domain.TokenPurpose;
import com.ovaltrack.backend.token.service.TokenService;
import com.ovaltrack.backend.token.service.TokenService.IssuedToken;
import com.ovaltrack.backend.user.business.UserService;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("InvitationService: envío, reenvío y estado de la cuenta del jugador")
class InvitationServiceTest {

    @Mock private InvitationRepository repository;
    @Mock private DivisionPlayerService divisionPlayerService;
    @Mock private PersonService personService;
    @Mock private TokenService tokenService;
    @Mock private EmailService emailService;
    @Mock private UserService userService;
    @Mock private InviterScopeResolver scopeResolver;
    @Mock private Authentication authentication;

    private InvitationService service;
    private Club club;
    private Division primera;
    private Division m19;
    private Person player;

    @BeforeEach
    void setUp() {
        service = new InvitationService(repository, divisionPlayerService, personService, tokenService, emailService,
                userService, scopeResolver, new PlayerAccountStatusResolver());
        club = new Club();
        club.setId(UUID.randomUUID());
        club.setName("PMRC");
        primera = division("Primera");
        m19 = division("M19");
        player = Person.builder().id(UUID.randomUUID()).firstName("Juan").lastName("Pérez")
                .contactEmail("juan@test.com").club(club).build();

        when(scopeResolver.resolve(authentication)).thenReturn(new InviterScope(club, null));
        when(personService.findPersonEntityById(player.getId())).thenReturn(player);
        when(divisionPlayerService.findActivePlayersByClubId(club.getId()))
                .thenReturn(List.of(membership(player, primera)));
        when(userService.findPersonIdsWithAccount(anyCollection())).thenReturn(Set.of());
        when(userService.findUsedLoginEmails(anyCollection())).thenReturn(Set.of());
        when(repository.findWithTokenByPersonIds(anyCollection())).thenReturn(new ArrayList<>());
        when(tokenService.generateRawValue()).thenReturn("raw");
        when(tokenService.create(anyString(), any(), eq("raw"), eq(TokenPurpose.INVITATION)))
                .thenAnswer(inv -> new IssuedToken(token(false, LocalDateTime.now().plusHours(72)), "raw"));
        when(repository.saveAndFlush(any(Invitation.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("Invitar a un jugador sin invitaciones crea la invitación en su división y envía el correo")
    void invitesNewPlayer() throws Exception {
        ClubPlayerResponse response = service.invite(player.getId(), authentication);

        ArgumentCaptor<Invitation> saved = ArgumentCaptor.forClass(Invitation.class);
        verify(repository).saveAndFlush(saved.capture());
        assertSame(primera, saved.getValue().getDivision());
        assertSame(club, saved.getValue().getClub());
        verify(emailService).sendInvitation(player, "raw");
        assertEquals(PlayerAccountStatus.NOT_INVITED, response.status(),
                "La respuesta se arma con las invitaciones consultadas antes de guardar (mock)");
    }

    @Test
    @DisplayName("Reenviar reutiliza la invitación, anula el enlace anterior y renueva el envío")
    void resendsPendingInvitation() {
        Token previous = token(false, LocalDateTime.now().plusHours(10));
        Invitation existing = invitation(primera, previous, LocalDateTime.now().minusHours(62));
        when(repository.findWithTokenByPersonIds(anyCollection())).thenReturn(new ArrayList<>(List.of(existing)));

        service.invite(player.getId(), authentication);

        assertTrue(previous.isUsed(), "El enlace anterior tiene que quedar anulado");
        assertFalse(existing.getToken().isUsed());
        assertTrue(existing.getSentAt().isAfter(LocalDateTime.now().minusMinutes(1)));
        verify(repository).saveAndFlush(existing);
    }

    @Test
    @DisplayName("Un jugador con cuenta no se puede invitar y no se envía nada")
    void rejectsLinkedPlayer() throws Exception {
        when(userService.findPersonIdsWithAccount(anyCollection())).thenReturn(Set.of(player.getId()));

        BusinessException error = assertThrows(BusinessException.class, () -> service.invite(player.getId(), authentication));

        assertEquals("Juan Pérez ya tiene una cuenta vinculada.", error.getMessage());
        verify(emailService, never()).sendInvitation(any(), anyString());
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Un jugador sin correo de contacto no se puede invitar")
    void rejectsPlayerWithoutEmail() {
        player.setContactEmail(" ");

        BusinessException error = assertThrows(BusinessException.class, () -> service.invite(player.getId(), authentication));

        assertEquals("Juan Pérez no tiene correo de contacto. Cargalo antes de invitarlo.", error.getMessage());
    }

    @Test
    @DisplayName("Si el correo ya es de otra cuenta, el mensaje lo nombra")
    void rejectsEmailInUse() {
        when(userService.findUsedLoginEmails(anyCollection())).thenReturn(Set.of("juan@test.com"));

        BusinessException error = assertThrows(BusinessException.class, () -> service.invite(player.getId(), authentication));

        assertTrue(error.getMessage().startsWith("El correo juan@test.com ya es de otra cuenta."));
    }

    @Test
    @DisplayName("Un entrenador no puede invitar a jugadores de divisiones que no entrena")
    void coachOutsideDivisionIsDenied() {
        when(scopeResolver.resolve(authentication)).thenReturn(new InviterScope(club, Set.of(m19.getId())));

        assertThrows(AccessDeniedException.class, () -> service.invite(player.getId(), authentication));
    }

    @Test
    @DisplayName("Una persona que no es del club responde 404")
    void unknownPlayer() {
        assertThrows(EntityNotFoundException.class, () -> service.invite(UUID.randomUUID(), authentication));
    }

    @Test
    @DisplayName("Un jugador del club sin división activa no se puede invitar")
    void playerWithoutActiveDivision() {
        when(divisionPlayerService.findActivePlayersByClubId(club.getId())).thenReturn(List.of());

        BusinessException error = assertThrows(BusinessException.class, () -> service.invite(player.getId(), authentication));

        assertEquals("Juan Pérez no está en ninguna división activa. Asignalo a una antes de invitarlo.", error.getMessage());
    }

    @Test
    @DisplayName("Si el correo no sale, se informa con un mensaje claro (y la transacción revierte)")
    void mailFailure() throws Exception {
        doThrow(new BusinessException("SMTP caído")).when(emailService).sendInvitation(any(), anyString());

        MailDeliveryException error = assertThrows(MailDeliveryException.class,
                () -> service.invite(player.getId(), authentication));

        assertTrue(error.getMessage().startsWith("No pudimos enviar el correo a juan@test.com."));
    }

    @Test
    @DisplayName("La tabla agrupa las divisiones del jugador y marca la invitación vencida")
    void listsPlayersWithStatus() {
        when(divisionPlayerService.findActivePlayersByClubId(club.getId()))
                .thenReturn(List.of(membership(player, primera), membership(player, m19)));
        Invitation expired = invitation(primera, token(false, LocalDateTime.now().minusHours(1)), LocalDateTime.now().minusDays(4));
        when(repository.findWithTokenByPersonIds(anyCollection())).thenReturn(List.of(expired));

        List<ClubPlayerResponse> players = service.findPlayers(authentication);

        assertEquals(1, players.size());
        assertEquals(2, players.get(0).divisions().size());
        assertEquals(PlayerAccountStatus.EXPIRED, players.get(0).status());
        assertEquals(expired.getSentAt(), players.get(0).invitedAt());
    }

    // <==================== Fixtures ====================>

    private Division division(String name) {
        Division division = new Division();
        division.setId(UUID.randomUUID());
        division.setName(name);
        division.setClub(club);
        return division;
    }

    private static DivisionPlayer membership(Person person, Division division) {
        DivisionPlayer dp = new DivisionPlayer();
        dp.setPerson(person);
        dp.setDivision(division);
        dp.setStartDate(LocalDate.now().minusMonths(1));
        return dp;
    }

    private static Token token(boolean used, LocalDateTime expiresAt) {
        Token token = new Token();
        token.setId(UUID.randomUUID());
        token.setUsed(used);
        token.setExpiresAt(expiresAt);
        token.setPurpose(TokenPurpose.INVITATION);
        return token;
    }

    private Invitation invitation(Division division, Token token, LocalDateTime sentAt) {
        Invitation invitation = new Invitation();
        invitation.setId(UUID.randomUUID());
        invitation.setPerson(player);
        invitation.setDivision(division);
        invitation.setClub(club);
        invitation.setToken(token);
        invitation.setSentAt(sentAt);
        return invitation;
    }
}
