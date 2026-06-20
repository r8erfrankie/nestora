import { formatNumber } from 'libphonenumber-js';
export { isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Formats an E.164 phone number for human display.
 * "+15551234567" → "(555) 123-4567" (national format)
 * Returns null for empty input; returns the raw value if it cannot be parsed.
 */
export function formatPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  try {
    return formatNumber(phone, 'NATIONAL') || phone;
  } catch {
    return phone;
  }
}
