'use client';

import { useEffect, useRef } from 'react';
import { markSectionVisited } from '@/app/actions/mark-visited';

export function MarkVisited({ section }: { section: 'tenants' | 'work_orders' }) {
  const hasMarked = useRef(false);

  useEffect(() => {
    if (!hasMarked.current) {
      hasMarked.current = true;
      markSectionVisited(section);
    }
  }, [section]);

  return null;
}
