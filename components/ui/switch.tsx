'use client';

import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onCheckedChange, disabled, id }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-teal-600' : 'bg-gray-200'
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-100',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </SwitchPrimitive.Root>
  );
}
