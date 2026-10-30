import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'BAROOT CNC SOLUTIONS — CNC MACHINING COURSES & CERTIFICATION';

/**
 * The social share card shows the actual site logo, not a drawn stand-in.
 *
 * The logo is read from the shipped `public/` directory at request time and
 * inlined as a data URL (satori cannot fetch relative paths). Standalone builds
 * run with the app directory as cwd, but candidates cover both layouts so a
 * missing file degrades to the text-only card instead of a 500.
 */
async function loadLogo(): Promise<string | null> {
  const candidates = [
    path.join(process.cwd(), 'public', 'logo.png'),
    path.join(process.cwd(), 'apps', 'frontend', 'public', 'logo.png'),
    path.join(process.cwd(), '..', '..', 'apps', 'frontend', 'public', 'logo.png'),
  ];
  for (const file of candidates) {
    try {
      const bytes = await readFile(file);
      return `data:image/png;base64,${bytes.toString('base64')}`;
    } catch {
      continue;
    }
  }
  return null;
}

export default async function OpenGraphImage() {
  const logoSrc = await loadLogo();
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
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          width={430}
          height={336}
          style={{ objectFit: 'contain', marginBottom: 28 }}
        />
      ) : null}{' '}
      <div
        style={{
          display: 'flex',
          fontSize: 72,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.02em',
          textAlign: 'center',
          lineHeight: 1.1,
        }}
      >
        {' '}
        BAROOT CNC SOLUTIONS{' '}
      </div>{' '}
      <div
        style={{
          display: 'flex',
          fontSize: 30,
          fontWeight: 600,
          color: '#C2410C',
          marginTop: 18,
          textAlign: 'center',
          letterSpacing: '0.08em',
        }}
      >
        {' '}
        CNC MACHINING COURSES &amp; CERTIFICATION{' '}
      </div>{' '}
    </div>,
    { ...size },
  );
}
