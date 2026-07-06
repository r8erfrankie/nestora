'use client';

import { useEffect } from 'react';

export const APP_MOUNTED_FLAG = 'nestora_app_mounted';

/**
 * Marks this browsing session as "the app shell has rendered" so LoadingGate
 * can stop showing the full splash for subsequent client-side navigations
 * within the same session — reserving it for the true first cold launch
 * (tapping the icon from the home screen). sessionStorage persists through
 * backgrounding but resets on a full quit-and-relaunch, which is exactly the
 * distinction we want.
 *
 * Rendered as null — adds zero DOM nodes.
 */
export function AppMountedMarker() {
  useEffect(() => {
    sessionStorage.setItem(APP_MOUNTED_FLAG, '1');
  }, []);

  return null;
}
