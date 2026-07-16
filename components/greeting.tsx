'use client';

import { useEffect, useState } from 'react';
import { getGreeting } from '@/lib/utils';

// Computed client-side so it reflects the visitor's own local time —
// a server-rendered greeting reflects the server's clock/timezone instead.
export function Greeting({ name }: { name?: string | null }) {
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(getGreeting());
  }, []);

  if (!greeting) return null;

  return (
    <>
      {greeting}
      {name ? `, ${name}` : ''}
    </>
  );
}
