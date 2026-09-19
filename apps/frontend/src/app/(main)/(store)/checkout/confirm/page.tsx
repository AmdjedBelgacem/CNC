import { redirect } from 'next/navigation';

/**
 * Legacy compatibility route.
 *
 * The payments API used to return `/checkout/confirm?orderId=…`, but no such route ever
 * existed — every checkout dead-ended in a 404 *after* the order row had been written.
 * The API now returns `/checkout/success?orderId=…`, and this page keeps any already
 * issued / bookmarked / in-flight link working by redirecting to the real page.
 */
export default async function CheckoutConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp.orderId;
  const orderId = Array.isArray(raw) ? raw[0] : raw;
  const sessionId = Array.isArray(sp.session_id) ? sp.session_id[0] : sp.session_id;

  if (sessionId) redirect(`/checkout/success?session_id=${encodeURIComponent(sessionId)}`);
  if (orderId) redirect(`/checkout/success?orderId=${encodeURIComponent(orderId)}`);
  redirect('/checkout/success');
}
