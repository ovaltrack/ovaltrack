package com.ovaltrack.backend.statistic.controller;

import java.time.LocalDate;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ovaltrack.backend.statistic.business.StatisticService;
import com.ovaltrack.backend.statistic.business.advanced.AdvancedStatisticService;
import com.ovaltrack.backend.statistic.business.player.PlayerStatisticService;
import com.ovaltrack.backend.statistic.domain.dto.AdvancedMatchStatisticsDTO;
import com.ovaltrack.backend.statistic.domain.dto.PlayerMatchStatisticsDTO;
import com.ovaltrack.backend.statistic.domain.dto.PlayerStatisticsDTO;
import com.ovaltrack.backend.statistic.domain.dto.DivisionStatisticsDTO;
import com.ovaltrack.backend.statistic.domain.dto.PeriodStatisticDTO;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("statistics")
@Tag(name = "Statistics", description = "Query match and period statistics")
@RequiredArgsConstructor
public class StatisticController {

    private final StatisticService statisticService;
    private final PlayerStatisticService playerStatisticService;
    private final AdvancedStatisticService advancedStatisticService;

    @Operation(
        summary = "Get period statistics for a match",
        description = "Returns calculated statistics for a specific period of a match."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Statistics returned successfully."),
        @ApiResponse(responseCode = "403", description = "The user has no access to the division of the match."),
        @ApiResponse(responseCode = "404", description = "Match not found.")
    })
    @GetMapping("/match/{matchId}")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<PeriodStatisticDTO> getMatchPeriodStatistics(
            @PathVariable UUID matchId,
            @RequestParam(required = false, defaultValue = "1") Integer period,
            Authentication authentication) {
        return ResponseEntity.ok(statisticService.calculatePeriodStatistics(matchId, period, authentication));
    }

    @Operation(
        summary = "Get the second-level statistics of a finished match",
        description = "Returns possessions, try sources, red-zone efficiency, penalties by territory, points by "
            + "10-minute block and yellow-card impact for the first half, the second half and the whole match (period null)."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Statistics returned successfully."),
        @ApiResponse(responseCode = "403", description = "The user has no access to the division of the match."),
        @ApiResponse(responseCode = "404", description = "Match not found."),
        @ApiResponse(responseCode = "409", description = "The match is not finished.")
    })
    @GetMapping("/match/{matchId}/advanced")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<AdvancedMatchStatisticsDTO> getAdvancedMatchStatistics(
            @PathVariable UUID matchId,
            Authentication authentication) {
        return ResponseEntity.ok(advancedStatisticService.calculate(matchId, authentication));
    }

    @Operation(
        summary = "Get statistics of the finished matches of a division",
        description = "Returns the full-match statistics of every FINISHED match of the division whose date is within [from, to]. "
            + "Coaches/analysts only access divisions they are associated with; club admins, divisions of their own club."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Statistics returned successfully."),
        @ApiResponse(responseCode = "400", description = "Invalid date range."),
        @ApiResponse(responseCode = "403", description = "The user has no access to the division."),
        @ApiResponse(responseCode = "404", description = "Division not found.")
    })
    @GetMapping("/division/{divisionId}")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK')")
    public ResponseEntity<DivisionStatisticsDTO> getDivisionStatistics(
            @PathVariable UUID divisionId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Authentication authentication) {
        return ResponseEntity.ok(statisticService.calculateDivisionStatistics(divisionId, from, to, authentication));
    }

    @Operation(
        summary = "Get general statistics of a player",
        description = "Returns the finished matches a player played in a division and season, totals, zone map and "
            + "per-match metrics compared with the squad average of that division in the same season. Without divisionId, "
            + "the division of the latest match; without season, the latest season with matches. A player can only see "
            + "their own statistics; staff, players of divisions they can access."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Statistics returned successfully."),
        @ApiResponse(responseCode = "403", description = "The user cannot see this player or division."),
        @ApiResponse(responseCode = "404", description = "Player not found or not related to the division.")
    })
    @GetMapping("/player/{personId}")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK', 'PLAYER')")
    public ResponseEntity<PlayerStatisticsDTO> getPlayerStatistics(
            @PathVariable UUID personId,
            @RequestParam(required = false) UUID divisionId,
            @RequestParam(required = false) Integer season,
            Authentication authentication) {
        return ResponseEntity.ok(playerStatisticService.playerStatistics(personId, divisionId, season, authentication));
    }

    @Operation(
        summary = "Get the statistics of a player in a match",
        description = "Returns what the player did in a finished match, compared with the average of the match squad."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Statistics returned successfully."),
        @ApiResponse(responseCode = "403", description = "The user cannot see this player or match."),
        @ApiResponse(responseCode = "404", description = "Player or match not found, or the player was not in the squad."),
        @ApiResponse(responseCode = "409", description = "The match is not finished.")
    })
    @GetMapping("/player/{personId}/match/{matchId}")
    @PreAuthorize("hasAnyRole('ADMIN_CLUB', 'COACH_ANALYST', 'ADMIN_OVALTRACK', 'PLAYER')")
    public ResponseEntity<PlayerMatchStatisticsDTO> getPlayerMatchStatistics(
            @PathVariable UUID personId,
            @PathVariable UUID matchId,
            Authentication authentication) {
        return ResponseEntity.ok(playerStatisticService.playerMatchStatistics(personId, matchId, authentication));
    }
}
