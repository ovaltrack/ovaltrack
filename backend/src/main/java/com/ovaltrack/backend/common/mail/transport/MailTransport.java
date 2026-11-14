package com.ovaltrack.backend.common.mail.transport;

import com.ovaltrack.backend.common.mail.dto.OutgoingMail;

public interface MailTransport {
    void send(OutgoingMail mail);
}
