'use client';

import { useEffect } from 'react';

/**
 * Marks <html> with a `standalone-pwa` class when running as an installed
 * home-screen app, as a more reliable companion to the CSS `@media
 * (display-mode: standalone)` query that the safe-area utilities
 * (.pt-nav-safe, .pb-nav, .h-nav-spacer in globals.css) key off of.
 *
 * Why this exists: `display-mode: standalone` as a CSS media feature has a
 * history of inconsistent support across iOS Safari versions. `navigator
 * .standalone` is the older, iOS-specific API that's been reliable since very
 * early iOS and is checked here as a fallback so the safe-area padding still
 * applies (clearing the status bar / home indicator) even on devices where
 * the media query itself doesn't fire.
 *
 * Rendered as null — this component adds zero DOM nodes.
 */
export function StandaloneDetector() {
  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone =
      nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    if (isStandalone) {
      document.documentElement.classList.add('standalone-pwa');
    }
  }, []);

  return null;
}
