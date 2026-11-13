package com.ovaltrack.backend.person.business;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import com.ovaltrack.backend.club.business.ClubService;
import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.division.domain.DivisionPlayer;
import com.ovaltrack.backend.division.repository.DivisionCoachRepository;
import com.ovaltrack.backend.division.repository.DivisionPlayerRepository;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.UserRole;

@ExtendWith(MockitoExtension.class)
class PersonSecurityValidatorTest {

    @Mock private UserService userService;
    @Mock private ClubService clubService;
    @Mock private DivisionPlayerRepository divisionPlayerRepository;
    @Mock private DivisionCoachRepository divisionCoachRepository;

    @InjectMocks private PersonSecurityValidator validator;

    private final Club club = Club.builder().id(UUID.randomUUID()).build();
    private final Club otherClub = Club.builder().id(UUID.randomUUID()).build();
    private final Division division = Division.builder().id(UUID.randomUUID()).club(club).build();
    private final Person callerPerson = Person.builder().id(UUID.randomUUID()).club(club).build();
    private Authentication authentication;

    @BeforeEach
    void setUp() {
        authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("caller@test.com");
    }

    private void callerIs(UserRole role) {
        User caller = User.builder().id(UUID.randomUUID()).role(role).person(callerPerson).active(true).build();
        when(userService.findUserByEmail("caller@test.com")).thenReturn(caller);
    }

    private Person personWithAccount(UserRole role, Club personClub) {
        Person person = Person.builder().id(UUID.randomUUID()).club(personClub).build();
        if (role != null) {
            when(userService.findUserByPersonId(person.getId()))
                    .thenReturn(User.builder().id(UUID.randomUUID()).role(role).person(person).build());
        }
        return person;
    }

    private void playsInCallerDivision(Person player, boolean callerCoachesIt) {
        when(divisionPlayerRepository.findActiveByPersonId(player.getId()))
                .thenReturn(List.of(DivisionPlayer.builder().person(player).division(division).build()));
        when(divisionCoachRepository.existsActiveAssociation(division.getId(), callerPerson.getId()))
                .thenReturn(callerCoachesIt);
    }

    @Test
    @DisplayName("el administrador del club edita a cualquier persona de su club, incluidos entrenadores y administradores")
    void clubAdmin_editsAnyoneOfTheClub() {
        callerIs(UserRole.ADMIN_CLUB);
        when(clubService.findClubEntityForAuthenticatedUser(authentication)).thenReturn(club);

        assertDoesNotThrow(() -> validator.validateCanEditPerson(Person.builder().id(UUID.randomUUID()).club(club).build(), authentication));
    }

    @Test
    @DisplayName("nadie de un club edita a una persona de otro club")
    void clubAdmin_cannotEditOtherClub() {
        callerIs(UserRole.ADMIN_CLUB);
        when(clubService.findClubEntityForAuthenticatedUser(authentication)).thenReturn(club);
        Person foreign = Person.builder().id(UUID.randomUUID()).club(otherClub).build();

        assertThrows(AccessDeniedException.class, () -> validator.validateCanEditPerson(foreign, authentication));
    }

    @Test
    @DisplayName("el entrenador edita a un jugador de una de sus divisiones")
    void coach_editsPlayerOfOwnDivision() {
        callerIs(UserRole.COACH_ANALYST);
        when(clubService.findClubEntityForAuthenticatedUser(authentication)).thenReturn(club);
        Person player = personWithAccount(UserRole.PLAYER, club);
        playsInCallerDivision(player, true);

        assertDoesNotThrow(() -> validator.validateCanEditPerson(player, authentication));
    }

    @Test
    @DisplayName("el entrenador edita a un jugador sin cuenta de una de sus divisiones")
    void coach_editsPlayerWithoutAccount() {
        callerIs(UserRole.COACH_ANALYST);
        when(clubService.findClubEntityForAuthenticatedUser(authentication)).thenReturn(club);
        Person player = personWithAccount(null, club);
        playsInCallerDivision(player, true);

        assertDoesNotThrow(() -> validator.validateCanEditPerson(player, authentication));
    }

    @Test
    @DisplayName("el entrenador no edita a un jugador de una división que no entrena")
    void coach_cannotEditPlayerOfOtherDivision() {
        callerIs(UserRole.COACH_ANALYST);
        when(clubService.findClubEntityForAuthenticatedUser(authentication)).thenReturn(club);
        Person player = personWithAccount(UserRole.PLAYER, club);
        playsInCallerDivision(player, false);

        assertThrows(AccessDeniedException.class, () -> validator.validateCanEditPerson(player, authentication));
    }

    @Test
    @DisplayName("el entrenador no edita a otro entrenador ni al administrador del club")
    void coach_cannotEditStaff() {
        callerIs(UserRole.COACH_ANALYST);
        when(clubService.findClubEntityForAuthenticatedUser(authentication)).thenReturn(club);
        Person coach = personWithAccount(UserRole.COACH_ANALYST, club);
        Person admin = personWithAccount(UserRole.ADMIN_CLUB, club);

        assertThrows(AccessDeniedException.class, () -> validator.validateCanEditPerson(coach, authentication));
        assertThrows(AccessDeniedException.class, () -> validator.validateCanEditPerson(admin, authentication));
    }

    @Test
    @DisplayName("un jugador no edita datos de otras personas")
    void player_cannotEdit() {
        callerIs(UserRole.PLAYER);

        assertThrows(AccessDeniedException.class,
                () -> validator.validateCanEditPerson(Person.builder().id(UUID.randomUUID()).club(club).build(), authentication));
    }
}
