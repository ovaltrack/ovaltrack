package com.ovaltrack.backend.division.domain.dto;

import com.ovaltrack.backend.division.domain.Division;
import com.ovaltrack.backend.division.domain.DivisionCoach;
import com.ovaltrack.backend.division.domain.DivisionPlayer;
import com.ovaltrack.backend.division.domain.dto.divisioncoachdto.DivisionCoachResponseDTO;
import com.ovaltrack.backend.division.domain.dto.divisiondto.DivisionResponseDTO;
import com.ovaltrack.backend.division.domain.dto.divisionplayerdto.DivisionPlayerResponseDTO;

public final class DivisionDTOMapper {

	/**
	 * Static function to map a Division entity to a DTO
	 */
	public static DivisionResponseDTO toResponseDTO(Division division) {
		if (division == null) {
			return null;
		}

		return new DivisionResponseDTO(
				division.getId(),
				division.getName(),
				division.getClub().getId(),
				division.getCreatedAt(),
				division.getAgeCategory(),
				division.getGender(),
				division.getActive());
	}

	public static DivisionPlayerResponseDTO toResponseDTO(DivisionPlayer player) {
		if (player == null)
			return null;
		return new DivisionPlayerResponseDTO(
				player.getId(),
				player.getPerson().getId(),
				player.getDivision().getId(),
				player.getJerseyNumber(),
				player.getPosition(),
				player.getStartDate(),
				player.getEndDate(),
				player.getPerson().getFirstName(),
				player.getPerson().getLastName(),
				player.getPerson().getContactEmail(),
				player.getPerson().getContactPhone());
	}

	public static DivisionCoachResponseDTO toResponseDTO(DivisionCoach coach) {
		if (coach == null)
			return null;
		return new DivisionCoachResponseDTO(
				coach.getId(),
				coach.getPerson().getId(),
				coach.getDivision().getId(),
				coach.getStartDate(),
				coach.getEndDate(),
				coach.getPerson().getFirstName(),
				coach.getPerson().getLastName(),
				coach.getPerson().getContactEmail(),
				coach.getPerson().getContactPhone());
	}

}
