import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Nestora — Maintenance made simple for small landlords';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0F766E',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px 96px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* House icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 16,
            marginBottom: 40,
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 9.5L12 3L21 9.5V20C21 20.552 20.552 21 20 21H15V15H9V21H4C3.448 21 3 20.552 3 20V9.5Z"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-1px',
            lineHeight: 1,
            marginBottom: 24,
          }}
        >
          Nestora
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.4,
            maxWidth: 640,
          }}
        >
          Maintenance made simple for small landlords.
        </div>

        {/* Domain pill */}
        <div
          style={{
            display: 'flex',
            marginTop: 56,
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 999,
            padding: '10px 24px',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 20,
          }}
        >
          gonestora.app
        </div>
      </div>
    ),
    { ...size },
  );
}
