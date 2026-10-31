import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, XCircle } from 'lucide-react';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { serverApiUrl } from '@/lib/server-api-url';
import { Reveal } from '@/components/ui/motion';

/**
 * Reads the tenant from a cookie, so this route cannot be statically generated. Same
 * DYNAMIC_SERVER_USAGE 500 as academy/[slug]; freshness belongs on the fetch, not the segment.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ number: string }> };

async function fetchCert(tenantSlug: string, number: string) {
  try {
    const res = await fetch(
      `${serverApiUrl()}/certifications/verify/${encodeURIComponent(number)}`,
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
  const t = await getTranslations('pages.certificateVerify');
  const { number } = await props.params;
  return {
    title: t('metaTitle', { number }),
    description: t('metaDescription'),
    alternates: { canonical: `/verify/${number}` },
  };
}

export default async function VerifyNumberPage(props: Props) {
  const t = await getTranslations('pages.certificateVerify');
  const { number } = await props.params;
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const cert = await fetchCert(tenantSlug, number);

  return (
    <div className="container mx-auto max-w-xl px-4 pb-24 pt-16 md:pt-20">
      <Link
        href="/verify"
        className="group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <span
          aria-hidden
          className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5 rtl:rotate-180"
        >
          ←
        </span>{' '}
        {t('verifyAnother')}
      </Link>
      <Reveal className="relative mt-6 overflow-hidden rounded-3xl border border-border/70 bg-card px-8 py-12 text-center shadow-sm">
        <div aria-hidden className="pointer-events-none absolute inset-0 ambient-wash opacity-60" />
        <div className="relative">
          {cert === undefined ? (
            <>
              <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-muted ring-1 ring-inset ring-border/70">
                <XCircle className="size-7 text-muted-foreground" />
              </span>
              <h1 className="font-display text-3xl font-medium tracking-[-0.022em]">
                {t('unavailableTitle')}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('unavailableHint')}</p>
            </>
          ) : cert === null ? (
            <>
              <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/[0.08] ring-1 ring-inset ring-destructive/20">
                <XCircle className="size-7 text-destructive" />
              </span>
              <h1 className="font-display text-3xl font-medium tracking-[-0.022em]">
                {t('notFoundTitle')}
              </h1>
              <p className="mt-3 inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-sm text-muted-foreground">
                {number}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{t('notFoundHint')}</p>
            </>
          ) : (
            <>
              <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-success/10 shadow-[0_0_0_8px_rgb(var(--c-success)/0.05)] ring-1 ring-inset ring-success/20">
                <BadgeCheck className="size-8 text-success" />
              </span>
              <h1 className="font-display text-3xl font-medium tracking-[-0.022em]">
                {t('validTitle')}
              </h1>
              <p className="mt-3 inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-sm">
                {cert.certificateNumber}
              </p>
              {cert.user?.name && (
                <p className="mt-6 font-display text-2xl font-medium tracking-[-0.015em]">
                  {cert.user.name}
                </p>
              )}
              {cert.course?.title && (
                <p className="text-sm text-muted-foreground">{cert.course.title}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {t('issued', { date: new Date(cert.issuedAt).toLocaleDateString() })}
              </p>
            </>
          )}
        </div>
      </Reveal>
    </div>
  );
}
