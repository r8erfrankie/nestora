'use client';

import { useEffect } from 'react';

/**
 * Smoothly centers a focused input/textarea/select in the viewport on mobile.
 *
 * Why this is needed:
 *   When the soft keyboard slides up it reduces the visual viewport height by
 *   ~40%. If the focused field is in the lower half of the page it may end up
 *   hidden under the keyboard or right at the edge. scrollIntoView({ block:
 *   'center' }) repositions the page so the field sits comfortably in the
 *   middle of the remaining visible area.
 *
 * Why the 300 ms delay:
 *   The focus event fires before the keyboard animation completes. Scrolling
 *   immediately moves to the wrong position because the viewport height hasn't
 *   shrunk yet. 300 ms is enough for the keyboard to finish sliding up on both
 *   iOS and Android without feeling sluggish.
 *
 * Desktop is unaffected: the guard bails out for viewports ≥ 768 px.
 * Rendered as null — this component adds zero DOM nodes.
 */
export function MobileFocusHandler() {
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      if (window.innerWidth >= 768) return;

      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      // Checkbox / radio don't open the keyboard — skip them.
      const type = (target as HTMLInputElement).type;
      if (type === 'checkbox' || type === 'radio' || type === 'range') return;

      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);

  return null;
}
