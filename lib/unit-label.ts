export type UnitLabelType = 'room' | 'unit' | 'apt';

export const UNIT_LABEL_OPTIONS = [
  { value: 'unit', label: 'Unit' },
  { value: 'room', label: 'Room' },
  { value: 'apt', label: 'Apt' },
] as const;

/** Returns just the capitalized word: "Unit", "Room", or "Apt". */
export function getLabelWord(labelType: string | null | undefined): string {
  if (labelType === 'room') return 'Room';
  if (labelType === 'apt') return 'Apt';
  return 'Unit';
}

/** Returns the formatted string (e.g. "Apt 3B") or null if unit is empty. */
export function formatUnit(
  unit: string | null | undefined,
  labelType: string | null | undefined
): string | null {
  if (!unit) return null;
  return `${getLabelWord(labelType)} ${unit}`;
}
