import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RosterService } from '../services/roster.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { Match } from '../types/match.types';
import { AvailablePlayer, RosterEntry, RosterPayload, RosterSlot, RosterStep, SavedRoster } from '../types/roster.types';
import { createInitialStartingSlots, createInitialSubstituteSlots } from '../data/match.constants';

@Component({
  selector: 'ot-selection-roster',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './selection-roster.component.html',
  styleUrl: './selection-roster.component.css'
})
export class SelectionRosterComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rosterService = inject(RosterService);
  private readonly toastService = inject(ToastService);

  readonly matchId = signal<string>('');
  readonly match = signal<Match | null>(null);
  readonly currentStep = signal<RosterStep>('titulares');

  readonly startingSlots = signal<RosterSlot[]>(createInitialStartingSlots());
  readonly substituteSlots = signal<RosterSlot[]>(createInitialSubstituteSlots());
  readonly availablePlayers = signal<AvailablePlayer[]>([]);

  readonly activeSlotIndex = signal<number | null>(null);
  readonly searchTerm = signal<string>('');
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  readonly validatedDuplicateSlotIndex = signal<number | null>(null);

  // Computeds
  readonly startingAssignedCount = computed(() =>
    this.startingSlots().filter(slot => slot.player !== null).length
  );

  readonly substituteAssignedCount = computed(() =>
    this.substituteSlots().filter(slot => slot.player !== null).length
  );

  readonly isStartingComplete = computed(() =>
    this.startingAssignedCount() === 15
  );

  readonly hasInvalidNumbers = computed(() => {
    const assigned = [...this.startingSlots(), ...this.substituteSlots()]
      .filter(slot => slot.player !== null);
    const numbers = assigned.map(slot => slot.matchNumber);
    return numbers.some(number => number === null || !Number.isInteger(number) || number <= 0)
      || new Set(numbers).size !== numbers.length;
  });

  readonly isRosterLocked = computed(() => {
    const status = this.match()?.status;
    return status === 'in_progress' || status === 'halftime' || status === 'finished' || status === 'cancelled';
  });

  readonly currentSlots = computed(() =>
    this.currentStep() === 'titulares' ? this.startingSlots() : this.substituteSlots()
  );

  readonly assignedPlayerMap = computed(() => {
    const map = new Map<string, number>();
    this.startingSlots().forEach(slot => {
      if (slot.player && slot.matchNumber !== null) map.set(slot.player.id, slot.matchNumber);
    });
    this.substituteSlots().forEach(slot => {
      if (slot.player && slot.matchNumber !== null) map.set(slot.player.id, slot.matchNumber);
    });
    return map;
  });

  readonly filteredAvailablePlayers = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const players = this.availablePlayers();
    if (!query) return players;
    return players.filter(p =>
      p.fullName.toLowerCase().includes(query) ||
      (p.position && p.position.toLowerCase().includes(query)) ||
      (p.jerseyNumber !== null && p.jerseyNumber.toString().includes(query))
    );
  });

  readonly opponentName = computed(() => this.match()?.opponent.name || 'Rival');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.matchId.set(id);
    if (id) {
      this.loadAllData(id);
    } else {
      this.toastService.error('Identificador de partido no válido');
      this.router.navigate(['/match-selection']);
    }
  }

  loadAllData(matchId: string): void {
    this.isLoading.set(true);

    this.rosterService.getRosterBootstrap(matchId).subscribe({
      next: ({ match, players, roster }) => {
        this.match.set(match);
        this.availablePlayers.set(players);
        this.applySavedRoster(roster, players);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar datos del plantel:', err);
        this.toastService.error('No se pudo cargar la información del partido o jugadores.');
        this.isLoading.set(false);
      }
    });
  }

  private applySavedRoster(savedRoster: SavedRoster, players: AvailablePlayer[]): void {
    const starting = createInitialStartingSlots();
    const subs = createInitialSubstituteSlots();

    this.fillSlots(starting, savedRoster.startingPlayers, players);
    this.fillSlots(subs, savedRoster.substitutePlayers, players);

    this.startingSlots.set(starting);
    this.substituteSlots.set(subs);

    // Auto-seleccionar primer puesto libre
    const firstEmptyStarting = starting.findIndex(s => s.player === null);
    if (firstEmptyStarting !== -1) {
      this.currentStep.set('titulares');
      this.activeSlotIndex.set(firstEmptyStarting);
    } else {
      const firstEmptySub = subs.findIndex(s => s.player === null);
      if (firstEmptySub !== -1) {
        this.currentStep.set('suplentes');
        this.activeSlotIndex.set(firstEmptySub);
      }
    }
  }

  private fillSlots(slots: RosterSlot[], entries: RosterEntry[], players: AvailablePlayer[]): void {
    entries.forEach(entry => {
      const player = players.find(p => p.id === entry.playerId);
      const target = entry.slotOrder != null ? slots[entry.slotOrder] : undefined;
      if (player && target) {
        target.player = player;
        target.matchNumber = entry.number;
      }
    });
  }

  setStep(step: RosterStep): void {
    this.currentStep.set(step);
    this.validatedDuplicateSlotIndex.set(null);
    const slots = step === 'titulares' ? this.startingSlots() : this.substituteSlots();
    this.autoSelectFirstEmptySlot(step, slots);
  }

  private autoSelectFirstEmptySlot(step: RosterStep, slots: RosterSlot[]): void {
    const firstEmpty = slots.findIndex(s => s.player === null);
    this.activeSlotIndex.set(firstEmpty !== -1 ? firstEmpty : null);
  }

  selectSlot(index: number): void {
    if (this.activeSlotIndex() === index) {
      this.activeSlotIndex.set(null);
    } else {
      this.activeSlotIndex.set(index);
    }
  }

  selectAvailablePlayer(player: AvailablePlayer): void {
    if (this.isPlayerAssigned(player.id)) {
      const assignedSlot = this.assignedPlayerMap().get(player.id);
      this.toastService.info(`${player.fullName} ya está asignado en el número #${assignedSlot}`);
      return;
    }

    const currentStep = this.currentStep();
    let targetIndex = this.activeSlotIndex();
    const slots = currentStep === 'titulares' ? [...this.startingSlots()] : [...this.substituteSlots()];

    if (targetIndex === null || !slots[targetIndex]) {
      targetIndex = slots.findIndex(s => s.player === null);
    }

    if (targetIndex === -1 || !slots[targetIndex]) {
      this.toastService.warning(
        currentStep === 'titulares'
          ? 'Todos los puestos titulares están ocupados. Toca una casilla específica para reemplazar.'
          : 'Todos los puestos suplentes están ocupados.'
      );
      return;
    }

    // 1. Asignar jugador a la casilla seleccionada
    const assignedNumber = slots[targetIndex].number;
    const assignedPosition = slots[targetIndex].positionName;
    slots[targetIndex] = { ...slots[targetIndex], player };
    this.updateSlotsArray(currentStep, slots);

    // 2. Comprobar si se completaron los 15 titulares para auto-transición
    if (currentStep === 'titulares') {
      const filledStarters = slots.filter(s => s.player !== null).length;
      if (filledStarters === 15) {
        this.toastService.success(
          `Asignado #${assignedNumber} (${assignedPosition}): ${player.fullName}. ¡15 Titulares completos! Pasando a suplentes...`,
          'Formación Titular'
        );
        this.setStep('suplentes');
        return;
      }
    }

    // 3. Auto-avanzar al siguiente puesto vacío (Opción A)
    const nextEmptyIndex = this.findNextEmptySlotIndex(slots, targetIndex);
    this.activeSlotIndex.set(nextEmptyIndex);

    if (currentStep === 'suplentes' && nextEmptyIndex === null) {
      this.toastService.success(
        `Asignado #${assignedNumber} (${assignedPosition}): ${player.fullName}. ¡Plantel completo!`,
        'Alineación Completa'
      );
    } else {
      this.toastService.info(
        `Asignado #${assignedNumber} (${assignedPosition}): ${player.fullName}`
      );
    }
  }

  private findNextEmptySlotIndex(slots: RosterSlot[], fromIndex: number): number | null {
    // Buscar hacia adelante desde fromIndex + 1
    for (let i = fromIndex + 1; i < slots.length; i++) {
      if (slots[i].player === null) {
        return i;
      }
    }
    // Si no se encuentra hacia adelante, buscar desde el principio (ciclo)
    for (let i = 0; i < fromIndex; i++) {
      if (slots[i].player === null) {
        return i;
      }
    }
    return null;
  }

  clearSlot(index: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    const currentStep = this.currentStep();
    const slots = currentStep === 'titulares' ? [...this.startingSlots()] : [...this.substituteSlots()];

    if (slots[index]) {
      const removedPlayerName = slots[index].player?.fullName;
      const slotNumber = slots[index].number;
      const slotPosition = slots[index].positionName;

      slots[index] = { ...slots[index], player: null };
      this.updateSlotsArray(currentStep, slots);

      // Opción A: dejar la casilla recién vaciada inmediatamente en foco para sustituir
      this.activeSlotIndex.set(index);

      if (removedPlayerName) {
        this.toastService.info(`Se quitó a ${removedPlayerName}. Puesto #${slotNumber} (${slotPosition}) listo para asignar.`);
      }
    }
  }

  private updateSlotsArray(step: RosterStep, newSlots: RosterSlot[]): void {
    if (step === 'titulares') {
      this.startingSlots.set(newSlots);
    } else {
      this.substituteSlots.set(newSlots);
    }
  }

  isPlayerAssigned(playerId: string): boolean {
    return this.assignedPlayerMap().has(playerId);
  }

  getPlayerDorsal(playerId: string): number | undefined {
    return this.assignedPlayerMap().get(playerId);
  }

  updateSlotNumber(index: number, rawValue: number | string | null): void {
    const slots = this.currentStep() === 'titulares' ? [...this.startingSlots()] : [...this.substituteSlots()];
    const slot = slots[index];
    if (!slot) return;
    const value = rawValue === null || rawValue === '' ? null : Number(rawValue);
    slots[index] = { ...slot, matchNumber: Number.isFinite(value) ? value : null };
    this.updateSlotsArray(this.currentStep(), slots);
    if (this.validatedDuplicateSlotIndex() === index) {
      this.validatedDuplicateSlotIndex.set(null);
    }
  }

  isDuplicateSlotNumber(index: number): boolean {
    if (this.validatedDuplicateSlotIndex() !== index) {
      return false;
    }

    const slots = this.currentStep() === 'titulares' ? this.startingSlots() : this.substituteSlots();
    const number = slots[index]?.matchNumber;
    if (number === null || number === undefined || !Number.isInteger(number) || number <= 0) {
      return false;
    }

    return [...this.startingSlots(), ...this.substituteSlots()]
      .filter(slot => slot.matchNumber === number)
      .length > 1;
  }

  finishSlotNumberEdit(index: number): void {
    this.validatedDuplicateSlotIndex.set(this.isSlotNumberDuplicated(index) ? index : null);
  }

  private isSlotNumberDuplicated(index: number): boolean {
    const slots = this.currentStep() === 'titulares' ? this.startingSlots() : this.substituteSlots();
    const number = slots[index]?.matchNumber;
    if (number === null || number === undefined || !Number.isInteger(number) || number <= 0) {
      return false;
    }

    return [...this.startingSlots(), ...this.substituteSlots()]
      .filter(slot => slot.matchNumber === number)
      .length > 1;
  }

  goBack(): void {
    this.router.navigate(['/match-selection']);
  }

  guardarPlantel(): void {
    const titularSlots = this.startingSlots();
    const substituteSlots = this.substituteSlots();

    if (this.startingAssignedCount() !== 15) {
      const missing = 15 - this.startingAssignedCount();
      this.toastService.warning(
        `Formación incompleta: has asignado ${this.startingAssignedCount()}/15 titulares. Faltan ${missing} para iniciar el partido.`,
        'Atención'
      );
      this.setStep('titulares');
      return;
    }
    let lastSubstitute = -1;
    for (let index = substituteSlots.length - 1; index >= 0; index--) {
      if (substituteSlots[index].player !== null) {
        lastSubstitute = index;
        break;
      }
    }
    if (lastSubstitute >= 0 && substituteSlots.slice(0, lastSubstitute + 1).some(slot => slot.player === null)) {
      this.toastService.warning('No puede haber casillas de suplentes vacías antes de otro suplente.', 'Plantel inválido');
      this.setStep('suplentes');
      return;
    }
    if (this.hasInvalidNumbers()) {
      this.toastService.warning('Cada jugador debe tener un número entero positivo y no repetido.', 'Números inválidos');
      return;
    }
    const titulares = titularSlots.map(slot => ({ playerId: slot.player!.id, number: slot.matchNumber! }));
    const suplentes = lastSubstitute < 0
      ? []
      : substituteSlots.slice(0, lastSubstitute + 1)
        .map(slot => ({ playerId: slot.player!.id, number: slot.matchNumber! }));
    const playerIds = [...titulares, ...suplentes].map(entry => entry.playerId);
    if (new Set(playerIds).size !== playerIds.length) {
      this.toastService.warning('Un jugador no puede repetirse en el plantel.', 'Plantel inválido');
      return;
    }
    if (this.isRosterLocked()) {
      this.toastService.warning('El plantel no puede modificarse después de iniciar el partido.', 'Partido iniciado');
      return;
    }

    this.isSaving.set(true);

    const payload: RosterPayload = {
      matchId: this.matchId(),
      titulares,
      suplentes
    };

    this.rosterService.saveRoster(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toastService.success('¡Plantel oficial guardado con éxito!', 'Alineación Confirmada');
        this.router.navigate(['/match-selection']);
      },
      error: (err) => {
        this.isSaving.set(false);
        console.error('Error al guardar el plantel:', err);
        this.toastService.error('Hubo un error al intentar guardar el plantel. Intenta nuevamente.');
      }
    });
  }
}