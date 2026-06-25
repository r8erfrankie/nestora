import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nestora',
    short_name: 'Nestora',
    description: 'Property maintenance made simple for small landlords.',
    start_url: '/',
    id: 'https://gonestora.app/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0F766E',
    theme_color: '#0F766E',
    categories: ['productivity', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/landlord-work-orders.png',
        sizes: '2390x1238',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Landlord work order dashboard',
      },
      {
        src: '/screenshots/contractor-work-orders.png',
        sizes: '1012x1286',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Contractor work order view',
      },
    ],
  };
}
