import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, map, of, switchMap, takeUntil, tap } from 'rxjs';
import { MatchService } from '../../services/match.service';
import { Match } from '../../types/match.types';
import { EMPTY_TIME_PLACEHOLDER, formatOnlyTime } from '../utils/match-review.utils';
import { LoadingGate } from '../../../../shared/utils/loading-gate';

export type ShellStatus = 'loading' | 'ready' | 'error';

export interface ShellScore { home: number; away: number; }
export interface ShellScoreDelta { text: string; type: 'OWN' | 'OPPONENT'; }

type LoadResult = { match: Match } | { error: unknown };

/**
 * Partido en análisis, cargado una sola vez para las tres vistas (Eventos, Zonas y Estadísticas).
 * Se provee en el shell: vive lo que dura la visita y no se comparte entre partidos.
 */
@Injectable()
export class PostMatchShellStore {
  private readonly matchService = inject(MatchService);
  private readonly loadRequests = new Subject<string>();
  private readonly refreshRequests = new Subject<string>();

  readonly matchId = signal<string>('');
  readonly match = signal<Match | null>(null);
  readonly status = signal<ShellStatus>('loading');
  readonly errorMessage = signal<string>('');
  /** La pelota aparece solo si la carga del partido tarda (ver LoadingGate). */
  readonly loading = new LoadingGate();

  /**
   * Evento que estaba seleccionado en Eventos al irse a otra vista. Vive en el shell (no en la URL) para que Eventos
   * lo recupere al volver, tanto con el selector de vistas como con Atrás.
   */
  readonly lastSelectedEventId = signal<string | null>(null);

  private readonly liveScore = signal<Signal<ShellScore> | null>(null);
  private readonly liveScoreDelta = signal<Signal<ShellScoreDelta | null> | null>(null);

  /** Marcador del partido; mientras Eventos está activo lo reemplaza por el que calcula con sus eventos. */
  readonly score = computed<ShellScore>(() => {
    const live = this.liveScore();
    if (live) return live();
    const match = this.match();
    return { home: match?.homeScore ?? 0, away: match?.awayScore ?? 0 };
  });

  readonly scoreDelta = computed<ShellScoreDelta | null>(() => this.liveScoreDelta()?.() ?? null);

  readonly startTimeFormatted = computed(() => {
    const startedAt = this.match()?.startedAt;
    return startedAt ? formatOnlyTime(startedAt) : EMPTY_TIME_PLACEHOLDER;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.loading.dispose());
    this.loadRequests.pipe(
      tap(() => {
        this.match.set(null);
        this.errorMessage.set('');
        this.status.set('loading');
        this.loading.start();
      }),
      switchMap(id => this.matchService.getMatchById(id).pipe(
        map((match): LoadResult => ({ match })),
        catchError(error => of<LoadResult>({ error }))
      )),
      takeUntilDestroyed()
    ).subscribe(result => {
      this.loading.finish();
      if ('match' in result) {
        this.match.set(result.match);
        this.status.set('ready');
        return;
      }
      this.errorMessage.set(this.describeError(result.error));
      this.status.set('error');
    });

    // Recarga en segundo plano: switchMap se queda con la última y una carga nueva (otro partido) la cancela
    this.refreshRequests.pipe(
      switchMap(id => this.matchService.getMatchById(id).pipe(
        takeUntil(this.loadRequests),
        catchError(() => EMPTY)
      )),
      takeUntilDestroyed()
    ).subscribe(match => this.match.set(match));
  }

  load(matchId: string): void {
    this.matchId.set(matchId);
    if (!matchId) {
      this.errorMessage.set('No se indicó el partido.');
      this.status.set('error');
      return;
    }
    this.loadRequests.next(matchId);
  }

  /**
   * Vuelve a pedir el partido sin pasar por el estado de carga (la vista no se desmonta). Se usa cuando cambia algo que
   * el servidor recalcula, como el marcador al editar eventos. Si falla, queda el último dato bueno.
   */
  refresh(): void {
    if (this.status() !== 'ready') return;
    this.refreshRequests.next(this.matchId());
  }

  bindLiveScore(score: Signal<ShellScore>, delta: Signal<ShellScoreDelta | null>): void {
    this.liveScore.set(score);
    this.liveScoreDelta.set(delta);
  }

  unbindLiveScore(): void {
    this.liveScore.set(null);
    this.liveScoreDelta.set(null);
  }

  retry(): void {
    this.load(this.matchId());
  }

  private describeError(error: unknown): string {
    const { status, error: body } = (error ?? {}) as { status?: number; error?: { message?: unknown } };
    if (status === 404) return 'No se encontró el partido.';
    return typeof body?.message === 'string' && body.message
      ? body.message
      : 'No se pudo cargar el partido.';
  }
}
