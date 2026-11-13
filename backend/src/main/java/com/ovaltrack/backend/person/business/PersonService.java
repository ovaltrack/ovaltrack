package com.ovaltrack.backend.person.business;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.person.domain.dto.PersonCreationDTO;
import com.ovaltrack.backend.person.domain.dto.PersonDTOMapper;
import com.ovaltrack.backend.person.domain.dto.PersonResponseDTO;
import com.ovaltrack.backend.person.domain.dto.PersonUpdateDTO;
import com.ovaltrack.backend.person.repository.PersonRepository;
import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.club.business.ClubService;
import jakarta.transaction.Transactional;
import org.springframework.security.core.Authentication;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.UUID;

@Service
public class PersonService {

    private final PersonRepository personRepository;
    private final ClubService clubService;
    private final PersonSecurityValidator personSecurityValidator;

    public PersonService(PersonRepository personRepository, ClubService clubService,
                         PersonSecurityValidator personSecurityValidator) {
        this.personRepository = personRepository;
        this.clubService = clubService;
        this.personSecurityValidator = personSecurityValidator;
    }

    public Collection<PersonResponseDTO> findAllPersons() {
        return personRepository.findAll().stream()
                .map(PersonDTOMapper::toResponseDTO)
                .toList();
    }

    public Page<PersonResponseDTO> findPaginatedInactivePlayersByClubAndDivision(UUID clubId, UUID divisionId, int page, int size) {
        return personRepository.findPaginatedInactivePlayersByClubAndDivision(clubId, divisionId,PageRequest.of(page, size))
                .map(PersonDTOMapper::toResponseDTO);
    }
    public Page<PersonResponseDTO> findAllPlayersByDivision(UUID divisionId, int page, int size) {
        return personRepository.findAllPlayersByDivision( divisionId,PageRequest.of(page, size))
                .map(PersonDTOMapper::toResponseDTO);
    }

    public PersonResponseDTO findPersonById(UUID personId) {
        return PersonDTOMapper.toResponseDTO(findPersonEntityById(personId));
    }

    public Person findPersonEntityById(UUID personId) {
        if (personId == null) {
            return null;
        }
        return personRepository.findById(personId).orElse(null);
    }

    @Transactional
    public PersonResponseDTO savePerson(PersonCreationDTO request, Authentication authentication) {
        if (request.contactEmail() != null && !request.contactEmail().isBlank()
                && personRepository.existsByContactEmail(request.contactEmail())) {
            throw new BusinessException("El email de contacto ya se encuentra registrado");
        }

        Person person = PersonDTOMapper.toEntity(request);
        person.setClub(clubService.findClubEntityForAuthenticatedUser(authentication));
        person = personRepository.save(person);
        return PersonDTOMapper.toResponseDTO(person);
    }

    public boolean existsByContactEmail(String contactEmail) {
        if (contactEmail == null || contactEmail.isBlank()) {
            return false;
        }
        return personRepository.existsByContactEmailIgnoreCase(contactEmail.trim());
    }

    public boolean existsByContactPhone(String contactPhone) {
        if (contactPhone == null || contactPhone.isBlank()) {
            return false;
        }
        return personRepository.existsByContactPhone(contactPhone.trim());
    }

    @Transactional
    public Person savePersonEntity(Person person) {
        return personRepository.save(person);
    }

    @Transactional
    public Person createPerson(PersonCreationDTO request, Club club) {
        if (request == null || request.firstName() == null || request.firstName().trim().isEmpty() ||
            request.lastName() == null || request.lastName().trim().isEmpty()) {
            throw new BusinessException("Debe seleccionar una persona existente o ingresar nombre y apellido para crear una nueva");
        }

        if (request.contactEmail() != null && !request.contactEmail().trim().isBlank()) {
            String email = request.contactEmail().trim();
            if (existsByContactEmail(email)) {
                throw new BusinessException("Email ya registrado");
            }
        }

        if (request.contactPhone() != null && !request.contactPhone().trim().isBlank()) {
            String phone = request.contactPhone().trim();
            if (existsByContactPhone(phone)) {
                throw new BusinessException("Teléfono ya registrado");
            }
        }

        Person person = Person.builder()
                .firstName(request.firstName().trim())
                .lastName(request.lastName().trim())
                .birthDate(request.birthDate())
                .contactEmail(request.contactEmail() != null && !request.contactEmail().trim().isBlank() ? request.contactEmail().trim() : null)
                .contactPhone(request.contactPhone() != null && !request.contactPhone().trim().isBlank() ? request.contactPhone().trim() : null)
                .club(club)
                .build();

        return personRepository.save(person);
    }

    @Transactional
    public Person createPersonFromRegistration(String firstName, String lastName, java.time.LocalDate birthDate, String email, java.util.UUID clubId) {
        Person person = Person.builder()
                .firstName(firstName)
                .lastName(lastName)
                .birthDate(birthDate)
                .contactEmail(email)
                .build();

        if (clubId != null) {
            Club club = clubService.findClubEntityById(clubId);
            person.setClub(club);
        }

        return personRepository.save(person);
    }

    @Transactional
    public PersonResponseDTO updatePerson(UUID personId, PersonUpdateDTO request, Authentication authentication) {
        Person person = findPersonEntityById(personId);
        if (person == null) {
            throw new BusinessException("Persona no encontrada");
        }
        personSecurityValidator.validateCanEditPerson(person, authentication);

        if (request.contactEmail() != null && !request.contactEmail().isBlank()
                && !request.contactEmail().equalsIgnoreCase(person.getContactEmail())
                && personRepository.existsByContactEmail(request.contactEmail())) {
            throw new BusinessException("El email de contacto ya está registrado por otra persona");
        }

        person.setFirstName(request.firstName());
        person.setLastName(request.lastName());
        person.setBirthDate(request.birthDate());
        person.setContactEmail(request.contactEmail());
        person.setContactPhone(request.contactPhone());

        person = personRepository.save(person);
        return PersonDTOMapper.toResponseDTO(person);
    }

    @Transactional
    public void deletePerson(UUID personId) {
        if (!personRepository.existsById(personId)) {
            throw new BusinessException("Persona no encontrada");
        }
        personRepository.deleteById(personId);
    }
}
