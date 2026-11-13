package com.ovaltrack.backend.auth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.person.business.PersonService;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.person.domain.dto.PersonCreationDTO;
import com.ovaltrack.backend.person.domain.dto.PersonResponseDTO;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.UserRole;
import com.ovaltrack.backend.user.domain.UserStatus;
import com.ovaltrack.backend.user.repository.UserRepository;

@Component
public class BootstrapAdminRunner implements ApplicationRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminEmail;
    private final String adminPassword;
    private PersonService personService;

    public BootstrapAdminRunner(
            PersonService personService,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${OVALTRACK_BOOTSTRAP_ADMIN_EMAIL:}") String adminEmail,
            @Value("${OVALTRACK_BOOTSTRAP_ADMIN_PASSWORD:}") String adminPassword) {
        this.personService = personService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = adminEmail.trim();
        this.adminPassword = adminPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (adminEmail.isBlank() && adminPassword.isBlank()) {
            return;
        }
        if (adminEmail.isBlank() || adminPassword.isBlank() || adminPassword.length() < 12) {
            throw new IllegalStateException(
                    "El bootstrap requiere email y contraseña de al menos 12 caracteres configurados por entorno");
        }

        User existingUser = userRepository.findByLoginEmail(adminEmail).orElse(null);
        if (existingUser != null) {
            if (existingUser.getRole() != UserRole.ADMIN_OVALTRACK) {
                throw new IllegalStateException("El email configurado para bootstrap ya pertenece a otro rol");
            }
            return;
        }

        if (userRepository.existsByRole(UserRole.ADMIN_OVALTRACK)) {
            return;
        }
        Person person = new Person();
        person.setContactEmail(adminEmail);
        PersonResponseDTO personResponse = this.personService
                .savePerson(new PersonCreationDTO("administrador", "ovaltrack", null, adminEmail, "0123456789"), null);
        person.setId(personResponse.id());
        person.setFirstName(personResponse.firstName());
        person.setLastName(personResponse.lastName());

        User adminUser = User.builder()
                .loginEmail(adminEmail)
                .passwordHash(passwordEncoder.encode(adminPassword))
                .role(UserRole.ADMIN_OVALTRACK)
                .accountStatus(UserStatus.ACTIVE)
                .active(true)
                .person(person)
                .build();
        userRepository.save(adminUser);
    }
}