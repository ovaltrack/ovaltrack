package com.ovaltrack.backend.common.mail.transport;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.ovaltrack.backend.common.mail.dto.OutgoingMail;

/** No envía nada: solo loguea destinatario y asunto. Para desarrollo sin credenciales ({@code provider=log}). */
@Component
@ConditionalOnProperty(prefix = "ovaltrack.mail", name = "provider", havingValue = "log")
public class LogMailTransport implements MailTransport {

    private static final Logger logger = LoggerFactory.getLogger(LogMailTransport.class);

    @Override
    public void send(OutgoingMail mail) {
        logger.info("[mail:log] Para {} — asunto «{}» ({} caracteres de HTML, no se envió)",
                mail.to(), mail.subject(), mail.html() == null ? 0 : mail.html().length());
    }
}
