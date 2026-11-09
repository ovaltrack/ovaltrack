package com.ovaltrack.backend.auth.service;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.mail.service.EmailService;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.token.domain.Token;
import com.ovaltrack.backend.token.domain.TokenPurpose;
import com.ovaltrack.backend.token.service.TokenService;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;

import lombok.RequiredArgsConstructor;

/**
 * Recupero de contraseña con un enlace de un solo uso, como las invitaciones:
 * se guarda el hash del token con vencimiento y el correo de acceso de la cuenta.
 */
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    public static final Duration LINK_TTL = Duration.ofHours(1);
    public static final String REQUEST_ACCEPTED_MESSAGE = "Solicitud enviada correctamente";
    public static final String INVALID_LINK_MESSAGE = "El enlace no es válido o ya venció. Pedí uno nuevo.";
    public static final String PASSWORD_CHANGED_MESSAGE = "Tu contraseña quedó actualizada. Iniciá sesión con la nueva.";

    private static final Logger logger = LoggerFactory.getLogger(PasswordResetService.class);

    private final UserService userService;
    private final TokenService tokenService;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    /**
     * Si el correo es de una cuenta, anula los enlaces anteriores y envía uno nuevo.
     * Nunca revela si la cuenta existe ni si el correo falló: el controller responde siempre igual.
     */
    @Transactional
    public void request(String email) {
        User user = userService.findUserByEmail(email.trim());
        if (user == null) {
            logger.info("Recupero pedido para un correo sin cuenta");
            return;
        }
        String loginEmail = user.getLoginEmail();
        tokenService.revokeActive(loginEmail, TokenPurpose.PASSWORD_RESET);
        String rawValue = tokenService.generateRawValue();
        tokenService.create(loginEmail, LINK_TTL, rawValue, TokenPurpose.PASSWORD_RESET);
        try {
            emailService.sendPasswordReset(loginEmail, displayName(user), rawValue, "1 hora");
            logger.info("Enlace de recupero enviado a la cuenta {}", user.getId());
        } catch (Exception e) {
            // El enlace queda creado; se loguea y la respuesta sigue siendo la misma
            logger.error("No se pudo enviar el correo de recupero a la cuenta {}: {}", user.getId(), e.getMessage());
        }
    }

    /** Confirma que el enlace sirve antes de mostrar el formulario; devuelve el correo de acceso. */
    @Transactional(readOnly = true)
    public String validate(String rawToken) {
        return findAccount(rawToken).getLoginEmail();
    }

    /** Cambia la contraseña, consume el enlace y cierra las sesiones abiertas de la cuenta. */
    @Transactional
    public void reset(String rawToken, String newPassword) {
        User user = findAccount(rawToken);
        if (!tokenService.consume(rawToken, TokenPurpose.PASSWORD_RESET)) {
            throw new BusinessException(INVALID_LINK_MESSAGE);
        }
        user.changePassword(passwordEncoder.encode(newPassword));
        userService.saveUser(user);
        logger.info("Contraseña restablecida para la cuenta {}", user.getId());
    }

    /** Cuenta dueña de un enlace vigente; si el correo de acceso cambió después, el enlace ya no sirve. */
    private User findAccount(String rawToken) {
        Token token = tokenService.findActive(rawToken, TokenPurpose.PASSWORD_RESET);
        if (token == null) {
            throw new BusinessException(INVALID_LINK_MESSAGE);
        }
        User user = userService.findUserByEmail(token.getEmail());
        if (user == null) {
            throw new BusinessException(INVALID_LINK_MESSAGE);
        }
        return user;
    }

    private static String displayName(User user) {
        Person person = user.getPerson();
        if (person == null || person.getFirstName() == null) {
            return user.getLoginEmail();
        }
        return person.getFirstName();
    }
}
