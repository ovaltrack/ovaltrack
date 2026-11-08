package com.ovaltrack.backend.admin.service;

import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ovaltrack.backend.club.business.ClubService;
import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.club.domain.ClubStatus;
import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.person.business.PersonService;
import com.ovaltrack.backend.user.business.UserService;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.domain.UserRole;
import com.ovaltrack.backend.user.domain.UserStatus;

import jakarta.transaction.Transactional;

@Service
public class AdminService {
    private final UserService userService;
    private final ClubService clubService;

    public AdminService(
            UserService userService,
            ClubService clubService,
            PersonService personService) {
        this.userService = userService;
        this.clubService = clubService;
    }

    /* ---------- Clubes ---------- */
    @Transactional
    public void approveClub(UUID clubId, UUID adminUserId) {

        Club club = clubService.findClubEntityById(clubId);
        if (club == null)
            throw new BusinessException("El club no existe");

        User admin = userService.findUserById(adminUserId);
        if (admin == null)
            throw new BusinessException("El administrador no exite!");
        if (admin.isDeactivated())
            throw new BusinessException("El administrador debe estar dado de alta para dar de alta el club");

        club.setAdminUser(admin);
        club.setStatus(ClubStatus.ACTIVE);
        clubService.save(club);
    }

    @Transactional
    public void rejectClub(UUID clubId) {
        Club club = clubService.findClubEntityById(clubId);
        if (club == null)
            throw new BusinessException("El club no existe");
        club.setStatus(ClubStatus.REJECTED);
        clubService.save(club);
    }

    /**
     * Vuelve a ACTIVE un club REJECTED (solicitud rechazada o club desactivado).
     * Su administrador tiene que estar activo, igual que al aprobarlo.
     */
    @Transactional
    public void reactivateClub(UUID clubId) {
        Club club = clubService.findClubEntityById(clubId);
        if (club == null)
            throw new BusinessException("El club no existe");
        if (club.getStatus() != ClubStatus.REJECTED)
            throw new BusinessException("Solo se puede reactivar un club inactivo");
        User admin = club.getAdminUser();
        if (admin == null || admin.isDeactivated())
            throw new BusinessException("El administrador del club debe estar activo para reactivarlo");
        club.setStatus(ClubStatus.ACTIVE);
        clubService.save(club);
    }

    /* ---------- Users ---------- */
    @Transactional
    public void approveAccount(UUID userId) {

        User user = userService.findUserById(userId);
        if (user == null)
            throw new BusinessException("El usuario no existe");
        user.activate();
        user.setRole(UserRole.ADMIN_CLUB);
        userService.saveUser(user);
    }

    @Transactional
    public void rejectAccount(UUID userId) {

        User user = userService.findUserById(userId);
        if (user == null)
            throw new BusinessException("El usuario no existe");
        user.setActive(false);
        user.setAccountStatus(UserStatus.REJECTED);
        user.setRole(UserRole.NO_ROLE);
        userService.saveUser(user);
    }

    public void activateAccount(UUID id) {
        if (id == null)
            throw new BusinessException("El id de la cuenta no puede ser nulo");
        User user = userService.findUserById(id);
        if (user == null) {
            throw new BusinessException("El usuario no existe");
        }
        user.activate();
        userService.saveUser(user);
    }

    public void deactivateAccount(UUID id) {
        if (id == null)
            throw new BusinessException("El id de la cuenta no puede ser nulo");
        User user = userService.findUserById(id);
        if (user == null) {
            throw new BusinessException("El usuario no existe");
        }
        user.deactivate();
        userService.saveUser(user);
    }
}
