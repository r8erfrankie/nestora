/**
 * Role definitions for Nestora.
 *
 * - NULL  : user has signed up but not yet chosen a role (sent to /select-role)
 * - landlord : property owner / manager — full dashboard + onboarding
 * - contractor : maintenance worker — work-order view + contractor onboarding
 *
 * Adding a new role (e.g. tenant) in the future:
 *   1. Add the value to UserRole and the DB check constraint.
 *   2. Add a card to /select-role.
 *   3. Add a route guard + onboarding flow for that role.
 *
 * Role is stored in profiles.role and read server-side via getCurrentUserRole()
 * in lib/supabase/server.ts. Never read role client-side from Supabase directly.
 */

export type UserRole = 'landlord' | 'contractor';

export function isLandlord(role: UserRole | null): boolean {
  return role === 'landlord';
}

export function isContractor(role: UserRole | null): boolean {
  return role === 'contractor';
}
