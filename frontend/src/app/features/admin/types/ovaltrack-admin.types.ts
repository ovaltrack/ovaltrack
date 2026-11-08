import { UserResponseDTO } from 'src/app/features/user/types/user.types';
import { Club } from '../../club/types/club.types';

export interface UserClubRegistration {
    user: UserResponseDTO,
    club: Club
}

export type AccountFilter = 'all' | 'active' | 'inactive';
export type ClubFilter = 'all' | 'active' | 'rejected';

export interface FilterOption<T extends string> {
    value: T;
    label: string;
}

interface ConfirmBase {
    title: string;
    message: string;
    detail?: string;
}

/** Confirmación de una acción destructiva (rechazar, desactivar): Cancelar o confirmar. */
export interface ConfirmAction extends ConfirmBase {
    kind?: 'confirm';
    confirmLabel: string;
    run: () => void;
}

/** Una de las salidas de una confirmación con varias opciones. */
export interface ConfirmChoice {
    label: string;
    icon: string;
    tone: 'primary' | 'danger' | 'outline';
    run: () => void;
}

/** Confirmación con varias salidas (p. ej. desactivar a un admin de club: reasignar, desactivar el club o solo la cuenta). */
export interface ConfirmChoices extends ConfirmBase {
    kind: 'choices';
    choices: ConfirmChoice[];
}

export type ConfirmRequest = ConfirmAction | ConfirmChoices;

export interface AdminStats {
    pendingRequests: number;
    pendingClubs: number;
    activeAccounts: number;
    activeClubs: number;
}
