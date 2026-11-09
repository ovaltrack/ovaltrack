package com.ovaltrack.backend.invitations.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Objects;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.mail.service.EmailService;
import com.ovaltrack.backend.division.business.DivisionService;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.invitations.domain.Action;
import com.ovaltrack.backend.invitations.domain.CreateInvitationRequest;
import com.ovaltrack.backend.invitations.domain.Invitation;
import com.ovaltrack.backend.invitations.domain.InvitationResponse;
import com.ovaltrack.backend.invitations.domain.InvitationTokenDTO;
import com.ovaltrack.backend.invitations.domain.InvitationValidationResponse;
import com.ovaltrack.backend.invitations.repository.InvitationRepository;
import com.ovaltrack.backend.person.business.PersonService;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.token.domain.Token;
import com.ovaltrack.backend.token.service.TokenService;
import com.ovaltrack.backend.token.service.TokenService.IssuedToken;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;

import jakarta.mail.MessagingException;
import lombok.AllArgsConstructor;

@Service
@AllArgsConstructor
public class InvitationService {

    private static final Logger logger = LoggerFactory.getLogger(InvitationService.class);

    private InvitationRepository repository;
    private PersonService personService;
    private DivisionService divisionService;
    private TokenService tokenService;
    private EmailService emailService;
    private UserService userService;

    public Collection<Invitation> findAll() {
        logger.info("Buscando todas las invitaciones");
        return repository.findAll();
    }

    public Invitation findById(UUID id) {
        if (id == null) {
            logger.warn("Se intentó buscar una invitación con ID nulo");
            return null;
        }
        logger.info("Buscando invitación por ID: {}", id);
        return repository.findById(id).orElse(null);
    }

    public InvitationResponse save(CreateInvitationRequest invitationCreation) {
        logger.info("Iniciando proceso de creación de invitación para persona ID: {} y división ID: {}",
                invitationCreation.personId(), invitationCreation.divisionId());

        Person person = personService.findPersonEntityById(invitationCreation.personId());
        if (person == null) {
            logger.error("Error: La persona con ID {} no fue encontrada", invitationCreation.personId());
            throw new BusinessException("Error la persona no se encontro");
        }

        Division division = divisionService.findDivisionEntityById(invitationCreation.divisionId());
        if (division == null) {
            logger.error("Error: La división con ID {} no fue encontrada", invitationCreation.divisionId());
            throw new BusinessException("Error la division no se encontro");
        }

        // La cuenta se busca por la persona: el correo de contacto puede cambiar desde el perfil
        if (userService.findUserByPersonId(person.getId()) != null) {
            logger.warn("Intento de invitar a una persona ya asociada. Email: {}", person.getContactEmail());
            throw new BusinessException("La persona ya se encuentra asociado");
        }

        if (repository.existsByPersonIdAndDivisionId(person, division)) {
            logger.warn("La persona con ID {} ya fue invitada a la división con ID {}", person.getId(),
                    division.getId());
            throw new BusinessException("Esta persona ya fue invitada a la división.");
        }

        String rawValue = tokenService.generateRawValue();
        try {
            emailService.sendInvitation(person, rawValue);
            logger.info("Correo de invitación enviado exitosamente a: {}", person.getContactEmail());
        } catch (MessagingException e) {
            logger.error("Error al enviar el correo de invitación a {}: {}", person.getContactEmail(), e.getMessage(),
                    e);
        }

        Club club = person.getClub();
        IssuedToken issued = tokenService.create(person.getContactEmail(), Duration.ofHours(72), rawValue);

        Invitation invitation = new Invitation();
        invitation.setDivision(division);
        invitation.setPerson(person);
        invitation.setClub(club);
        invitation.setToken(issued.token());

        Invitation savedInvitation = this.repository.save(invitation);
        logger.info("Invitación guardada exitosamente con ID: {}", savedInvitation.getId());

        return InvitationResponse.from(savedInvitation);
    }

    @Transactional(readOnly = true)
    public InvitationValidationResponse validate(InvitationTokenDTO invitationToken) {
        logger.info("Validando token de invitación");
        Token token = tokenService.findUsable(invitationToken.token());

        if (token == null) {
            logger.warn("Token de invitación no encontrado");
            throw new BusinessException("Token no encontrado.");
        }
        if (token.isUsed()) {
            logger.warn("Intento de usar un token de invitación que ya fue utilizado");
            throw new BusinessException("Este enlace ya fue utilizado.");
        }
        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            logger.warn("Intento de usar un token de invitación vencido. Expiró el: {}", token.getExpiresAt());
            throw new BusinessException("Este enlace venció.");
        }

        Invitation invitation = repository.findByTokenHash(token.getHash())
                .orElseThrow(() -> {
                    logger.error("Invitación no encontrada para el hash de token provisto");
                    return new BusinessException("La invitación no existe.");
                });

        Person person = invitation.getPerson();
        Action action;
        // Primero por la persona (el correo de contacto puede cambiar desde el perfil); después por correo
        if (userService.findUserByPersonId(person.getId()) != null) {
            logger.warn("El usuario ya está asociado a esta división");
            throw new BusinessException("Ya estás asociado a esta división.");
        }
        User user = userService.findUserByEmail(person.getContactEmail());

        if (user == null) {
            action = Action.CREATE_ACCOUNT;
            logger.info("Token válido. Acción requerida: Crear cuenta para email {}", person.getContactEmail());
        } else if (isLinked(user, person)) {
            logger.warn("El usuario ya está asociado a esta división");
            throw new BusinessException("Ya estás asociado a esta división.");
        } else {
            action = Action.ACCEPT_LINK;
            logger.info("Token válido. Acción requerida: Aceptar vinculación para usuario existente");
        }

        return new InvitationValidationResponse(
                action,
                person.getId(),
                invitation.getDivision().getId());
    }

    private boolean isLinked(User user, Person person) {
        return user.getPerson() != null
                && Objects.equals(user.getPerson().getId(), person.getId());
    }

    @Transactional(readOnly = true)
    public Invitation findUsableInvitation(String rawValue) {
        logger.info("Buscando invitación usable a partir del token en bruto");
        Token token = tokenService.findUsable(rawValue);
        return repository.findByTokenHash(token.getHash())
                .orElseThrow(() -> {
                    logger.error("No se encontró la invitación para el token proporcionado");
                    return new BusinessException("La invitación no existe.");
                });
    }
}