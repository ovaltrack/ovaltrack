import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
  HostListener,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MembersService } from '../../services/members.service';
import { ToastService, ToastType } from '../../../../core/services/toast.service';
import {
  ClubInfo,
  FilterCategory,
  Member,
  ROLE_META,
  SELECTABLE_ROLES,
  StatusFilter,
  UserRole,
  bucketOf,
  getMemberDisplayName,
  getMemberInitials,
  matchesSearchQuery,
  matchesStatus
} from '../../types/members.types';
import { BatchActionBarComponent } from '../../components/batch-action-bar/batch-action-bar.component';
import { DeactivateModalComponent } from '../../components/deactivate-modal/deactivate-modal.component';
import { ModalComponent } from 'src/app/features/modal/modal.component';

@Component({
  selector: 'app-members-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BatchActionBarComponent,
    DeactivateModalComponent,
    ModalComponent
  ],
  templateUrl: './members-list.component.html',
  styleUrl: './members-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersListComponent implements OnInit {
  private readonly membersService = inject(MembersService);
  private readonly toastService = inject(ToastService);

  readonly ROLE_META = ROLE_META;
  readonly SELECTABLE_ROLES = SELECTABLE_ROLES;
  readonly getMemberInitials = getMemberInitials;
  readonly getMemberDisplayName = getMemberDisplayName;

  readonly statusFilterDefs: Array<{
    key: StatusFilter;
    label: string;
  }> = [
      { key: 'ACTIVE', label: 'Activos' },
      { key: 'INACTIVE', label: 'Inactivos' },
      { key: 'ALL', label: 'Todos' }
    ];

  readonly filterDefs: Array<{
    key: FilterCategory;
    label: string;
    dot?: string;
    dashed?: boolean;
  }> = [
      { key: 'ALL', label: 'Todos' },
      { key: 'STAFF', label: 'Staff / Coaches', dot: 'var(--navy)' },
      { key: 'PLAYER', label: 'Jugadores', dot: 'var(--player)' },
      { key: 'NO_ROLE', label: 'Sin asignar', dashed: true }
    ];

  // State Signals
  readonly members = signal<Member[]>([]);
  readonly initialRoles = signal<Map<string, UserRole>>(new Map());
  readonly dirtyMembers = signal<Set<string>>(new Set());
  readonly searchQuery = signal<string>('');
  readonly activeFilter = signal<FilterCategory>('ALL');
  readonly statusFilter = signal<StatusFilter>('ACTIVE');
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  readonly openMenu = signal<{ type: 'role' | 'actions'; memberId: string } | null>(null);
  readonly club = signal<ClubInfo | null>(null);

  

  // Computed Signals
  readonly clubName = computed(() => this.club()?.name || 'Orcas RC');
  readonly clubCrest = computed(() => {
    const name = this.clubName().trim();
    return name ? name.charAt(0).toUpperCase() : 'O';
  });

  readonly statusCounts = computed(() => {
    let active = 0;
    let inactive = 0;
    for (const member of this.members()) {
      if (member.active) active++;
      else inactive++;
    }
    return {
      ACTIVE: active,
      INACTIVE: inactive,
      ALL: this.members().length
    };
  });

  readonly filterCounts = computed(() => {
    const status = this.statusFilter();
    const statusFiltered = this.members().filter(member => matchesStatus(member, status));
    const counts: Record<FilterCategory, number> = {
      ALL: statusFiltered.length,
      STAFF: 0,
      PLAYER: 0,
      NO_ROLE: 0
    };
    for (const member of statusFiltered) {
      const bucket = bucketOf(member.role);
      counts[bucket] = (counts[bucket] || 0) + 1;
    }
    return counts;
  });

  readonly filteredMembers = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const category = this.activeFilter();
    const status = this.statusFilter();

    return this.members().filter(member =>
      matchesSearchQuery(member, query) &&
      (category === 'ALL' || bucketOf(member.role) === category) &&
      matchesStatus(member, status)
    );
  });

  readonly dirtyCount = computed(() => this.dirtyMembers().size);
  readonly hasDirtyMembers = computed(() => this.dirtyMembers().size > 0);
  readonly hasActiveAdmin = computed(() =>
    this.members().some(m => m.active && m.role === 'ADMIN_CLUB')
  );

  isRoleOptionDisabled(member: Member, role: UserRole): boolean {
    return role === 'ADMIN_CLUB' && this.hasActiveAdmin() && member.role !== 'ADMIN_CLUB';
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);

    this.membersService.getMembers().subscribe({
      next: (data) => {
        this.members.set(data);
        this.initialRoles.set(new Map(data.map(m => [m.id, m.role])));
        this.dirtyMembers.set(new Set());
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar miembros:', err);
        this.isLoading.set(false);
        this.showBanner(
          'error',
          'Error de conexión',
          'No se pudieron cargar los miembros desde el servidor. Revisa tu conexión.'
        );
      }
    });

    this.membersService.getMyClub().subscribe({
      next: (clubData) => {
        if (clubData) {
          this.club.set(clubData);
        }
      },
      error: () => {
        // En caso de error o si no tiene club asignado, se mantiene el fallback por defecto
      }
    });
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
  }

  setFilter(filter: FilterCategory): void {
    this.activeFilter.set(filter);
  }

  setStatusFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
  }

  toggleRoleMenu(memberId: string, event: Event): void {
    event.stopPropagation();
    const member = this.members().find(m => m.id === memberId);
    if (!member || !member.active || member.isProtected) {
      return;
    }
    const current = this.openMenu();
    if (current && current.type === 'role' && current.memberId === memberId) {
      this.closeMenus();
    } else {
      this.openMenu.set({ type: 'role', memberId });
    }
  }

  toggleActionsMenu(memberId: string, event: Event): void {
    event.stopPropagation();
    const member = this.members().find(m => m.id === memberId);
    if (!member) {
      return;
    }
    const current = this.openMenu();
    if (current && current.type === 'actions' && current.memberId === memberId) {
      this.closeMenus();
    } else {
      this.openMenu.set({ type: 'actions', memberId });
    }
  }

  closeMenus(): void {
    this.openMenu.set(null);
  }

  selectRole(memberId: string, newRole: UserRole, event: Event): void {
    event.stopPropagation();
    const member = this.members().find(m => m.id === memberId);
    if (!member) {
      this.closeMenus();
      return;
    }

    if (member.isProtected && newRole !== member.role) {
      this.closeMenus();
      this.showBanner(
        'warning',
        'No tenés permisos suficientes',
        'Solo un Administrador de OvalTrack puede reasignar el rol de otro Administrador de club.'
      );
      return;
    }

    if (newRole === 'ADMIN_CLUB' && this.hasActiveAdmin() && member.role !== 'ADMIN_CLUB') {
      this.closeMenus();
      this.showBanner(
        'warning',
        'Límite de administradores alcanzado',
        'El club ya cuenta con un administrador activo. Solo puede haber un administrador por club.'
      );
      return;
    }

    // Actualizar rol localmente en el signal
    this.updateMember(memberId, { role: newRole });

    // Actualizar dirty set
    const initialRole = this.initialRoles().get(memberId);
    const updatedDirty = new Set(this.dirtyMembers());
    if (newRole !== initialRole) {
      updatedDirty.add(memberId);
    } else {
      updatedDirty.delete(memberId);
    }
    this.dirtyMembers.set(updatedDirty);

    this.closeMenus();
  }

  private updateMember(memberId: string, patch: Partial<Member>): void {
    this.members.update(list =>
      list.map(member => (member.id === memberId ? { ...member, ...patch } : member))
    );
  }

  readonly memberToDeactivate = signal<Member | null>(null);
  readonly isDeactivating = signal<boolean>(false);

  // SEÑALES PARA LA INVITACIÓN
  readonly memberToInvite = signal<Member | null>(null);
  readonly isInviting = signal<boolean>(false);

  // 1. Abre el modal
  onInviteClick(member: Member): void {
    if (!member.email) {
      this.showBanner(
        'warning', 
        'Falta correo electrónico', 
        `Debes editar el perfil de ${member.firstName} y agregarle un email antes de poder invitarlo.`
      );
      return;
    }
    this.memberToInvite.set(member);
  }

  // 2. Cierra el modal
  cancelarInvitacion(): void {
    this.memberToInvite.set(null);
  }

  // 3. Ejecuta la llamada al backend
  confirmarInvitacion(): void {
    const target = this.memberToInvite();
    if (!target || this.isInviting()) return;

    this.isInviting.set(true);

    // Aquí llamas a tu servicio (Asegúrate de tener este método en MembersService)
    this.membersService.inviteMember(target.id, target.email).subscribe({
      next: () => {
        this.isInviting.set(false);
        this.memberToInvite.set(null);
        this.showBanner(
          'success', 
          'Invitación enviada', 
          `Se envió un correo a ${target.email} con las instrucciones para unirse.`
        );
        // Opcional: Podrías marcar localmente que ya fue invitado para cambiar el texto del botón
      },
      error: (err) => {
        console.error('Error al invitar:', err);
        this.isInviting.set(false);
        const msg = err?.error?.message || 'Hubo un problema al enviar la invitación.';
        this.showBanner('error', 'Error al enviar', msg);
      }
    });
  }

  handleAction(member: Member, action: 'revoke' | 'activate', event: Event): void {
    event.stopPropagation();
    this.closeMenus();

    if (action === 'revoke') {
      if (member.isProtected) {
        this.showBanner(
          'warning',
          'No puedes dar de baja a este usuario',
          'No tenés permisos para revocar el acceso de un administrador.'
        );
        return;
      }
      this.memberToDeactivate.set(member);
    } else if (action === 'activate') {
      this.activateUser(member);
    }
  }

  cancelDeactivate(): void {
    this.memberToDeactivate.set(null);
  }

  confirmDeactivate(): void {
    const target = this.memberToDeactivate();
    if (!target || this.isDeactivating()) return;

    this.isDeactivating.set(true);
    this.membersService.deactivateUser(target.id).subscribe({
      next: () => {
        this.updateMember(target.id, { active: false });
        this.isDeactivating.set(false);
        this.memberToDeactivate.set(null);

        const fullName = `${target.firstName} ${target.lastName}`.trim() || target.email;
        this.showBanner(
          'success',
          'Acceso revocado',
          `El usuario ${fullName} fue dado de baja correctamente.`
        );
      },
      error: (err) => {
        console.error('Error al dar de baja:', err);
        this.isDeactivating.set(false);
        this.memberToDeactivate.set(null);
        const msg = err?.error?.message || 'Hubo un problema al dar de baja al usuario.';
        this.showBanner('error', 'No se pudo dar de baja', msg);
      }
    });
  }

  discardChanges(): void {
    const initial = this.initialRoles();
    const revertedList = this.members().map(m => {
      const originalRole = initial.get(m.id);
      return originalRole ? { ...m, role: originalRole } : m;
    });
    this.members.set(revertedList);
    this.dirtyMembers.set(new Set());
  }

  saveAllChanges(): void {
    const dirtyIds = Array.from(this.dirtyMembers());
    if (dirtyIds.length === 0 || this.isSaving()) {
      return;
    }

    const updates = dirtyIds.map(id => ({
      userId: id,
      newRole: this.members().find(m => m.id === id)!.role
    }));

    this.isSaving.set(true);

    this.membersService.updateBatchRoles(updates).subscribe({
      next: () => {
        // Actualizar roles base
        const updatedInitial = new Map(this.initialRoles());
        for (const update of updates) {
          updatedInitial.set(update.userId, update.newRole);
        }
        this.initialRoles.set(updatedInitial);
        this.dirtyMembers.set(new Set());
        this.isSaving.set(false);

        const n = updates.length;
        this.showBanner(
          'success',
          'Cambios guardados',
          `Se actualizaron ${n} rol${n > 1 ? 'es' : ''} correctamente.`
        );
      },
      error: (err) => {
        console.error('Error al guardar roles:', err);
        this.isSaving.set(false);
        const errMsg = err?.error?.message || 'Hubo un problema al guardar los cambios en el servidor.';
        this.showBanner('error', 'No se pudo guardar el cambio', errMsg);
      }
    });
  }

  showBanner(type: ToastType, title: string, message: string): void {
    this.toastService.show(type, message, title);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  activateUser(member: Member): void {
    this.isDeactivating.set(true);
    this.membersService.activateUser(member.id).subscribe({
      next: () => {
        this.updateMember(member.id, { active: true });
        this.isDeactivating.set(false);

        const fullName = `${member.firstName} ${member.lastName}`.trim() || member.email;
        this.showBanner(
          'success',
          'Acceso activado',
          `El usuario ${fullName} fue dado de alta correctamente.`
        );
      },
      error: (err) => {
        console.error('Error al dar de alta:', err);
        this.isDeactivating.set(false);
        const msg = err?.error?.message || 'Hubo un problema al activar el usuario.';
        this.showBanner('error', 'No se pudo activar', msg);
      }
    });
  }

  editarJugador(member: Member): void {
    // Cerramos el menú de los 3 puntitos
    this.closeMenus();
    
    // Aquí irá la lógica real (abrir un modal o navegar a la pantalla de edición)
    this.showBanner(
      'info', 
      'Editar Jugador', 
      `Editando información de ${member.firstName} ${member.lastName}`
    );
  }

  // Variables para controlar el dropdown y el modal
  activeMenuMemberId: string | null = null;
  isEditModalOpen: boolean = false;
  selectedMemberToEdit: any = null;
  isSavingMember = false;
  todayDate = new Date().toISOString().split('T')[0];

  // Formulario o modelo temporal de edición
  editFormData = {
    firstName: '',
    lastName: '',
    birthDate: '',
    contactPhone: '',
    contactEmail: ''
  };

  activeMenuMember: any = null; // Guardamos el miembro seleccionado

  toggleMenu(member: any, event: MouseEvent): void {
    event.stopPropagation(); // Evita que el evento suba al document
    if (this.activeMenuMember === member) {
      this.activeMenuMember = null;
    } else {
      this.activeMenuMember = member;
    }
  }

  closeMenu(): void {
    this.activeMenuMember = null;
  }
  // Abrir modal de edición
  openEditModal(member: any): void {

    console.log('Datos del miembro recibidos desde el backend:', member);

    this.closeMenu();
    this.selectedMemberToEdit = member;

    let formattedDate = '';
    if (member.birthDate) {
      formattedDate = member.birthDate.toString().split('T')[0];
    }

    this.editFormData = {
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      birthDate: formattedDate,
      contactPhone: member.contactPhone || member.phone || '',
      contactEmail: member.contactEmail || member.email || ''
    };

    this.isEditModalOpen = true;
  }

  saveMemberChanges(): void {
    if (!this.selectedMemberToEdit) return;

    const personId = this.selectedMemberToEdit.personId || this.selectedMemberToEdit.id;
    if (!personId) return;

    this.isSavingMember = true;

    try {
      // Armado de payload a prueba de errores (forzamos String para evitar el crasheo del trim)
      const payload = {
        firstName: this.editFormData.firstName,
        lastName: this.editFormData.lastName,
        birthDate: this.editFormData.birthDate ? this.editFormData.birthDate : null,
        contactEmail: this.editFormData.contactEmail ? String(this.editFormData.contactEmail).trim() : null,
        contactPhone: this.editFormData.contactPhone ? String(this.editFormData.contactPhone).trim() : null
      };

      console.log('Enviando PUT con payload:', payload);

      this.membersService.updatePerson(personId, payload).subscribe({
        next: () => {
          // Actualizar tabla local
          this.selectedMemberToEdit.firstName = payload.firstName;
          this.selectedMemberToEdit.lastName = payload.lastName;
          this.selectedMemberToEdit.email = payload.contactEmail;
          this.selectedMemberToEdit.contactEmail = payload.contactEmail;
          this.selectedMemberToEdit.birthDate = payload.birthDate;
          this.selectedMemberToEdit.contactPhone = payload.contactPhone;

          this.isSavingMember = false;
          this.closeEditModal();
        },
        error: (err) => {
          console.error('Error al actualizar datos:', err);
          this.isSavingMember = false;
          alert(err.error?.message || 'Error al guardar los cambios');
        }
      });
    } catch (error) {
      console.error('Error armando los datos antes de enviar:', error);
      this.isSavingMember = false;
    }
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.selectedMemberToEdit = null;
  }

}
