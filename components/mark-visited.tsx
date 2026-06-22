'use client';

import { useEffect } from 'react';
import { markSectionVisited } from '@/app/actions/mark-visited';

export function MarkVisited({ section }: { section: 'tenants' | 'work_orders' }) {
  useEffect(() => {
    markSectionVisited(section);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
