import { Component, DestroyRef, computed, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Data, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { UserContextService } from 'src/app/core/services/user-context.service';
import { PostMatchHeaderComponent } from './components/post-match-header/post-match-header.component';
import { RugbyBallLoaderComponent } from '../../../shared/components/rugby-ball-loader/rugby-ball-loader.component';
import { PostMatchDataStore } from './store/post-match-data.store';
import { PostMatchShellStore } from './store/post-match-shell.store';

/**
 * Contenedor de las vistas de análisis post-partido (Eventos, Zonas y Estadísticas):
 * carga el partido una sola vez (y los datos que comparten las vistas, ver PostMatchDataStore), pinta el encabezado común y muestra la vista hija cuando está listo.
 * Las vistas con `data.lockViewport` (Eventos) ocupan exactamente el alto de la ventana.
 */
@Component({
  selector: 'app-post-match-shell',
  standalone: true,
  imports: [RouterOutlet, PostMatchHeaderComponent, RugbyBallLoaderComponent],
  providers: [PostMatchShellStore, PostMatchDataStore],
  templateUrl: './post-match-shell.component.html',
  styleUrl: './post-match-shell.component.css'
})
export class PostMatchShellComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly userContext = inject(UserContextService);
  private readonly documentTitle = inject(Title);
  readonly store = inject(PostMatchShellStore);
  private readonly dataStore = inject(PostMatchDataStore);

  readonly ownClubName = computed(() => this.userContext.currentClub()?.name || 'Mi Club');

  readonly lockViewport = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.activeViewData()['lockViewport'] === true)
    ),
    { initialValue: false }
  );

  constructor() {
    const previousTitle = this.documentTitle.getTitle();
    inject(DestroyRef).onDestroy(() => this.documentTitle.setTitle(previousTitle));
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
      takeUntilDestroyed()
    ).subscribe(() => {
      const viewTitle = this.activeViewData()['viewTitle'];
      if (typeof viewTitle === 'string') {
        this.documentTitle.setTitle(`${viewTitle} · Post-partido · OvalTrack`);
      }
    });

    this.route.paramMap.pipe(
      map(params => params.get('id') ?? ''),
      takeUntilDestroyed()
    ).subscribe(id => {
      this.store.load(id);
      this.dataStore.load(id);
    });
  }

  goBack(): void {
    this.router.navigate(['/match-selection']);
  }

  /** Datos de la ruta hija activa (la más profunda del árbol de rutas). */
  private activeViewData(): Data {
    let active = this.router.routerState.snapshot.root;
    while (active.firstChild) {
      active = active.firstChild;
    }
    return active.data;
  }
}
