/**
 * Role definitions for Nestora.
 *
 * - NULL       : user has signed up but not yet chosen a role (sent to /select-role)
 * - landlord   : property owner / manager — full dashboard + onboarding
 * - contractor : maintenance worker — work-order view + contractor onboarding
 * - tenant     : renter — maintenance request submission + tenant onboarding
 *
 * Adding a new role:
 *   1. Add the value here and to the DB check constraint on profiles.role.
 *   2. Add a card to /select-role.
 *   3. Add routing logic to proxy.ts (validRole + cross-role guards).
 *   4. Add an onboarding page and a dashboard route.
 *
 * Role is stored in profiles.role and read server-side via getCurrentUserRole()
 * in lib/supabase/server.ts. Never read role client-side from Supabase directly.
 */

export type UserRole = 'landlord' | 'contractor' | 'tenant';

export function isLandlord(role: UserRole | null): boolean {
  return role === 'landlord';
}

export function isContractor(role: UserRole | null): boolean {
  return role === 'contractor';
}

export function isTenant(role: UserRole | null): boolean {
  return role === 'tenant';
}
