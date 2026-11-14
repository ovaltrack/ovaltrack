package com.ovaltrack.backend.common.mail.dto;

public record OutgoingMail(
    String to,
    String toName,
    String subject,
    String html
) {

}
