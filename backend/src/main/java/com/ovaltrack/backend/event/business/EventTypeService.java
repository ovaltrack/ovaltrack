package com.ovaltrack.backend.event.business;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.ovaltrack.backend.event.domain.EventType;
import com.ovaltrack.backend.event.domain.dto.EventDTOMapper;
import com.ovaltrack.backend.event.domain.dto.EventTypeResponseDTO;
import com.ovaltrack.backend.event.repository.EventTypeRepository;
import com.ovaltrack.backend.zone.domain.ZoneRule;

@Service
public class EventTypeService {

	@Autowired 
	private EventTypeRepository eventTypeRepository;

	public Collection<EventTypeResponseDTO> findAllEventTypes() {
		return eventTypeRepository.findByIsActiveTrueOrderByNameAscIdAsc().stream()
				.map(EventDTOMapper::toResponseDTO)
				.toList();
	}

	public EventTypeResponseDTO findEventTypeById(UUID eventTypeId) {
		EventType result = eventTypeRepository.findByIdAndIsActiveTrue(eventTypeId).orElse(null);
		return EventDTOMapper.toResponseDTO(result);
	}

	/** Regla de zona de cada tipo de evento que la declara, incluidos los dados de baja (los eventos viejos los siguen usando). */
	public Map<UUID, ZoneRule> zoneRulesByTypeId() {
		return eventTypeRepository.findAll().stream()
				.filter(type -> type.getZoneRule() != null)
				.collect(Collectors.toMap(EventType::getId, EventType::getZoneRule));
	}

	public EventType findEventTypeEntityById(UUID eventTypeId) {
		return eventTypeRepository.findByIdAndIsActiveTrue(eventTypeId).orElse(null);
	}

}
