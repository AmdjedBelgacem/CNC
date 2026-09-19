import { NextRequest, NextResponse } from 'next/server';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
