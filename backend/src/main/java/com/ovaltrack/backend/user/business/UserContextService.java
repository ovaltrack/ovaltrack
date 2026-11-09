package com.ovaltrack.backend.user.business;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.club.domain.dto.ClubDTOMapper;
import com.ovaltrack.backend.club.repository.ClubRepository;
import com.ovaltrack.backend.common.config.exceptions.EntityNotFoundException;
import com.ovaltrack.backend.division.domain.DivisionCoach;
import com.ovaltrack.backend.division.domain.DivisionPlayer;
import com.ovaltrack.backend.division.domain.dto.DivisionDTOMapper;
import com.ovaltrack.backend.division.domain.dto.divisiondto.DivisionResponseDTO;
import com.ovaltrack.backend.division.repository.DivisionCoachRepository;
import com.ovaltrack.backend.division.repository.DivisionPlayerRepository;
import com.ovaltrack.backend.division.repository.DivisionRepository;
import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.UserRole;
import com.ovaltrack.backend.user.domain.dto.UserContextDTO;
import com.ovaltrack.backend.user.repository.UserRepository;

@Service
public class UserContextService {

    private final UserRepository userRepository;
    private final ClubRepository clubRepository;
    private final DivisionCoachRepository divisionCoachRepository;
    private final DivisionPlayerRepository divisionPlayerRepository;
    private final DivisionRepository divisionRepository;

    public UserContextService(
            UserRepository userRepository,
            ClubRepository clubRepository,
            DivisionCoachRepository divisionCoachRepository,
            DivisionPlayerRepository divisionPlayerRepository,
            DivisionRepository divisionRepository) {
        this.userRepository = userRepository;
        this.clubRepository = clubRepository;
        this.divisionCoachRepository = divisionCoachRepository;
        this.divisionPlayerRepository = divisionPlayerRepository;
        this.divisionRepository = divisionRepository;
    }

    @Transactional(readOnly = true)
    public UserContextDTO getUserContext(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new EntityNotFoundException("No hay una sesión autenticada activa");
        }

        String email = authentication.getName();
        User user = userRepository.findByLoginEmail(email)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado con email: " + email));

        Person person = user.getPerson();
        Club club = resolveClub(user);
        List<DivisionResponseDTO> activeDivisions = resolveDivisions(user, club);

        return new UserContextDTO(
                user.getId(),
                user.getLoginEmail(),
                user.getRole(),
                person != null ? person.getId() : null,
                person != null ? person.getFirstName() : null,
                person != null ? person.getLastName() : null,
                club != null ? ClubDTOMapper.toResponseDTO(club) : null,
                activeDivisions
        );
    }

    /** Club del usuario: el de su persona o, si no tiene, el que administra. */
    @Transactional(readOnly = true)
    public Club resolveClub(User user) {
        Person person = user.getPerson();
        if (person != null && person.getClub() != null) {
            return person.getClub();
        }
        return clubRepository.findByAdminUserId(user.getId()).orElse(null);
    }

    /** Divisiones activas del usuario según su rol (el admin de club ve todas las del club). */
    @Transactional(readOnly = true)
    public List<DivisionResponseDTO> resolveDivisions(User user, Club club) {
        Person person = user.getPerson();
        if (user.getRole() == UserRole.COACH_ANALYST && person != null) {
            return divisionCoachRepository.findActiveByPersonId(person.getId()).stream()
                    .map(DivisionCoach::getDivision)
                    .map(DivisionDTOMapper::toResponseDTO)
                    .toList();
        }
        if (user.getRole() == UserRole.PLAYER && person != null) {
            return divisionPlayerRepository.findActiveByPersonId(person.getId()).stream()
                    .map(DivisionPlayer::getDivision)
                    .map(DivisionDTOMapper::toResponseDTO)
                    .toList();
        }
        if (user.getRole() == UserRole.ADMIN_CLUB && club != null) {
            return divisionRepository.findAllDivisionsByClubId(club.getId()).stream()
                    .map(DivisionDTOMapper::toResponseDTO)
                    .toList();
        }
        return List.of();
    }
}
