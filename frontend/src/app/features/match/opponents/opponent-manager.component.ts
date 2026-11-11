import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpponentService, Opponent } from '../services/opponent.service';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from 'src/app/core/services/toast.service';

@Component({
    selector: 'ot-opponent-manager',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './opponent-manager.component.html',
    styleUrl: '../styles/match-shared.css'
})
export class OpponentManagerComponent implements OnInit {
    private readonly opponentService = inject(OpponentService);
    private readonly router = inject(Router);
    private readonly toastService = inject(ToastService);

    opponents: Opponent[] = [];
    
    isModalOpen = false;
    editingId: string | null = null;
    draft: Opponent = { name: '', city: '', alias: '' };

    ngOnInit(): void {
        this.loadOpponents();
    }

    loadOpponents(): void {
        this.opponentService.getAllOpponents().subscribe({
            next: (data) => this.opponents = data,
            error: () => this.toastService.show('error', 'No se pudieron cargar los rivales.', 'Error de carga')
        });
    }

    openCreateModal(): void {
        this.editingId = null;
        this.draft = { name: '', city: '', alias: '' };
        this.isModalOpen = true;
    }

    openEditModal(opponent: Opponent): void {
        this.editingId = opponent.id!;
        this.draft = { ...opponent };
        this.isModalOpen = true;
    }

    closeModal(): void {
        this.isModalOpen = false;
    }

    get isFormValid(): boolean {
        return this.draft.name.trim().length > 0 
        && this.draft.city.trim().length > 0
        && this.draft.alias.trim().length > 0;
    }

    saveOpponent(): void {
        if (!this.isFormValid) return;

        if (this.editingId) {
            this.opponentService.updateOpponent(this.editingId, this.draft).subscribe({
                next: (updated) => {
                    const index = this.opponents.findIndex(o => o.id === updated.id);
                    if (index !== -1) this.opponents[index] = updated;
                    this.closeModal();
                    this.toastService.show('success', `El rival "${updated.name}" fue actualizado exitosamente.`, 'Rival actualizado');
                },
                error: (err) => {
                    const msg = typeof err.error === 'string' ? err.error : (err.error?.message || 'Error al actualizar el rival.');
                    this.toastService.show('error', msg, 'Error');
                }
            });
        } else {
            this.opponentService.createOpponent(this.draft).subscribe({
                next: (created) => {
                    this.opponents.push(created);
                    this.closeModal();
                    this.toastService.show('success', `El rival "${created.name}" fue creado exitosamente.`, 'Rival creado');
                },
                error: (err) => {
                    const msg = typeof err.error === 'string' ? err.error : (err.error?.message || 'Error al crear el rival.');
                    this.toastService.show('error', msg, 'Error');
                }
            });
        }
    }

    confirmDelete(id: string, name: string): void {
        if (!confirm(`¿Estás seguro de eliminar a ${name}? Esto fallará si ya tiene partidos jugados.`)) return;

        this.opponentService.deleteOpponent(id).subscribe({
            next: () => {
                this.opponents = this.opponents.filter(o => o.id !== id);
                this.toastService.show('success', `El rival "${name}" fue eliminado correctamente.`, 'Rival eliminado');
            },
            error: () => {
                this.toastService.show('error', 'No se puede eliminar un rival que tiene partidos registrados.', 'No se pudo eliminar');
            }
        });
    }

    goToBack() {
        this.router.navigate(['/match-selection']);
    }
}