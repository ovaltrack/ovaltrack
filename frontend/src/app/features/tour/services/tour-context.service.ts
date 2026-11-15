import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { TokenService } from '../../../core/services/token.service';
import { UserContextService } from '../../../core/services/user-context.service';
import { MatchService } from '../../match/services/match.service';
import { Match } from '../../match/types/match.types';
import { TourContext } from '../types/tour.types';
import { pickTourContext } from '../utils/tour-context';

/** Arma el contexto de la guía con los datos reales del club de la sesión. */
@Injectable({ providedIn: 'root' })
export class TourContextService {
  private readonly userContext = inject(UserContextService);
  private readonly matchService = inject(MatchService);
  private readonly tokenService = inject(TokenService);

  async load(): Promise<TourContext> {
    const payload = this.tokenService.getPayload();
    // Recién logueado el contexto en memoria puede ser de la sesión anterior.
    const cached = this.userContext.userContext();
    const context = cached && cached.userId === payload?.userId
      ? cached
      : await firstValueFrom(this.userContext.loadUserContext().pipe(catchError(() => of(null))));
    const clubId = context?.club?.id ?? null;
    const divisionId = context?.activeDivisions?.[0]?.id ?? null;
    const matches: Match[] = clubId
      ? await firstValueFrom(this.matchService.getMatchesByClub(clubId).pipe(catchError(() => of<Match[]>([]))))
      : [];
    return pickTourContext(matches, divisionId, Date.now());
  }
}
