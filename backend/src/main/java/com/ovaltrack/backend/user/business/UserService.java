package com.ovaltrack.backend.user.business;

import java.util.Collection;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.ovaltrack.backend.club.domain.Club;
import com.ovaltrack.backend.club.domain.dto.ClubDTOMapper;
import com.ovaltrack.backend.club.domain.dto.ClubResponseDTO;
import com.ovaltrack.backend.club.repository.ClubRepository;
import com.ovaltrack.backend.user.domain.User;
import com.ovaltrack.backend.user.repository.UserRepository;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.config.exceptions.EntityNotFoundException;
import com.ovaltrack.backend.user.domain.UserRole;
import com.ovaltrack.backend.user.domain.UserStatus;
import com.ovaltrack.backend.user.domain.dto.UserDTOMapper;
import com.ovaltrack.backend.user.domain.dto.UserResponseDTO;
import org.springframework.security.core.Authentication;

import jakarta.transaction.Transactional;

import com.ovaltrack.backend.person.domain.Person;
import com.ovaltrack.backend.person.repository.PersonRepository;
import com.ovaltrack.backend.user.domain.dto.UserClubRegistration;
import com.ovaltrack.backend.user.domain.dto.UserCreateRequestDTO;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
public class UserService {

	private final UserRepository userRepository;
	private final ClubRepository clubRepository;
	private final PersonRepository personRepository;
	private final PasswordEncoder passwordEncoder;
	private final UserPermissionValidator userPermissionValidator;

	public UserService(UserRepository userRepository,
			ClubRepository clubRepository,
			PersonRepository personRepository,
			PasswordEncoder passwordEncoder,
			UserPermissionValidator userPermissionValidator) {
		this.userRepository = userRepository;
		this.clubRepository = clubRepository;
		this.personRepository = personRepository;
		this.passwordEncoder = passwordEncoder;
		this.userPermissionValidator = userPermissionValidator;
	}

	public Collection<User> findAllUsers() {
		return userRepository.findAll();
	}

	public Collection<UserResponseDTO> findAllUsersDTO() {
		return userRepository.findAll().stream()
				.map(UserDTOMapper::toResponseDTO)
				.toList();
	}

	public Collection<UserResponseDTO> findActiveUsersDTO() {
		return userRepository.findAllByActiveTrueOrderByCreatedAtDesc().stream()
				.map(UserDTOMapper::toResponseDTO)
				.toList();
	}

	public Collection<UserResponseDTO> findUsersByClubId(UUID clubId) {
		return userRepository.findAllByClubId(clubId).stream()
				.filter(user -> user.getRole() != UserRole.ADMIN_OVALTRACK)
				.map(UserDTOMapper::toResponseDTO)
				.toList();
	}

	public User findUserById(UUID userId) {
		return userRepository.findById(userId).orElse(null);
	}

	public User findUserByPersonId(UUID personId) {
		return userRepository.findByPersonId(personId).orElse(null);
	}

	public User findUserByEmail(String email) {
		return userRepository.findByLoginEmail(email).orElse(null);
	}

	public Collection<UserResponseDTO> findAllUsersExceptAdminOvaltrack() {
		return userRepository.findByRoleNot(UserRole.ADMIN_OVALTRACK).stream()
				.map(UserDTOMapper::toResponseDTO)
				.toList();
	}

	public Collection<UserResponseDTO> findAllByAccountStatus(UserStatus status) {
		return userRepository.findAllByAccountStatus(status)
				.stream()
				.map(UserDTOMapper::toResponseDTO)
				.toList();
	}

	public Collection<UserResponseDTO> findAllByActive(boolean active) {
		return userRepository.findAllByActive(active)
				.stream()
				.map(UserDTOMapper::toResponseDTO)
				.toList();
	}

	public Collection<UserClubRegistration> findAllClubRegistrationsByStatusAndActive(UserStatus status,Boolean active) {
		// 1. Llamamos al repositorio que nos trae los Object[] (u, c)
		Collection<Object[]> results = userRepository.findUserWithAssociatedClubByStatusAndActive(status,active);
		// 2. Mapeamos cada fila usando los mappers correspondientes
		return results.stream()
				.map(row -> {
					User userEntity = (User) row[0];
					Club clubEntity = (Club) row[1];

					// Mapeo usando los métodos estáticos o de instancia de tus mappers
					UserResponseDTO userDto = UserDTOMapper.toResponseDTO(userEntity);
					ClubResponseDTO clubDto = ClubDTOMapper.toResponseDTO(clubEntity);

					// Retornamos tu estructura UserClubRegistration que agrupa ambos DTOs
					return new UserClubRegistration(userDto, clubDto);
				})
				.collect(Collectors.toList());
	}

	public boolean existsByEmail(String email) {
		return userRepository.existsByLoginEmail(email);
	}

	@Transactional
	public User saveUser(User user) {
		return userRepository.save(user);
	}

	@Transactional
	public UserResponseDTO createUser(UserCreateRequestDTO request) {
		if (request.role() == UserRole.ADMIN_OVALTRACK) {
			throw new BusinessException("ADMIN_OVALTRACK solo puede crearse mediante el bootstrap controlado");
		}

		String email = request.getEffectiveEmail();
		if (email == null || email.isBlank()) {
			throw new BusinessException("El email es obligatorio");
		}
		if (userRepository.existsByLoginEmail(email)) {
			throw new BusinessException("El email ya se encuentra registrado");
		}

		Person person = buildPerson(request, email);
		User user = buildUser(request, person, email);

		User saved = userRepository.save(user);
		return UserDTOMapper.toResponseDTO(saved);
	}

	private Person buildPerson(UserCreateRequestDTO request, String email) {
		if (request.personId() != null) {
			Person existing = personRepository.findById(request.personId()).orElse(null);
			if (existing != null) {
				return existing;
			}
		}

		Club club = request.clubId() != null ? clubRepository.findById(request.clubId()).orElse(null) : null;

		Person person = Person.builder()
				.firstName(request.firstName() != null ? request.firstName() : "")
				.lastName(request.lastName() != null ? request.lastName() : "")
				.birthDate(request.birthDate())
				.contactEmail(email)
				.club(club)
				.build();

		return personRepository.save(person);
	}

	private User buildUser(UserCreateRequestDTO request, Person person, String email) {
		String encodedPassword = (request.password() != null && !request.password().isBlank())
				? passwordEncoder.encode(request.password())
				: passwordEncoder.encode("Default123!");

		boolean active = request.active() == null || request.active();
		return User.builder()
				.person(person)
				.loginEmail(email)
				.passwordHash(encodedPassword)
				.role(request.role() != null ? request.role() : UserRole.NO_ROLE)
				.active(active)
				// Alta directa: si nace activa ya está aprobada (antes quedaba PENDING_APPROVAL por defecto)
				.accountStatus(active ? UserStatus.ACTIVE : UserStatus.PENDING_APPROVAL)
				.build();
	}

	@Transactional
	public void deleteUser(UUID userId) {
		userRepository.deleteById(userId);
	}

	@Transactional
	public UserResponseDTO updateUserRole(UUID userId, UserRole newRole, Authentication authentication) {
		if (newRole == null)
			throw new BusinessException("El rol es obligatorio");

		User user = userRepository.findById(userId)
				.orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado"));

		if (user.isDeactivated()) {
			throw new BusinessException("No se puede modificar el rol de un usuario dado de baja");
		}

		userPermissionValidator.validateCanAssignRole(user, newRole, authentication);

		user.setRole(newRole);
		User savedUser = userRepository.save(user);
		return UserDTOMapper.toResponseDTO(savedUser);
	}

	@Transactional
	public UserResponseDTO activateUser(UUID userId, Authentication authentication) {
		User user = userRepository.findById(userId)
				.orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado"));

		if (!user.isDeactivated()) {
			throw new BusinessException("El usuario ya se encuentra dado de alta");
		}

		userPermissionValidator.validateCanDeactivate(user, authentication);

		user.activate();
		User savedUser = userRepository.save(user);
		return UserDTOMapper.toResponseDTO(savedUser);
	}
	@Transactional
	public UserResponseDTO deactivateUser(UUID userId, Authentication authentication) {
		User user = userRepository.findById(userId)
				.orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado"));

		if (user.isDeactivated()) {
			throw new BusinessException("El usuario ya se encuentra dado de baja");
		}

		userPermissionValidator.validateCanDeactivate(user, authentication);

		user.deactivate();
		User savedUser = userRepository.save(user);
		return UserDTOMapper.toResponseDTO(savedUser);
	}
}
