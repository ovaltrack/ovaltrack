package com.ovaltrack.backend.auth.service;

import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.ovaltrack.backend.auth.access.AccessStatus;
import com.ovaltrack.backend.auth.access.AccountAccessService;
import com.ovaltrack.backend.auth.dto.AuthResponse;
import com.ovaltrack.backend.auth.dto.LoginRequest;
import com.ovaltrack.backend.auth.dto.RegisterFromInvitationRequest;
import com.ovaltrack.backend.auth.registration.domain.dto.ClubRegistrationDTO;
import com.ovaltrack.backend.auth.registration.domain.dto.ClubRegistrationDTO.AdminData;
import com.ovaltrack.backend.auth.registration.domain.dto.ClubRegistrationDTO.ClubData;
import com.ovaltrack.backend.auth.registration.domain.dto.MemberRegistrationDTO;
import com.ovaltrack.backend.auth.security.JwtService;
import com.ovaltrack.backend.club.business.ClubService;
import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.club.domain.ClubStatus;
import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.config.exceptions.ClubInactiveException;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.UserRole;
import com.ovaltrack.backend.user.domain.UserStatus;

import jakarta.transaction.Transactional;

import com.ovaltrack.backend.common.config.exceptions.UserDeactivatedException;
import com.ovaltrack.backend.invitations.domain.Invitation;
import com.ovaltrack.backend.invitations.service.InvitationService;
import com.ovaltrack.backend.person.business.PersonService;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.token.service.TokenService;

@Service
public class AuthService {
    private final UserService userService;
    private final ClubService clubService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private PersonService personService;
    private InvitationService invitationService;
    private TokenService tokenService;
    private final AccountAccessService accountAccessService;

    public AuthService(UserService userService,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            ClubService clubService,
            PersonService personService,
            InvitationService invitationService,
            TokenService tokenService,
            AccountAccessService accountAccessService) {
        this.userService = userService;
        this.accountAccessService = accountAccessService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.clubService = clubService;
        this.personService = personService;
        this.invitationService = invitationService;
        this.tokenService = tokenService;
    }

    @Transactional
    public void register(MemberRegistrationDTO request) {

        MemberRegistrationDTO.ApplicantData applicant = request.applicant();

        // 1. El email no puede estar registrado
        if (validateEmail(applicant.email()))
            throw new BusinessException("El email ya fue registrado con una cuenta");

        // 2. El club debe existir (el cliente solo envía su id) y estar activo
        UUID clubId = request.club().id();
        if (clubId == null)
            throw new BusinessException("El club es obligatorio");

        Club club = clubService.findClubEntityById(clubId);

        if (club == null) {
            throw new BusinessException("El club no existe");
        }

        if (club.getStatus() != ClubStatus.ACTIVE)
            throw new BusinessException("El club no está activo y no admite nuevos registros");

        // 3. Persona asociada al club
        Person person = new Person();
        person.setFirstName(applicant.firstName());
        person.setLastName(applicant.lastName());
        person.setBirthDate(applicant.birthDate());
        person.setContactEmail(applicant.email());
        person.setClub(club);
        Person savedPerson = personService.savePersonEntity(person);

        // 4. Usuario inactivo, pendiente de aprobación
        User newUser = new User();
        newUser.setPerson(savedPerson);
        newUser.setLoginEmail(applicant.email());
        newUser.setPasswordHash(passwordEncoder.encode(applicant.password()));
        newUser.setActive(false);
        newUser.setAccountStatus(UserStatus.PENDING_APPROVAL);
        newUser.setRole(applicant.requestedRole());
        userService.saveUser(newUser);
    }

    @Transactional
    public void registerClub(ClubRegistrationDTO request) {

        AdminData admin = request.admin();
        ClubData clubData = request.club();

        // 0. Validaciones previas: nada se guarda si alguna falla
        if (validateEmail(admin.email()))
            throw new BusinessException("El email ya fue registrado con una cuenta");

        validateRequestAdminClub(request);

        // 1. Persona
        Person person = new Person();
        person.setFirstName(admin.firstName());
        person.setLastName(admin.lastName());
        person.setBirthDate(admin.birthDate());
        person.setContactEmail(admin.email());
        Person savedPerson = personService.savePersonEntity(person);

        // 2. Usuario (cuenta pendiente de aprobación; el rol se asigna al aprobar)
        User newUser = new User();
        newUser.setPerson(savedPerson);
        newUser.setLoginEmail(admin.email());
        newUser.setPasswordHash(passwordEncoder.encode(admin.password()));
        newUser.setActive(false);
        newUser.setAccountStatus(UserStatus.PENDING_APPROVAL);
        newUser.setRole(UserRole.ADMIN_CLUB);
        User savedUser = userService.saveUser(newUser);

        // 3. Club (pendiente de aprobación)
        Club club = new Club();
        club.setName(clubData.name());
        club.setCity(clubData.city());
        club.setContactEmail(clubData.contactEmail());
        club.setContactPhone(clubData.contactPhone());
        club.setStatus(ClubStatus.PENDING);
        club.setAdminUser(savedUser);
        Club savedClub = clubService.save(club);

        savedPerson.setClub(savedClub);
        personService.savePersonEntity(savedPerson);

    }

    private boolean validateEmail(String email) {
        return this.userService.existsByEmail(email);
    }

    private void validateRequestAdminClub(ClubRegistrationDTO request) {
        ClubData club = request.club();
        if (club == null
                || club.name() == null || club.name().isBlank()
                || club.city() == null || club.city().isBlank()) {
            throw new BusinessException("El nombre y la ciudad del club son obligatorios para solicitar el alta");
        }
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userService.findUserByEmail(request.email());
        if (user == null) {
            throw new BusinessException("El usuario con el email " + request.email() + " no existe");
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException("Contraseña incorrecta");
        }
        if (Boolean.FALSE.equals(user.getActive())) {
            throw new UserDeactivatedException("La cuenta todavia se encuentra inactiva.");
        }
        if (accountAccessService.check(user.getId()) == AccessStatus.CLUB_INACTIVE) {
            throw new ClubInactiveException(AccountAccessService.CLUB_INACTIVE_MESSAGE);
        }
        String token = jwtService.generateToken(user);
        return new AuthResponse(token);
    }

    public boolean validEmail(String email) {

        if (email == null || email.split("@").length != 2) {
            return false;
        }

        return true;
    }

    // ---- AuthService ----
    // Inyecta además: InvitationService invitationService, TokenService
    // tokenService,
    // UserService userService, PasswordEncoder passwordEncoder

    @Transactional
    public void registerFromInvitation(RegisterFromInvitationRequest request) {
        // 1. Leer y comprobar (sin modificar nada todavía)
        Invitation invitation = invitationService.findUsableInvitation(request.token());
        Person person = invitation.getPerson();
        String email = person.getContactEmail();

        if (userService.existsByEmail(email)) {
            throw new BusinessException(
                    "Ya existe una cuenta con este correo. Inicia sesión para aceptar la asociación.");
        }
        if (userService.findUserByPersonId(person.getId()) != null) {
            throw new BusinessException("Esta persona ya tiene una cuenta vinculada.");
        }

        // 2. Consumir el token ANTES de crear el usuario: el UPDATE atómico decide
        // quién gana
        // si llegan dos peticiones a la vez. Si algo falla después, la transacción
        // revierte
        // y el token queda libre otra vez.
        tokenService.consume(request.token());

        // 3. Crear la cuenta vinculada a la persona. Sin aprobación pendiente:
        // el club ya invitó a este jugador, a diferencia de /register.
        User user = new User();
        user.setLoginEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(UserRole.PLAYER);
        user.setAccountStatus(UserStatus.ACTIVE);
        user.setActive(true);
        user.setPerson(person);
        userService.saveUser(user);
    }
}
