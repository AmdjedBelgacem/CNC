import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { BadgeCheck, XCircle } from 'lucide-react';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';

/**
 * Reads the tenant from a cookie, so this route cannot be statically generated. Same
 * DYNAMIC_SERVER_USAGE 500 as academy/[slug]; freshness belongs on the fetch, not the segment.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ number: string }> };

async function fetchCert(tenantSlug: string, number: string) {
  try {
    const res = await fetch(
      `${process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/certifications/verify/${encodeURIComponent(number)}`,
      { headers: { 'x-tenant-slug': tenantSlug }, next: { revalidate: 60 } },
    );
    if (res.status === 404) return null;
    if (!res.ok) return undefined;
    return (await res.json()) as {
      certificateNumber: string;
      issuedAt: string;
      user?: { name?: string | null };
      course?: { title?: string | null };
    } | null;
  } catch {
    return undefined;
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { number } = await props.params;
  return {
    title: `Verify ${number}`,
    description: 'Verify a TITANS manufacturing certificate.',
    alternates: { canonical: `/verify/${number}` },
  };
}

export default async function VerifyNumberPage(props: Props) {
  const { number } = await props.params;
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const cert = await fetchCert(tenantSlug, number);

  return (
    <div className="container mx-auto max-w-xl px-4 py-16">
      <Link href="/verify" className="text-sm text-muted-foreground hover:text-foreground">
        ← Verify another
      </Link>
      <div className="mt-6 rounded-3xl border bg-card p-8 text-center">
        {cert === undefined ? (
          <>
            <XCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h1 className="text-2xl font-bold">Verification unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The verification service did not respond. Make sure the backend is running.
            </p>
          </>
        ) : cert === null ? (
          <>
            <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h1 className="text-2xl font-bold">Certificate not found</h1>
            <p className="mt-2 font-mono text-sm text-muted-foreground">{number}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              No credential with this number exists. Check for typos.
            </p>
          </>
        ) : (
          <>
            <BadgeCheck className="mx-auto mb-4 h-12 w-12 text-success" />
            <h1 className="text-2xl font-bold">Valid certificate</h1>
            <p className="mt-2 font-mono text-sm">{cert.certificateNumber}</p>
            {cert.user?.name && <p className="mt-3 text-lg font-semibold">{cert.user.name}</p>}
            {cert.course?.title && (
              <p className="text-sm text-muted-foreground">{cert.course.title}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Issued {new Date(cert.issuedAt).toLocaleDateString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
