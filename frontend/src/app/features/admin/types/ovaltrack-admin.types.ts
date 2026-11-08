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

/** Confirmación pendiente de una acción destructiva (rechazar, desactivar). */
export interface ConfirmRequest {
    title: string;
    message: string;
    detail?: string;
    confirmLabel: string;
    run: () => void;
}

export interface AdminStats {
    pendingRequests: number;
    pendingClubs: number;
    activeAccounts: number;
    activeClubs: number;
}
