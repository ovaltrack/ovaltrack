package com.ovaltrack.backend.match.domain.dto;

import com.ovaltrack.backend.match.domain.Match;
import com.ovaltrack.backend.match.domain.MatchPlayer;

public final class MatchDTOMapper {

    private MatchDTOMapper() {
    }

    public static MatchResponseDTO toResponseDTO(Match match) {
        if (match == null) {
            return null;
        }

        return new MatchResponseDTO(
                match.getId(),
                match.getDate(),
                match.getDivision() == null ? null : match.getDivision().getId(),
                match.getOpponent() == null ? null : new OpponentDTO(
                        match.getOpponent().getId(),
                        match.getOpponent().getName(),
                        match.getOpponent().getAlias(),
                        match.getOpponent().getCity()
                ),
                match.getStatus(),
                match.getCurrentPeriod() != null ? match.getCurrentPeriod() : 1,
                match.getClockElapsedSeconds() != null ? match.getClockElapsedSeconds() : 0,
                match.getClockPaused() != null ? match.getClockPaused() : true,
                match.getClockUpdatedAt(),
                match.getCurrentPossession(),
                match.getHomeScore() != null ? match.getHomeScore() : 0,
                match.getAwayScore() != null ? match.getAwayScore() : 0,
                match.getStartedAt(),
                match.getFinishedAt());
    }

    public static PlayerMatchResponseDTO toPlayerMatchResponseDTO(MatchPlayer mp) {
        if(mp == null) return null;
        return new PlayerMatchResponseDTO(
            mp.getMatch().getId(),
            mp.getMatch().getDate(),
            mp.getMatch().getOpponent().getAlias(),
            mp.getMatch().getDivision().getName(),
            mp.getMatch().getHomeScore(),
            mp.getMatch().getAwayScore(),
            mp.getRole(),
            mp.getNumber(),
            mp.getMatch().getFinishedAt()
        );
    }
}