'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useCartStore } from '@/stores/cart-store';
import { ShoppingBag, Loader2 } from 'lucide-react';
import Link from 'next/link';
export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        {' '}
        <ShoppingBag className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />{' '}
        <h1 className="text-2xl font-bold mb-2">Nothing to check out</h1>{' '}
        <p className="text-muted-foreground mb-6">Your cart is empty.</p>{' '}
        <Button asChild>
          {' '}
          <Link href="/products">Browse Store</Link>{' '}
        </Button>{' '}
      </div>
    );
  }
  const handleCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/payments/checkout', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            title: i.title,
            price: i.price,
            quantity: i.quantity,
            thumbnailUrl: i.thumbnailUrl,
          })),
          successUrl: `${window.location.origin}/checkout/success`,
          cancelUrl: `${window.location.origin}/cart`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        // Only empty the cart when a payment was actually collected. In stub mode
        // (no payment provider configured) the order is recorded but unpaid, so the
        // user keeps their cart and can retry.
        if (data.paymentCollected !== false) clearCart();
        router.push(data.url);
      } else {
        setError(data.message || 'Failed to create checkout session');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="container mx-auto px-4 py-12">
      {' '}
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>{' '}
      <div className="grid gap-8 lg:grid-cols-3">
        {' '}
        <div className="lg:col-span-2 space-y-4">
          {' '}
          <h2 className="font-semibold text-lg">Order Items</h2>{' '}
          {items.map((item) => (
            <Card key={item.productId}>
              {' '}
              <CardContent className="flex items-center gap-4 p-4">
                {' '}
                <div className="aspect-square w-16 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {' '}
                  <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />{' '}
                </div>{' '}
                <div className="flex-1 min-w-0">
                  {' '}
                  <h3 className="font-medium truncate">{item.title}</h3>{' '}
                  <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>{' '}
                </div>{' '}
                <p className="font-semibold">
                  {' '}
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    (item.price * item.quantity) / 100,
                  )}{' '}
                </p>{' '}
              </CardContent>{' '}
            </Card>
          ))}{' '}
        </div>{' '}
        <div>
          {' '}
          <Card>
            {' '}
            <CardHeader>
              {' '}
              <CardTitle>Order Summary</CardTitle>{' '}
            </CardHeader>{' '}
            <CardContent className="space-y-3">
              {' '}
              <div className="flex justify-between text-sm">
                {' '}
                <span className="text-muted-foreground">Subtotal</span>{' '}
                <span>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    total() / 100,
                  )}
                </span>{' '}
              </div>{' '}
              <div className="flex justify-between text-sm">
                {' '}
                <span className="text-muted-foreground">Shipping</span>{' '}
                <span>Calculated at next step</span>{' '}
              </div>{' '}
              <div className="flex justify-between font-semibold border-t pt-3">
                {' '}
                <span>Total</span>{' '}
                <span>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    total() / 100,
                  )}
                </span>{' '}
              </div>{' '}
              {error && <p className="text-sm text-destructive">{error}</p>}{' '}
            </CardContent>{' '}
            <CardFooter className="flex-col gap-2">
              {' '}
              <Button className="w-full" size="lg" disabled={loading} onClick={handleCheckout}>
                {' '}
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{' '}
                {loading ? 'Processing...' : 'Proceed to Payment'}{' '}
              </Button>{' '}
              <Button variant="ghost" size="sm" className="w-full" asChild>
                {' '}
                <Link href="/cart">Back to Cart</Link>{' '}
              </Button>{' '}
            </CardFooter>{' '}
          </Card>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
