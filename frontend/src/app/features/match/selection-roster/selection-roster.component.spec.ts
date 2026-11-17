import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { SelectionRosterComponent } from './selection-roster.component';
import { RosterService } from '../services/roster.service';
import { ToastService } from 'src/app/core/services/toast.service';

describe('SelectionRosterComponent', () => {
  let component: SelectionRosterComponent;
  let fixture: ComponentFixture<SelectionRosterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectionRosterComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? 'match-123' : null),
              },
            },
          },
        },
        {
          provide: Router,
          useValue: { navigate: () => Promise.resolve(true) },
        },
        {
          provide: RosterService,
          useValue: {
            getRosterBootstrap: () => of({
              match: {
                id: 'match-123',
                opponent: { id: 'opponent-1', name: 'Rival FC', alias: 'RFC', city: null },
                date: '2026-10-03'
              },
              players: [],
              roster: { startingPlayers: [], substitutePlayers: [] },
            }),
            saveRoster: () => of(undefined),
          },
        },
        {
          provide: ToastService,
          useValue: {
            success: () => '1',
            error: () => '2',
            warning: () => '3',
            info: () => '4',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectionRosterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('carga el plantel con una sola llamada y deja de mostrar el skeleton', () => {
    expect(component.isLoading()).toBeFalse();
    expect(component.loadError()).toBeFalse();
    expect(component.opponentName()).toBe('Rival FC');
  });

  it('marca como duplicada la casilla cuyo dorsal ya existe una vez validado', () => {
    component.updateSlotNumber(0, 7);
    component.updateSlotNumber(1, 7);
    expect(component.duplicateSlotIndex()).toBeNull();

    component.finishSlotNumberEdit(1);
    expect(component.duplicateSlotIndex()).toBe(1);
  });

  it('selecciona la casilla con Enter solo cuando la tecla se pulsa sobre la casilla', () => {
    const slot = document.createElement('div');
    const input = document.createElement('input');
    slot.appendChild(input);
    component.activeSlotIndex.set(null);

    const fromInput = new KeyboardEvent('keydown', { key: 'Enter' });
    Object.defineProperty(fromInput, 'target', { value: input });
    Object.defineProperty(fromInput, 'currentTarget', { value: slot });
    component.onSlotKeydown(fromInput, 3);
    expect(component.activeSlotIndex()).toBeNull();

    const fromSlot = new KeyboardEvent('keydown', { key: 'Enter' });
    Object.defineProperty(fromSlot, 'target', { value: slot });
    Object.defineProperty(fromSlot, 'currentTarget', { value: slot });
    component.onSlotKeydown(fromSlot, 3);
    expect(component.activeSlotIndex()).toBe(3);
  });
});
