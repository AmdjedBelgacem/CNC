import { NextRequest, NextResponse } from 'next/server';
import { serverApiUrl } from '@/lib/server-api-url';
/** Server-side only: prefer the Vercel service binding over the public URL. */
const API_BASE = serverApiUrl();
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_BASE}/tenants/${slug}`);
    if (!res.ok) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tenant' }, { status: 502 });
  }
}
