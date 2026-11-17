package com.ovaltrack.backend.event.business;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ovaltrack.backend.common.config.exceptions.BusinessException;
import com.ovaltrack.backend.event.domain.EventPossession;
import com.ovaltrack.backend.event.domain.dto.event.MatchCoverageDTO;
import com.ovaltrack.backend.event.repository.EventRepository;
import com.ovaltrack.backend.event.repository.MatchCoverageCount;
import com.ovaltrack.backend.match.business.MatchSecurityValidator;
import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.match.repository.MatchRepository;

import lombok.RequiredArgsConstructor;

/**
 * % de análisis de varios partidos en una consulta agregada, para el Inicio: evita descargar la línea de eventos
 * completa de cada partido solo para contar las jugadas sin jugador.
 */
@Service
@RequiredArgsConstructor
public class EventCoverageService {

    static final int MAX_MATCHES = 50;

    private final MatchRepository matchRepository;
    private final EventRepository eventRepository;
    private final MatchSecurityValidator matchSecurityValidator;

    /** Una entrada por partido pedido, en el mismo orden; cada partido pasa por el mismo control de acceso que post-partido. */
    @Transactional(readOnly = true)
    public List<MatchCoverageDTO> coverage(Collection<UUID> matchIds, Authentication authentication) {
        List<UUID> ids = matchIds.stream().distinct().toList();
        if (ids.size() > MAX_MATCHES) {
            throw new BusinessException("Se puede consultar la cobertura de hasta " + MAX_MATCHES + " partidos por pedido");
        }
        List<Match> matches = matchRepository.findAllById(ids);
        if (matches.size() != ids.size()) {
            throw new BusinessException("Partido no encontrado");
        }
        // El acceso a un partido depende solo de su división (y el club de esta): se valida un partido por división.
        Set<UUID> checkedDivisions = new HashSet<>();
        matches.stream()
                .filter(match -> checkedDivisions.add(match.getDivision() == null ? null : match.getDivision().getId()))
                .forEach(match -> matchSecurityValidator.validateCanManageMatch(match, authentication));

        Map<UUID, MatchCoverageCount> counts = eventRepository.countCoverageByMatchIds(ids, EventPossession.OPPONENT).stream()
                .collect(Collectors.toMap(MatchCoverageCount::getMatchId, Function.identity()));
        return ids.stream()
                .map(id -> {
                    MatchCoverageCount count = counts.get(id);
                    return count == null
                            ? MatchCoverageDTO.of(id, 0, 0)
                            : MatchCoverageDTO.of(id, count.getTotalEvents(), count.getWithoutPlayer());
                })
                .toList();
    }
}
