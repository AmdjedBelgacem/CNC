import { ImageResponse } from 'next/og';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        fontFamily: '"Inter", sans-serif',
      }}
    >
      {' '}
      <svg
        width="80"
        height="80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#C2410C"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: 24 }}
      >
        {' '}
        <circle cx="12" cy="12" r="3" />{' '}
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />{' '}
      </svg>{' '}
      <h1
        style={{
          fontSize: 72,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.02em',
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.1,
        }}
      >
        {' '}
        Baroot CNC Solutions{' '}
      </h1>{' '}
      <p
        style={{
          fontSize: 32,
          fontWeight: 600,
          color: '#C2410C',
          margin: '16px 0 0',
          textAlign: 'center',
          letterSpacing: '0.01em',
        }}
      >
        {' '}
        Free CNC Education{' '}
      </p>{' '}
    </div>,
    { ...size },
  );
}
