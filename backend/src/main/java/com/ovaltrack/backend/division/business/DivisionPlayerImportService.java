package com.ovaltrack.backend.division.business;

import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.division.domain.DivisionPlayer;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerImportRequestDTO;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerImportResultDTO;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerImportRowDTO;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerImportRowResultDTO;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerImportStatus;
import com.ovaltrack.backend.division.repository.DivisionPlayerRepository;
import com.ovaltrack.backend.person.business.PersonService;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.person.domain.dto.PersonCreationDTO;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

/**
 * Alta en lote del plantel de una división desde una planilla.
 * Cada fila se resuelve por separado: se crea, se informa como duplicada o como inválida.
 * Todo se valida antes de crear, así una fila mala no corta (ni revierte) al resto.
 * Con dryRun se hace la misma validación sin crear nada: es la vista previa de la pantalla.
 */
@Service
@RequiredArgsConstructor
public class DivisionPlayerImportService {

    private static final int FIRST_DATA_ROW = 2;
    private static final int MIN_NAME_LENGTH = 2;
    private static final int MAX_TEXT_LENGTH = 255;
    private static final int ADULT_AGE = 18;
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final DivisionService divisionService;
    private final DivisionSecurityValidator divisionSecurityValidator;
    private final PersonService personService;
    private final DivisionPlayerRepository divisionPlayerRepository;

    @Transactional
    public DivisionPlayerImportResultDTO importPlayers(DivisionPlayerImportRequestDTO request, Authentication authentication) {
        Division division = divisionService.findDivisionEntityById(request.divisionId());
        if (division == null) {
            throw new BusinessException("No se puede importar jugadores a una division que no existe");
        }
        divisionSecurityValidator.validateCanManageDivisionPlayers(division, authentication);

        BatchKeys batchKeys = new BatchKeys();
        List<DivisionPlayerImportRowResultDTO> results = new ArrayList<>();
        int imported = 0;

        List<DivisionPlayerImportRowDTO> rows = request.rows();
        for (int index = 0; index < rows.size(); index++) {
            DivisionPlayerImportRowDTO rawRow = rows.get(index);
            int rowNumber = rawRow != null && rawRow.rowNumber() != null ? rawRow.rowNumber() : index + FIRST_DATA_ROW;
            if (rawRow == null) {
                results.add(invalid(rowNumber, null, "La fila está vacía"));
                continue;
            }

            ImportRow row = ImportRow.from(rowNumber, rawRow);
            DivisionPlayerImportRowResultDTO rejection = validate(row);
            if (rejection == null) {
                rejection = findBatchDuplicate(row, batchKeys);
            }
            if (rejection == null) {
                rejection = findExistingPerson(row, division);
            }
            if (rejection != null) {
                results.add(rejection);
                continue;
            }

            batchKeys.remember(row);
            imported++;
            if (request.dryRun()) {
                results.add(new DivisionPlayerImportRowResultDTO(
                        rowNumber, DivisionPlayerImportStatus.READY, null, null, null));
                continue;
            }
            Person person = createPlayer(row, division);
            results.add(new DivisionPlayerImportRowResultDTO(
                    rowNumber, DivisionPlayerImportStatus.IMPORTED, null, null, person.getId()));
        }

        return new DivisionPlayerImportResultDTO(imported, results.size() - imported, results);
    }

    // <==================== Validación de la fila ====================>

    private DivisionPlayerImportRowResultDTO validate(ImportRow row) {
        DivisionPlayerImportRowResultDTO error = validateName(row, "firstName", row.firstName(), "nombre");
        if (error == null) {
            error = validateName(row, "lastName", row.lastName(), "apellido");
        }
        if (error != null) {
            return error;
        }

        if (row.birthDate() == null) {
            return invalid(row.rowNumber(), "birthDate", "La fecha de nacimiento es requerida.");
        }
        if (!row.birthDate().isBefore(LocalDate.now())) {
            return invalid(row.rowNumber(), "birthDate", "La fecha de nacimiento debe ser en el pasado");
        }

        if (row.position() == null) {
            return invalid(row.rowNumber(), "position", "La posicion del jugador es obligatoria");
        }
        if (row.position().length() > MAX_TEXT_LENGTH) {
            return invalid(row.rowNumber(), "position", "La posición no puede superar los 255 caracteres");
        }

        if (row.jerseyNumber() != null && (row.jerseyNumber() < 1 || row.jerseyNumber() > 99)) {
            return invalid(row.rowNumber(), "jerseyNumber", "El dorsal debe estar entre 1 y 99");
        }

        if (row.contactEmail() != null
                && (row.contactEmail().length() > MAX_TEXT_LENGTH || !EMAIL_PATTERN.matcher(row.contactEmail()).matches())) {
            return invalid(row.rowNumber(), "contactEmail", "Formato de email de contacto inválido");
        }
        if (row.contactPhone() != null && row.contactPhone().length() > MAX_TEXT_LENGTH) {
            return invalid(row.rowNumber(), "contactPhone", "El teléfono no puede superar los 255 caracteres");
        }

        boolean isMinor = Period.between(row.birthDate(), LocalDate.now()).getYears() < ADULT_AGE;
        if (isMinor && (row.contactEmail() == null || row.contactPhone() == null)) {
            String missingField = row.contactEmail() == null ? "contactEmail" : "contactPhone";
            return invalid(row.rowNumber(), missingField,
                    "La persona es menor de edad, se requieren metodos de contacto validos.");
        }
        return null;
    }

    private DivisionPlayerImportRowResultDTO validateName(ImportRow row, String field, String value, String label) {
        if (value == null) {
            return invalid(row.rowNumber(), field, "El " + label + " es obligatorio");
        }
        if (value.length() < MIN_NAME_LENGTH) {
            return invalid(row.rowNumber(), field, "El " + label + " debe tener al menos 2 caracteres");
        }
        if (value.length() > MAX_TEXT_LENGTH) {
            return invalid(row.rowNumber(), field, "El " + label + " no puede superar los 255 caracteres");
        }
        return null;
    }

    // <==================== Duplicados ====================>

    private DivisionPlayerImportRowResultDTO findBatchDuplicate(ImportRow row, BatchKeys batchKeys) {
        Integer sameIdentityRow = batchKeys.identities.get(row.identityKey());
        if (sameIdentityRow != null) {
            return duplicate(row.rowNumber(), null, "Repetido en la planilla: es el mismo jugador de la fila " + sameIdentityRow, null);
        }
        Integer sameEmailRow = row.emailKey() == null ? null : batchKeys.emails.get(row.emailKey());
        if (sameEmailRow != null) {
            return duplicate(row.rowNumber(), "contactEmail", "Repetido en la planilla: el correo ya está en la fila " + sameEmailRow, null);
        }
        Integer samePhoneRow = row.contactPhone() == null ? null : batchKeys.phones.get(row.contactPhone());
        if (samePhoneRow != null) {
            return invalid(row.rowNumber(), "contactPhone", "El teléfono ya está en la fila " + samePhoneRow + " de la planilla");
        }
        return null;
    }

    private DivisionPlayerImportRowResultDTO findExistingPerson(ImportRow row, Division division) {
        Club club = division.getClub();
        UUID clubId = club == null ? null : club.getId();

        Person sameIdentity = personService.findClubPersonByNameAndBirthDate(
                clubId, row.firstName(), row.lastName(), row.birthDate());
        if (sameIdentity != null) {
            return duplicate(row.rowNumber(), null, existingPlayerMessage(sameIdentity, division), sameIdentity.getId());
        }

        Person sameEmail = personService.findPersonByContactEmail(row.contactEmail());
        if (sameEmail != null) {
            boolean sameClub = clubId != null && sameEmail.getClub() != null && clubId.equals(sameEmail.getClub().getId());
            // Si el correo es de otro club no se dice de quién es: solo que ya está registrado
            return sameClub
                    ? duplicate(row.rowNumber(), "contactEmail", existingPlayerMessage(sameEmail, division), sameEmail.getId())
                    : invalid(row.rowNumber(), "contactEmail", "Email ya registrado");
        }

        if (row.contactPhone() != null && personService.existsByContactPhone(row.contactPhone())) {
            return invalid(row.rowNumber(), "contactPhone", "Teléfono ya registrado");
        }
        return null;
    }

    private String existingPlayerMessage(Person person, Division division) {
        boolean inDivision = divisionPlayerRepository.existsActiveAssociation(division.getId(), person.getId());
        return "Ya existe en el club: " + person.getFirstName() + " " + person.getLastName()
                + (inDivision ? " (ya está en esta división)" : " (no está en esta división)");
    }

    // <==================== Alta ====================>

    private Person createPlayer(ImportRow row, Division division) {
        Person person = personService.createPerson(new PersonCreationDTO(
                row.firstName(), row.lastName(), row.birthDate(), row.contactEmail(), row.contactPhone()),
                division.getClub());

        divisionPlayerRepository.save(DivisionPlayer.builder()
                .division(division)
                .person(person)
                .jerseyNumber(row.jerseyNumber())
                .position(row.position())
                .startDate(LocalDate.now())
                .endDate(null)
                .build());
        return person;
    }

    private static DivisionPlayerImportRowResultDTO invalid(int rowNumber, String field, String message) {
        return new DivisionPlayerImportRowResultDTO(rowNumber, DivisionPlayerImportStatus.INVALID, field, message, null);
    }

    private static DivisionPlayerImportRowResultDTO duplicate(int rowNumber, String field, String message, UUID personId) {
        return new DivisionPlayerImportRowResultDTO(rowNumber, DivisionPlayerImportStatus.DUPLICATE, field, message, personId);
    }

    /** Fila con los textos recortados y los vacíos convertidos en null. */
    private record ImportRow(
            int rowNumber,
            String firstName,
            String lastName,
            LocalDate birthDate,
            String position,
            Integer jerseyNumber,
            String contactEmail,
            String contactPhone) {

        static ImportRow from(int rowNumber, DivisionPlayerImportRowDTO row) {
            return new ImportRow(rowNumber, clean(row.firstName()), clean(row.lastName()), row.birthDate(),
                    clean(row.position()), row.jerseyNumber(), clean(row.contactEmail()), clean(row.contactPhone()));
        }

        String identityKey() {
            return firstName.toLowerCase(Locale.ROOT) + "|" + lastName.toLowerCase(Locale.ROOT) + "|" + birthDate;
        }

        String emailKey() {
            return contactEmail == null ? null : contactEmail.toLowerCase(Locale.ROOT);
        }

        private static String clean(String value) {
            if (value == null) {
                return null;
            }
            String trimmed = value.trim();
            return trimmed.isEmpty() ? null : trimmed;
        }
    }

    /** Claves de las filas ya aceptadas en este lote (creadas o, en vista previa, listas), con su número de fila. */
    private static final class BatchKeys {
        private final Map<String, Integer> identities = new HashMap<>();
        private final Map<String, Integer> emails = new HashMap<>();
        private final Map<String, Integer> phones = new HashMap<>();

        void remember(ImportRow row) {
            identities.put(row.identityKey(), row.rowNumber());
            if (row.emailKey() != null) {
                emails.put(row.emailKey(), row.rowNumber());
            }
            if (row.contactPhone() != null) {
                phones.put(row.contactPhone(), row.rowNumber());
            }
        }
    }
}
