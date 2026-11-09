package com.ovaltrack.backend.user.business;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.config.exceptions.EntityNotFoundException;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.person.repository.PersonRepository;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.dto.ChangeLoginEmailRequest;
import com.ovaltrack.backend.user.domain.dto.UpdateContactRequest;
import com.ovaltrack.backend.user.domain.dto.UserProfileDTO;
import com.ovaltrack.backend.user.domain.dto.UserProfileDTO.AccountData;
import com.ovaltrack.backend.user.domain.dto.UserProfileDTO.ClubData;
import com.ovaltrack.backend.user.domain.dto.UserProfileDTO.PersonData;
import com.ovaltrack.backend.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/** Perfil del usuario autenticado: lectura y edición de sus datos de contacto. */
@Service
@RequiredArgsConstructor
public class UserProfileService {

    static final String NO_PERSON_MESSAGE = "Tu cuenta no tiene datos personales para editar.";
    static final String EMAIL_TAKEN_MESSAGE = "El correo de contacto ya lo usa otra persona.";
    static final String WRONG_PASSWORD_MESSAGE = "La contraseña actual no es correcta.";
    static final String SAME_LOGIN_EMAIL_MESSAGE = "El correo nuevo es igual al actual.";
    static final String LOGIN_EMAIL_TAKEN_MESSAGE = "Ese correo ya lo usa otra cuenta o persona.";

    private final UserRepository userRepository;
    private final PersonRepository personRepository;
    private final UserContextService userContextService;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public UserProfileDTO getProfile(String loginEmail) {
        return toProfile(findUser(loginEmail));
    }

    @Transactional
    public UserProfileDTO updateContact(String loginEmail, UpdateContactRequest request) {
        User user = findUser(loginEmail);
        Person person = user.getPerson();
        if (person == null) {
            throw new BusinessException(NO_PERSON_MESSAGE);
        }

        String contactEmail = request.contactEmail().trim();
        boolean takenByPerson = personRepository.existsByContactEmailIgnoreCaseAndIdNot(contactEmail, person.getId());
        boolean takenByAccount = userRepository.existsByLoginEmailIgnoreCaseAndIdNot(contactEmail, user.getId());
        if (takenByPerson || takenByAccount) {
            throw new BusinessException(EMAIL_TAKEN_MESSAGE);
        }

        String phone = request.contactPhone() == null ? null : request.contactPhone().trim();
        person.setContactEmail(contactEmail);
        person.setContactPhone(phone == null || phone.isEmpty() ? null : phone);
        personRepository.save(person);
        return toProfile(user);
    }

    /**
     * Cambia el correo de acceso después de verificar la contraseña. Si el correo de contacto era
     * el mismo, pasa también al nuevo. Los tokens emitidos para el correo anterior dejan de servir.
     */
    @Transactional
    public void changeLoginEmail(String loginEmail, ChangeLoginEmailRequest request) {
        User user = findUser(loginEmail);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BusinessException(WRONG_PASSWORD_MESSAGE);
        }

        String newEmail = request.newEmail().trim();
        String oldEmail = user.getLoginEmail();
        if (newEmail.equalsIgnoreCase(oldEmail)) {
            throw new BusinessException(SAME_LOGIN_EMAIL_MESSAGE);
        }

        Person person = user.getPerson();
        boolean takenByAccount = userRepository.existsByLoginEmailIgnoreCaseAndIdNot(newEmail, user.getId());
        // Otra persona con ese contacto podría invitarse y vincularse a esta cuenta: no se permite
        boolean takenByPerson = person == null
                ? personRepository.existsByContactEmailIgnoreCase(newEmail)
                : personRepository.existsByContactEmailIgnoreCaseAndIdNot(newEmail, person.getId());
        if (takenByAccount || takenByPerson) {
            throw new BusinessException(LOGIN_EMAIL_TAKEN_MESSAGE);
        }

        user.setLoginEmail(newEmail);
        userRepository.save(user);
        if (person != null && oldEmail.equalsIgnoreCase(person.getContactEmail())) {
            person.setContactEmail(newEmail);
            personRepository.save(person);
        }
    }

    private User findUser(String loginEmail) {
        return userRepository.findByLoginEmail(loginEmail)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado"));
    }

    private UserProfileDTO toProfile(User user) {
        Club club = userContextService.resolveClub(user);
        return new UserProfileDTO(
                toAccount(user),
                toPerson(user.getPerson()),
                toClub(club),
                userContextService.resolveDivisions(user, club));
    }

    private static AccountData toAccount(User user) {
        return new AccountData(user.getId(), user.getLoginEmail(), user.getRole(), user.getAccountStatus(),
                user.getCreatedAt(), user.getTermsVersion(), user.getTermsAcceptedAt());
    }

    private static PersonData toPerson(Person person) {
        if (person == null) return null;
        return new PersonData(person.getId(), person.getFirstName(), person.getLastName(), person.getBirthDate(),
                person.getContactEmail(), person.getContactPhone());
    }

    private static ClubData toClub(Club club) {
        if (club == null) return null;
        return new ClubData(club.getId(), club.getName(), club.getCity(), club.getLogoUrl(), club.getStatus(),
                club.getContactEmail(), club.getContactPhone(), adminName(club.getAdminUser()));
    }

    private static String adminName(User admin) {
        if (admin == null || admin.getPerson() == null) return null;
        return admin.getPerson().getFirstName() + " " + admin.getPerson().getLastName();
    }
}
