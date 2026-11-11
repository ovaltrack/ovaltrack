import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { SyncManagerService } from './core/synchronization/SyncManagerService';
import { BackendHealthService } from './core/services/backend-health.service';
import { LayoutService } from './core/services/layout.service';
import { NavbarModeService } from './core/navigation/navbar-mode.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, ToastContainerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  readonly layout = inject(LayoutService);
  readonly navbarMode = inject(NavbarModeService);

  constructor() {
    inject(SyncManagerService); //Synchronization service
    inject(BackendHealthService); //Ping service to keep Render backend awake. Doesn't work if no one is using the app
  }
}
