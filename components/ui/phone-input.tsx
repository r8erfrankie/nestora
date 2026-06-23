'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractDigits(val: string): string {
  const d = val.replace(/\D/g, '');
  // Strip leading country code when caller passes E.164 (+1XXXXXXXXXX)
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return d.slice(0, 10);
}

function formatDisplay(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length === 0) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function toE164(digits: string): string {
  return digits.length === 10 ? `+1${digits}` : digits;
}

// ── PhoneInput ─────────────────────────────────────────────────────────────────
// Controlled display component. Formats (NNN) NNN-NNNN as the user types.
// Calls onChange with the E.164 value (+1XXXXXXXXXX) when 10 digits are present.

interface PhoneInputProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  'aria-invalid'?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  disabled,
  required,
  id,
  className,
  'aria-invalid': ariaInvalid,
}: PhoneInputProps) {
  const [touched, setTouched] = useState(false);

  const digits = extractDigits(value ?? '');
  const display = formatDisplay(digits);
  const incomplete = touched && digits.length > 0 && digits.length < 10;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const d = extractDigits(e.target.value);
    onChange(d.length > 0 ? toE164(d) : undefined);
  }

  return (
    <div>
      <Input
        type="tel"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        disabled={disabled}
        required={required}
        id={id}
        className={cn(incomplete && 'border-destructive focus-visible:ring-destructive', className)}
        aria-invalid={ariaInvalid ?? incomplete}
        placeholder="(555) 123-4567"
        autoComplete="tel"
        maxLength={14}
      />
      {incomplete && (
        <p className="text-destructive mt-1 text-xs">Enter a 10-digit phone number.</p>
      )}
    </div>
  );
}

// ── PhoneInputField ────────────────────────────────────────────────────────────
// Form-field wrapper for <form action={serverAction}> forms.
// The hidden input always holds the E.164 value (+1XXXXXXXXXX) so server
// actions receive a clean string that validates without needing a country code.

interface PhoneInputFieldProps {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function PhoneInputField({
  name,
  defaultValue,
  required,
  disabled,
  id,
  className,
}: PhoneInputFieldProps) {
  const initialDigits = extractDigits(defaultValue ?? '');
  const [value, setValue] = useState(
    initialDigits.length === 10 ? toE164(initialDigits) : initialDigits
  );

  return (
    <div className={className}>
      <input type="hidden" name={name} value={value} />
      <PhoneInput
        value={value}
        onChange={(v) => setValue(v ?? '')}
        required={required}
        disabled={disabled}
        id={id ?? name}
      />
    </div>
  );
}
