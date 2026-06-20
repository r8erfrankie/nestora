'use client';

import { forwardRef, useState } from 'react';
import RawPhoneInput, { type Value, type Country } from 'react-phone-number-input';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// Forwarded-ref wrapper so react-phone-number-input can attach its internal ref.
// rounded-l-none! strips the left border-radius so the number field connects
// flush to the country selector.
const PhoneNumberInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => (
    <Input {...props} ref={ref} className={cn('rounded-l-none!', className)} />
  )
);
PhoneNumberInput.displayName = 'PhoneNumberInput';

interface PhoneInputProps {
  value?: Value;
  onChange: (value: Value | undefined) => void;
  defaultCountry?: Country;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  'aria-invalid'?: boolean;
}

/**
 * Controlled phone input with country selector.
 * value / onChange use E.164 format (e.g. "+15551234567").
 * onChange fires undefined while the number is incomplete.
 */
export function PhoneInput({
  value,
  onChange,
  defaultCountry = 'US',
  disabled,
  id,
  className,
  'aria-invalid': ariaInvalid,
}: PhoneInputProps) {
  return (
    <RawPhoneInput
      international
      defaultCountry={defaultCountry}
      value={value}
      onChange={onChange}
      inputComponent={PhoneNumberInput}
      disabled={disabled}
      id={id}
      aria-invalid={ariaInvalid}
      className={cn('phone-input', className)}
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

/**
 * Form-field wrapper for use inside Server Component <form action={serverAction}> forms.
 * Stores the E.164 value in a hidden <input name={name}> so server actions can
 * read it from formData via formData.get(name).
 */
export function PhoneInputField({
  name,
  defaultValue,
  disabled,
  id,
  className,
}: PhoneInputFieldProps) {
  const [value, setValue] = useState<Value | undefined>(
    defaultValue ? (defaultValue as Value) : undefined
  );
  return (
    <div className={className}>
      <input type="hidden" name={name} value={value ?? ''} />
      <PhoneInput value={value} onChange={setValue} disabled={disabled} id={id ?? name} />
    </div>
  );
}
