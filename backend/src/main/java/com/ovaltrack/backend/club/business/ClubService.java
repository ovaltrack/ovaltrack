package com.ovaltrack.backend.club.business;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.club.domain.ClubStatus;
import com.ovaltrack.backend.club.domain.dto.ClubCreationDTO;
import com.ovaltrack.backend.club.domain.dto.ClubDTOMapper;
import com.ovaltrack.backend.club.domain.dto.ClubResponseDTO;
import com.ovaltrack.backend.club.domain.dto.ClubRegistrationOptionDTO;
import com.ovaltrack.backend.club.domain.dto.ClubUpdateDTO;
import com.ovaltrack.backend.club.repository.ClubRepository;
import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;

import io.jsonwebtoken.lang.Collections;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ClubService {

    private final ClubRepository clubRepository;
    private final UserService userService;

    public Collection<ClubResponseDTO> findAllClubs() {
        return clubRepository.findAll().stream().map(ClubDTOMapper::toResponseDTO).toList();
    }

    public Collection<ClubResponseDTO> findAllActives() {
        List<Club> clubsActives = clubRepository.findAllByStatus(ClubStatus.ACTIVE);

        return clubsActives.stream().map(ClubDTOMapper::toResponseDTO).toList();
    }

    public Collection<ClubRegistrationOptionDTO> findRegistrationOptions() {
        return clubRepository.findAll().stream()
                .filter(club -> club.getStatus() == ClubStatus.ACTIVE)
                .map(club -> new ClubRegistrationOptionDTO(club.getId(), club.getName(), club.getCity()))
                .toList();
    }

    public ClubResponseDTO findClubById(UUID clubId) {
        return ClubDTOMapper.toResponseDTO(clubRepository.findById(clubId).orElse(null));
    }

    public Collection<ClubResponseDTO> findClubByStatus(ClubStatus status) {
        return clubRepository.findAllByStatus(status).stream().map(ClubDTOMapper::toResponseDTO).toList();
    }

    public Collection<ClubResponseDTO> search(String term) {
        if (term == null || term.isBlank())
            return Collections.emptyList();
        return clubRepository.search("%" + term.toUpperCase() + "%").stream().map(ClubDTOMapper::toResponseDTO)
                .toList();
    }

    @Transactional
    public ClubResponseDTO saveClub(ClubCreationDTO aClubRequest) {
        Club aClub = new Club();
        User anUser = userService.findUserById(aClubRequest.adminUserId());
        if (anUser == null) {
            throw new BusinessException("No se puede crear un club sin asignarle un usuario admin");
        }
        aClub.setName(aClubRequest.name());
        aClub.setAdminUser(anUser);
        aClub.setCity(aClubRequest.city());
        aClub.setLogoUrl(aClubRequest.logoUrl());
        aClub.setContactEmail(aClubRequest.contactEmail());
        aClub.setContactPhone(aClubRequest.contactPhone());

        aClub.setStatus(ClubStatus.ACTIVE);

        aClub = clubRepository.save(aClub);
        return ClubDTOMapper.toResponseDTO(aClub);
    }

    @Transactional
    public Club save(Club aClub) {
        if (aClub == null)
            throw new BusinessException("El club vino nulo!");
        return clubRepository.save(aClub);
    }

    @Transactional
    public ClubResponseDTO updateClub(UUID clubId, ClubUpdateDTO request) {
        Club club = clubRepository.findById(clubId).orElse(null);
        if (club == null) {
            throw new BusinessException("Club no encontrado");
        }

        club.setName(request.name());
        club.setCity(request.city());
        club.setLogoUrl(request.logoUrl());
        club.setContactEmail(request.contactEmail());
        club.setContactPhone(request.contactPhone());

        return ClubDTOMapper.toResponseDTO(clubRepository.save(club));
    }

    @Transactional
    public void deleteClub(UUID clubId) {
        if (findClubById(clubId) == null) {
            throw new BusinessException("Club no encontrado");
        }
        clubRepository.deleteById(clubId);
    }

    public boolean existsByAdminUserId(UUID userId) {
        return clubRepository.existsByAdminUserId(userId);
    }

    public ClubResponseDTO findClubByAdminUserId(UUID adminUserId) {
        return ClubDTOMapper.toResponseDTO(clubRepository.findByAdminUserId(adminUserId).orElse(null));
    }

    public ClubResponseDTO findClubForAuthenticatedUser(
            org.springframework.security.core.Authentication authentication) {
        Club club = findClubEntityForAuthenticatedUser(authentication);
        if (club == null) {
            throw new BusinessException("No se encontró un club asociado al usuario autenticado");
        }
        return ClubDTOMapper.toResponseDTO(club);
    }

    public Collection<com.ovaltrack.backend.user.domain.dto.UserResponseDTO> findMembersForAuthenticatedClub(
            org.springframework.security.core.Authentication authentication) {
        Club club = findClubEntityForAuthenticatedUser(authentication);
        if (club == null) {
            throw new BusinessException("No se encontró un club asociado al usuario autenticado");
        }
        return userService.findUsersByClubId(club.getId());
    }

    public Club findClubEntityById(UUID clubId) {
        return clubRepository.findById(clubId).orElse(null);
    }

    public Club findClubEntityForAuthenticatedUser(org.springframework.security.core.Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        User user = userService.findUserByEmail(authentication.getName());
        return user == null ? null : findClubEntityForUser(user);
    }

    /** Igual que findClubEntityForAuthenticatedUser, para quien ya resolvio el usuario y evita buscarlo otra vez. */
    public Club findClubEntityForUser(User user) {
        if (user.getPerson() != null && user.getPerson().getClub() != null) {
            return user.getPerson().getClub();
        }

        return clubRepository.findByAdminUserLoginEmail(user.getLoginEmail())
                .orElseGet(() -> clubRepository.findByAdminUserId(user.getId()).orElse(null));
    }
}
