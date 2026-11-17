package com.ovaltrack.backend.event.repository;

import java.util.UUID;

import java.util.Collection;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ovaltrack.backend.event.domain.EventType;

public interface EventTypeRepository extends JpaRepository<EventType, UUID> {

	Collection<EventType> findByIsActiveTrueOrderByNameAscIdAsc();

	java.util.Optional<EventType> findByIdAndIsActiveTrue(UUID id);

	/** Solo los tipos que declaran regla de zona (activos o dados de baja), sin leer el catálogo completo. */
	Collection<EventType> findByZoneRuleIsNotNull();
}
