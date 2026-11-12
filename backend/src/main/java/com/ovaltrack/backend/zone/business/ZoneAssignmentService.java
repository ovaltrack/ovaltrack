package com.ovaltrack.backend.zone.business;

import java.util.List;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.common.config.exceptions.EntityNotFoundException;
import com.ovaltrack.backend.event.repository.EventRepository;
import com.ovaltrack.backend.match.business.MatchSecurityValidator;
import com.ovaltrack.backend.match.business.MatchService;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.domain.dto.MatchZonesResponseDTO;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentCreationDTO;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentMapper;
import com.ovaltrack.backend.zone.domain.dto.ZoneAssignmentResponseDTO;
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;

import lombok.RequiredArgsConstructor;

/** Orquesta el CRUD de asignaciones de zona: delega las reglas en el validator y los cálculos en el calculator. */
@Service
@RequiredArgsConstructor
public class ZoneAssignmentService {

    private final MatchService matchService;
    private final MatchSecurityValidator matchSecurityValidator;
    private final ZoneAssignmentRepository zoneAssignmentRepository;
    private final EventRepository eventRepository;
    private final ZoneAssignmentValidator validator;
    private final ZoneSummaryCalculator summaryCalculator;
    private final EventZoneRuleValidator ruleValidator;

    @Transactional(readOnly = true)
    public MatchZonesResponseDTO findByMatch(UUID matchId, Authentication authentication) {
        Match match = findManageableMatch(matchId, authentication);
        List<ZoneAssignment> assignments = zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(match.getId());

        return new MatchZonesResponseDTO(
                assignments.stream().map(ZoneAssignmentMapper::toResponseDTO).toList(),
                summaryCalculator.calculate(eventRepository.findEventsByMatchId(match.getId()), assignments));
    }

    @Transactional
    public ZoneAssignmentResponseDTO create(UUID matchId, ZoneAssignmentCreationDTO request, Authentication authentication) {
        Match match = findManageableMatch(matchId, authentication);
        validator.validateMatchEditable(match);
        validator.validate(request, existingAssignments(matchId), null);
        ruleValidator.validateAssignment(request, eventRepository.findPostMatchEventsByMatchId(matchId));

        ZoneAssignment zone = new ZoneAssignment();
        zone.setMatch(match);
        ZoneAssignmentMapper.applyTo(zone, request);

        return ZoneAssignmentMapper.toResponseDTO(zoneAssignmentRepository.save(zone));
    }

    @Transactional
    public ZoneAssignmentResponseDTO update(UUID matchId, UUID zoneId, ZoneAssignmentCreationDTO request, Authentication authentication) {
        Match match = findManageableMatch(matchId, authentication);
        validator.validateMatchEditable(match);
        ZoneAssignment zone = findZone(matchId, zoneId);
        validator.validate(request, existingAssignments(matchId), zoneId);
        ruleValidator.validateAssignment(request, eventRepository.findPostMatchEventsByMatchId(matchId));

        ZoneAssignmentMapper.applyTo(zone, request);

        return ZoneAssignmentMapper.toResponseDTO(zoneAssignmentRepository.save(zone));
    }

    @Transactional
    public void delete(UUID matchId, UUID zoneId, Authentication authentication) {
        Match match = findManageableMatch(matchId, authentication);
        validator.validateMatchEditable(match);

        zoneAssignmentRepository.delete(findZone(matchId, zoneId));
    }

    private Match findManageableMatch(UUID matchId, Authentication authentication) {
        Match match = matchService.findMatchEntityById(matchId);
        if (match == null) {
            throw new EntityNotFoundException("Partido no encontrado");
        }
        matchSecurityValidator.validateCanManageMatch(match, authentication);
        return match;
    }

    private ZoneAssignment findZone(UUID matchId, UUID zoneId) {
        return zoneAssignmentRepository.findByIdAndMatchId(zoneId, matchId)
                .orElseThrow(() -> new EntityNotFoundException("Zona no encontrada"));
    }

    private List<ZoneAssignment> existingAssignments(UUID matchId) {
        return zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId);
    }
}
