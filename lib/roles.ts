/**
 * Role definitions for Steady.
 *
 * Two signup flows are planned:
 *  - Landlords: full onboarding after signup (property setup, work order intro).
 *  - Contractors: minimal signup, no onboarding — land directly in their work order view.
 *
 * Role is stored in profiles.role and read server-side via getCurrentUserRole()
 * in lib/supabase/server.ts. Never read role client-side from Supabase directly.
 */

export type UserRole = 'landlord' | 'contractor';

export function isLandlord(role: UserRole): boolean {
  return role === 'landlord';
}

export function isContractor(role: UserRole): boolean {
  return role === 'contractor';
}
