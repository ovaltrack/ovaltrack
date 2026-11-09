package com.ovaltrack.backend.division.business;

import java.time.LocalDate;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.division.domain.DivisionCoach;
import com.ovaltrack.backend.division.domain.dto.DivisionDTOMapper;
import com.ovaltrack.backend.division.domain.dto.divisioncoachdto.DivisionCoachCreationDTO;
import com.ovaltrack.backend.division.domain.dto.divisioncoachdto.DivisionCoachResponseDTO;
import com.ovaltrack.backend.division.repository.DivisionCoachRepository;
import com.ovaltrack.backend.person.business.PersonService;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.UserRole;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DivisionCoachService {

    private final DivisionCoachRepository divisionCoachRepository;
    private final DivisionService divisionService;
    private final PersonService personService;
    private final UserService userService;
    private final DivisionSecurityValidator divisionSecurityValidator;

    public Collection<DivisionCoachResponseDTO> findActiveDivisionCoachesByDivisionId(UUID divisionId) {
        return findActiveDivisionCoachesByDivisionId(divisionId, null);
    }

    public Collection<DivisionCoachResponseDTO> findActiveDivisionCoachesByDivisionId(UUID divisionId, Authentication authentication) {
        Division division = divisionService.findDivisionEntityById(divisionId);
        if (division == null) {
            throw new BusinessException("Division no encontrada");
        }
        if (authentication != null) {
            divisionSecurityValidator.validateCanAccessDivision(division, authentication);
        }
        return divisionCoachRepository.findActiveDivisionCoachesByDivisionId(divisionId).stream()
                .map(DivisionDTOMapper::toResponseDTO).toList();
    }

    public DivisionCoachResponseDTO findDivisionCoachById(UUID divisionCoachId) {
        return findDivisionCoachById(divisionCoachId, null);
    }

    public DivisionCoachResponseDTO findDivisionCoachById(UUID divisionCoachId, Authentication authentication) {
        DivisionCoach result = divisionCoachRepository.findById(divisionCoachId).orElse(null);
        if (result != null && authentication != null) {
            divisionSecurityValidator.validateCanAccessDivision(result.getDivision(), authentication);
        }
        return DivisionDTOMapper.toResponseDTO(result);
    }

    /** Divisiones que la persona entrena actualmente. */
    public Set<UUID> findActiveDivisionIdsByCoach(UUID personId) {
        return divisionCoachRepository.findActiveByPersonId(personId).stream()
                .map(dc -> dc.getDivision().getId())
                .collect(Collectors.toSet());
    }

    public DivisionCoach findDivisionCoachEntityById(UUID divisionCoachId) {
        return divisionCoachRepository.findById(divisionCoachId).orElse(null);
    }

    public Collection<DivisionCoachResponseDTO> findDivisionCoachesByDivisionIdAndPersonId(UUID divisionId, UUID personId) {
        return findDivisionCoachesByDivisionIdAndPersonId(divisionId, personId, null);
    }

    public Collection<DivisionCoachResponseDTO> findDivisionCoachesByDivisionIdAndPersonId(UUID divisionId, UUID personId, Authentication authentication) {
        Division division = divisionService.findDivisionEntityById(divisionId);
        if (division == null) {
            throw new BusinessException("Division no encontrada");
        }
        if (authentication != null) {
            divisionSecurityValidator.validateCanAccessDivision(division, authentication);
        }
        return divisionCoachRepository.findDivisionCoachesByDivisionIdAndPersonId(divisionId, personId).stream()
                .map(DivisionDTOMapper::toResponseDTO).toList();
    }

    @Transactional
    public DivisionCoachResponseDTO saveDivisionCoach(DivisionCoachCreationDTO divisionCoachRequest) {
        return saveDivisionCoach(divisionCoachRequest, null);
    }

    @Transactional
    public DivisionCoachResponseDTO saveDivisionCoach(DivisionCoachCreationDTO divisionCoachRequest, Authentication authentication) {
        Division aDivision = divisionService.findDivisionEntityById(divisionCoachRequest.divisionId());
        if (aDivision == null) {
            throw new BusinessException("No se puede asignar un entrenador a una division que no existe");
        }
        if (authentication != null) {
            divisionSecurityValidator.validateCanManageDivisionCoaches(aDivision, authentication);
        }

        Person aPerson = personService.findPersonEntityById(divisionCoachRequest.personId());
        if (aPerson == null) {
            throw new BusinessException("La persona no existe");
        }
        if (divisionCoachRepository.existsActiveAssociation(aDivision.getId(), aPerson.getId())) {
            throw new BusinessException("La persona ya esta asociada como entrenador en esta division");
        }

        if(userService.findUserByPersonId(aPerson.getId()).getRole() != UserRole.COACH_ANALYST) {
            throw new BusinessException("La persona no puede ser asociada porque no es un entrenador/analista");
        }

        DivisionCoach aDivisionCoach = new DivisionCoach();
        aDivisionCoach.setDivision(aDivision);
        aDivisionCoach.setPerson(aPerson);
        aDivisionCoach.setStartDate(LocalDate.now());
        aDivisionCoach.setEndDate(null);

        aDivisionCoach = divisionCoachRepository.save(aDivisionCoach);
        return DivisionDTOMapper.toResponseDTO(aDivisionCoach);
    }

    @Transactional
    public DivisionCoachResponseDTO deleteDivisionCoach(UUID divisionCoachId) {
        return deleteDivisionCoach(divisionCoachId, null);
    }

    @Transactional
    public DivisionCoachResponseDTO deleteDivisionCoach(UUID divisionCoachId, Authentication authentication) {
        DivisionCoach aDivisionCoach = this.findDivisionCoachEntityById(divisionCoachId);

        if (aDivisionCoach == null) {
            throw new BusinessException("No se puede desasociar un entrenador que no existe");
        }
        if (authentication != null) {
            divisionSecurityValidator.validateCanManageDivisionCoaches(aDivisionCoach.getDivision(), authentication);
        }
        if (aDivisionCoach.getEndDate() != null) {
            throw new BusinessException("No se puede desasociar un entrenador que ya no esta asociado a la division");
        }

        aDivisionCoach.setEndDate(LocalDate.now());
        return DivisionDTOMapper.toResponseDTO(aDivisionCoach);
    }

}
