'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle, Clock } from 'lucide-react';
type OrderStatus = 'pending' | 'confirmed' | 'failed' | 'expired';
export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const orderIdParam = searchParams.get('orderId');
  const [status, setStatus] = useState<OrderStatus | 'verifying'>('verifying');
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchOrder = useCallback(async () => {
    const id = orderIdParam;
    const sid = sessionId;
    if (!id && !sid) {
      setError('Missing order reference');
      setStatus('pending');
      return null;
    }
    try {
      const url = sid
        ? `/api/proxy/payments/orders/by-session/${encodeURIComponent(sid)}`
        : `/api/proxy/payments/orders/${encodeURIComponent(id!)}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`Order lookup failed (${res.status})`);
      const data = await res.json();
      setOrder(data);
      const s = (data.status as OrderStatus) || 'pending';
      setStatus(s);
      return s;
    } catch (e: any) {
      setError(e.message || 'Failed to verify order');
      return null;
    }
  }, [orderIdParam, sessionId]);
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15; // ~30s
const poll = async () => {
      if (cancelled) return;
      const s = await fetchOrder();
      if (cancelled) return;
      if (s === 'confirmed' || s === 'failed' || s === 'expired') return;
      attempts += 1;
      if (attempts < maxAttempts) setTimeout(poll, 2000);
      else setStatus((prev) => (prev === 'verifying' ? 'pending' : prev));
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [fetchOrder]);
  if (status === 'verifying' || (status === 'pending' && !error)) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        {' '}
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />{' '}
        <h1 className="text-2xl font-bold mb-2">Verifying your order...</h1>{' '}
        <p className="text-muted-foreground text-sm">
          We’re confirming your payment with Stripe. No confirmation without a verified webhook.
        </p>{' '}
        {order && (
          <p className="text-xs text-muted-foreground mt-2">
            Order {order.id.slice(0, 8)}… status: {order.status}
          </p>
        )}{' '}
      </div>
    );
  }
  if (error) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        {' '}
        <XCircle className="mx-auto h-16 w-16 text-amber-500 mb-4" />{' '}
        <h1 className="text-2xl font-bold mb-2">We couldn’t verify your order</h1>{' '}
        <p className="text-muted-foreground mb-2">{error}</p>{' '}
        <p className="text-xs text-muted-foreground mb-6">
          If you completed payment, webhook confirmation may still be processing. Refresh in a few
          seconds.
        </p>{' '}
        <div className="flex justify-center gap-4">
          {' '}
          <Button onClick={() => window.location.reload()}>Retry</Button>{' '}
          <Button variant="outline" asChild>
            <Link href="/products">Continue Shopping</Link>
          </Button>{' '}
        </div>{' '}
      </div>
    );
  }
  if (status === 'confirmed') {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        {' '}
        <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />{' '}
        <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>{' '}
        <p className="text-muted-foreground mb-2">
          Thank you — your payment was verified via Stripe.
        </p>{' '}
        {order && (
          <p className="text-xs text-muted-foreground mb-6">
            Order {order.id} · ${(order.total / 100).toFixed(2)}
          </p>
        )}{' '}
        <div className="flex justify-center gap-4">
          {' '}
          <Button asChild>
            <Link href="/products">Continue Shopping</Link>
          </Button>{' '}
          <Button variant="outline" asChild>
            <Link href="/">Back to Home</Link>
          </Button>{' '}
        </div>{' '}
      </div>
    );
  }
  if (status === 'failed' || status === 'expired') {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        {' '}
        <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />{' '}
        <h1 className="text-2xl font-bold mb-2">
          {status === 'expired' ? 'Checkout expired' : 'Payment failed'}
        </h1>{' '}
        <p className="text-muted-foreground mb-6">
          Your order is marked <span className="font-mono">{status}</span>. Please try again.
        </p>{' '}
        <div className="flex justify-center gap-4">
          {' '}
          <Button asChild>
            <Link href="/products">Try Again</Link>
          </Button>{' '}
          <Button variant="outline" asChild>
            <Link href="/">Back to Home</Link>
          </Button>{' '}
        </div>{' '}
      </div>
    );
  } // pending but not verifying (max attempts reached)
return (
    <div className="container mx-auto px-4 py-24 text-center">
      {' '}
      <Clock className="mx-auto h-16 w-16 text-amber-500 mb-4" />{' '}
      <h1 className="text-2xl font-bold mb-2">Payment pending</h1>{' '}
      <p className="text-muted-foreground mb-6">
        We haven’t received Stripe confirmation yet. You’ll be notified when it’s verified.
      </p>{' '}
      <Button onClick={() => window.location.reload()}>Refresh status</Button>{' '}
    </div>
  );
}
