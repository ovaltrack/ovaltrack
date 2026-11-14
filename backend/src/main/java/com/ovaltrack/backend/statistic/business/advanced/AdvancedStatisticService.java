package com.ovaltrack.backend.statistic.business.advanced;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.common.config.exceptions.EntityNotFoundException;
import com.ovaltrack.backend.division.business.DivisionSecurityValidator;
import com.ovaltrack.backend.event.domain.Event;
import com.ovaltrack.backend.event.repository.EventRepository;
import com.ovaltrack.backend.match.business.MatchService;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.match.domain.MatchStatus;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedMatchStatisticsDTO;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedPeriodStatisticsDTO;
import com.ovaltrack.backend.zone.business.ZoneGrid;
import com.ovaltrack.backend.zone.domain.ZoneAssignment;
import com.ovaltrack.backend.zone.repository.ZoneAssignmentRepository;

import lombok.RequiredArgsConstructor;

/** Estadísticas de segundo nivel del post-partido: mismo acceso que las estadísticas del partido, solo FINISHED. */
@Service
@RequiredArgsConstructor
public class AdvancedStatisticService {

    private final MatchService matchService;
    private final EventRepository eventRepository;
    private final ZoneAssignmentRepository zoneAssignmentRepository;
    private final DivisionSecurityValidator divisionSecurityValidator;
    private final AdvancedStatisticsCalculator calculator;

    @Transactional(readOnly = true)
    public AdvancedMatchStatisticsDTO calculate(UUID matchId, Authentication authentication) {
        Match match = matchService.findMatchEntityById(matchId);
        if (match == null) {
            throw new EntityNotFoundException("Partido no encontrado");
        }
        if (match.getDivision() == null) {
            throw new AccessDeniedException("Acceso denegado: el partido no pertenece a una división");
        }
        divisionSecurityValidator.validateCanAccessDivision(match.getDivision(), authentication);
        if (match.getStatus() != MatchStatus.FINISHED) {
            throw new BusinessException("Las estadísticas avanzadas solo están disponibles con el partido finalizado");
        }

        Collection<Event> events = eventRepository.findEventsByMatchId(matchId);
        List<ZoneAssignment> assignments = zoneAssignmentRepository.findByMatchIdOrderByPeriodAscStartMinuteAsc(matchId);

        List<AdvancedPeriodStatisticsDTO> periods = new ArrayList<>();
        for (int period = 1; period <= ZoneGrid.PERIODS; period++) {
            periods.add(calculator.calculate(events, assignments, period));
        }
        periods.add(calculator.calculate(events, assignments, null));
        return new AdvancedMatchStatisticsDTO(match.getId(), periods);
    }
}
