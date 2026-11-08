package com.ovaltrack.backend.member.dto.bussines;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.member.dto.MemberResponseDTO;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.person.repository.PersonRepository;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.repository.UserRepository;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final PersonRepository personRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<MemberResponseDTO> getClubMembers(UUID clubId) {
        List<Person> persons = personRepository.findAllByClubId(clubId);

        Map<UUID, User> usersByPersonId = userRepository.findAll().stream()
            .filter(u -> u.getPerson() != null && u.getPerson().getId() != null)
            .collect(Collectors.toMap(
                u -> u.getPerson().getId(),
                u -> u,
                (existing, replacement) -> existing
            ));

        return persons.stream().map(person -> {
            User user = usersByPersonId.get(person.getId());
            boolean hasAccount = (user != null);

            return new MemberResponseDTO(
                hasAccount ? user.getId() : null,
                person.getId(),
                person.getFirstName(),
                person.getLastName(),
                hasAccount ? user.getLoginEmail() : person.getContactEmail(),
                hasAccount ? user.getLoginEmail() : null,
                hasAccount ? user.getRole().name() : "PLAYER",
                hasAccount ? user.getActive() : true,
                person.getBirthDate(),
                person.getContactPhone()
            );
        }).collect(Collectors.toList());
    }
}