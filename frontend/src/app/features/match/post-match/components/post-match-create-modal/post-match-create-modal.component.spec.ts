import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { EventService } from '../../../services/event.service';
import { LiveCaptureEventType } from '../../../types/event-type.types';
import { BackendEventResponse } from '../../../types/live-capture.types';
import { MatchReviewStore } from '../../store/match-review.store';
import { PostMatchCreateModalComponent } from './post-match-create-modal.component';

describe('PostMatchCreateModalComponent: evento siguiente del catálogo', () => {
  const type = (overrides: Partial<LiveCaptureEventType>): LiveCaptureEventType => ({
    id: 'type', name: 'Evento', groupName: 'Ataque', category: 'ATTACK', isScoring: false, points: 0,
    requiresPlayer: false, isActive: true, code: 'EVENTO', showInPalette: true, followUpEventTypeId: null,
    actor: 'ATTACKING', possessionAfter: 'KEEP', followUpChoices: [], templateEventFields: [],
    createdAt: '2026-09-14T12:00:00Z', ...overrides
  });

  const conversion = type({ id: 'conversion', code: 'CONVERSION', name: 'Conversión', possessionAfter: 'OTHER' });
  const tryType = type({ id: 'try', code: 'TRY', name: 'Try', followUpEventTypeId: 'conversion' });
  const kick = type({ id: 'kick', code: 'PENALTY_KICK', name: 'Kick H' });
  const touch = type({ id: 'touch', code: 'KICK_TO_TOUCH', name: 'Patada al touch' });
  const penalty = type({
    id: 'penalty', code: 'PENALTY_CONCEDED', name: 'Penal / Infracción', actor: 'CHOOSE', possessionAfter: 'OTHER',
    followUpChoices: [{ code: 'PENALTY_KICK' }, { code: 'KICK_TO_TOUCH' }]
  });
  const tackle = type({ id: 'tackle', code: 'TACKLE_MADE', name: 'Tackle' });

  let component: PostMatchCreateModalComponent;
  let closed: number;
  let created: number;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PostMatchCreateModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EventService, useValue: { create: () => of({ id: 'e1' } as BackendEventResponse) } }
      ]
    });
    TestBed.inject(MatchReviewStore).setEventTypesList([conversion, tryType, kick, touch, penalty, tackle]);
    component = TestBed.createComponent(PostMatchCreateModalComponent).componentInstance;
    closed = 0;
    created = 0;
    component.close.subscribe(() => closed++);
    component.created.subscribe(() => created++);
  });

  function saveAt(eventTypeId: string, possession: 'OWN' | 'OPPONENT', minute: number, second: number): void {
    component.eventTypeId = eventTypeId;
    component.possession = possession;
    component.period = 1;
    component.minute = minute;
    component.second = second;
    component.save();
  }

  it('Try: el formulario queda con la Conversión del mismo equipo y el mismo tiempo', () => {
    saveAt('try', 'OWN', 22, 30);

    expect(created).toBe(1);
    expect(closed).toBe(0);
    expect(component.isFollowUp()).toBe(true);
    expect(component.eventTypeId).toBe('conversion');
    expect(component.possession).toBe('OWN');
    expect(component.minute).toBe(22);
    expect(component.second).toBe(30);
    expect(component.closeLabel).toBe('Omitir');
    expect(component.prefillHints()?.time).toBe('Sigue a Try · 22:30');
  });

  it('Penal: pide elegir entre las opciones del catálogo y después precarga la elegida', () => {
    saveAt('penalty', 'OWN', 10, 0);

    expect(closed).toBe(0);
    expect(component.nextChoices()?.map(choice => choice.label)).toEqual(['Kick H', 'Patada al touch']);
    expect(component.closeLabel).toBe('Nada más');

    component.prefillNext(component.nextChoices()![0]);

    expect(component.nextChoices()).toBe(null);
    expect(component.eventTypeId).toBe('kick');
    expect(component.possession).toBe('OPPONENT');
  });

  it('un tipo sin seguimiento cierra el modal como antes', () => {
    saveAt('tackle', 'OWN', 5, 0);

    expect(created).toBe(1);
    expect(closed).toBe(1);
    expect(component.isFollowUp()).toBe(false);
    expect(component.nextChoices()).toBe(null);
  });

  it('el evento propuesto se encadena: guardar la Conversión (sin seguimiento) cierra', () => {
    saveAt('try', 'OWN', 22, 30);
    component.save();

    expect(created).toBe(2);
    expect(closed).toBe(1);
  });
});
