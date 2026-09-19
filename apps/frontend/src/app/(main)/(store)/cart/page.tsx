'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useCartStore } from '@/stores/cart-store';
import { Trash2, Minus, Plus, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
export default function CartPage() {
  const { items, removeItem, updateQuantity, total, itemCount } = useCartStore();
  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        {' '}
        <ShoppingBag className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />{' '}
        <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>{' '}
        <p className="text-muted-foreground mb-6">Add some tools to get started.</p>{' '}
        <Button asChild>
          {' '}
          <Link href="/products">Browse Store</Link>{' '}
        </Button>{' '}
      </div>
    );
  }
  return (
    <div className="container mx-auto px-4 py-12">
      {' '}
      <h1 className="text-3xl font-bold mb-8">Shopping Cart ({itemCount()} items)</h1>{' '}
      <div className="grid gap-8 lg:grid-cols-3">
        {' '}
        <div className="lg:col-span-2 space-y-4">
          {' '}
          {items.map((item) => (
            <Card key={item.productId}>
              {' '}
              <CardContent className="flex items-center gap-4 p-4">
                {' '}
                <div className="aspect-square w-20 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {' '}
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />{' '}
                </div>{' '}
                <div className="flex-1 min-w-0">
                  {' '}
                  <h3 className="font-semibold truncate">{item.title}</h3>{' '}
                  <p className="text-sm text-muted-foreground">
                    {' '}
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      item.price / 100,
                    )}{' '}
                  </p>{' '}
                </div>{' '}
                <div className="flex items-center gap-2">
                  {' '}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.productId, Math.max(0, item.quantity - 1))}
                  >
                    {' '}
                    <Minus className="h-3 w-3" />{' '}
                  </Button>{' '}
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>{' '}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    {' '}
                    <Plus className="h-3 w-3" />{' '}
                  </Button>{' '}
                </div>{' '}
                <p className="font-semibold w-24 text-right">
                  {' '}
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                    (item.price * item.quantity) / 100,
                  )}{' '}
                </p>{' '}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeItem(item.productId)}
                >
                  {' '}
                  <Trash2 className="h-4 w-4" />{' '}
                </Button>{' '}
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
                <span>Calculated at checkout</span>{' '}
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
            </CardContent>{' '}
            <CardFooter>
              {' '}
              <Button className="w-full" asChild>
                {' '}
                <Link href="/checkout">Proceed to Checkout</Link>{' '}
              </Button>{' '}
            </CardFooter>{' '}
          </Card>{' '}
        </div>{' '}
      </div>{' '}
    </div>
  );
}
