'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Simple US phone input — no country selector, no flag, no E.164 transformation.
// Stores whatever the user types (e.g. "(555) 123-4567" or "555-123-4567").

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
  id,
  className,
  'aria-invalid': ariaInvalid,
}: PhoneInputProps) {
  return (
    <Input
      type="tel"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      disabled={disabled}
      id={id}
      className={cn(className)}
      aria-invalid={ariaInvalid}
      placeholder="(555) 123-4567"
      autoComplete="tel"
    />
  );
}

interface PhoneInputFieldProps {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

// Form-field wrapper for <form action={serverAction}> forms.
// Stores the value in a hidden <input> so server actions can read it from formData.
export function PhoneInputField({
  name,
  defaultValue,
  disabled,
  id,
  className,
}: PhoneInputFieldProps) {
  const [value, setValue] = useState(defaultValue ?? '');
  return (
    <div className={className}>
      <input type="hidden" name={name} value={value} />
      <PhoneInput
        value={value || undefined}
        onChange={(v) => setValue(v ?? '')}
        disabled={disabled}
        id={id ?? name}
      />
    </div>
  );
}
