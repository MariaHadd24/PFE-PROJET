import type { UserRole } from '../types';

export const ROLE_LABEL: Record<UserRole, string> = {
  Admin: 'Administrateur IT',
  Technician: 'Technicien',
  Manager: 'Manager',
  Reader: 'Lecteur',
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  Admin: 'Paramétrage global, gestion des référentiels, droits, supervision.',
  Technician: 'Inventaire, mouvements, affectations, maintenance.',
  Manager: "Validation des demandes d’achat, suivi des KPI.",
  Reader: 'Consultation uniquement (tableaux, fiches, Dashboard).',
};

export type AppPage =
  | 'dashboard'
  | 'stock-inventory'
  | 'printer-incidents'
  | 'printer-toner'
  | 'assignments'
  | 'maintenance'
  | 'orders'
  | 'vendor-portal'
  | 'reporting'
  | 'licences'
  | 'audit-logs'
  | 'admin';

export function canAccessPage(role: UserRole, page: AppPage): boolean {
  if (role === 'Admin') return true;

  switch (page) {
    case 'dashboard':
    case 'stock-inventory':
    case 'printer-incidents':
    case 'printer-toner':
    case 'licences':
      return true;

    case 'assignments':
    case 'maintenance':
      return role === 'Technician' || role === 'Manager' || role === 'Reader';

    case 'reporting':
      return true;

    case 'orders':
      return role === 'Manager';

    case 'vendor-portal':
      return role === 'Manager';

    case 'audit-logs':
    case 'admin':
      return false;

    default:
      return false;
  }
}

export type AppAction =
  | 'manage_referentials'
  | 'manage_users'
  | 'manage_inventory'
  | 'manage_movements'
  | 'manage_assignments'
  | 'approve_assignments'
  | 'manage_maintenance'
  | 'manage_orders'
  | 'view_only';

export function canPerformAction(role: UserRole, action: AppAction): boolean {
  if (role === 'Admin') return true;

  if (role === 'Reader') {
    return action === 'view_only';
  }

  if (role === 'Technician') {
    return (
      action === 'view_only' ||
      action === 'manage_inventory' ||
      action === 'manage_movements' ||
      action === 'manage_assignments' ||
      action === 'manage_maintenance'
    );
  }

  if (role === 'Manager') {
    return action === 'view_only' || action === 'manage_orders' || action === 'approve_assignments';
  }

  return false;
}
