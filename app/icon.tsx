import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F766E',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: 300,
            fontWeight: 800,
            fontFamily: 'sans-serif',
            lineHeight: 1,
            letterSpacing: -8,
          }}
        >
          N
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
