'use client';
import { useCallback, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export type OrderLineType = 'course' | 'product' | 'event_ticket';

export interface CheckoutLine {
  itemType: OrderLineType;
  refId: string;
  quantity?: number;
  variantId?: string;
}

export interface CreatedOrder {
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  publishableKey: string | null;
  liveMode: boolean;
}

export interface OrderView {
  id: string;
  status: string;
  total: number;
  currency: string;
  provider: string;
  providerPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    itemType: string;
    title: string;
    quantity: number;
    unitAmountCents: number;
    currency: string;
    fulfillmentState: string;
  }>;
}

/**
 * Every purchasable thing enters the gateway the same way: build lines, create a
 * pending order, then let Moyasar collect the money. A course, a store product
 * and an event ticket differ only in `itemType`.
 */
export function useCreateOrder() {
  return useMutation({
    mutationFn: (input: { lines: CheckoutLine[]; idempotencyKey?: string; successUrl?: string; cancelUrl?: string }) =>
      api.post<CreatedOrder>('/payments/moyasar/create-order', input),
  });
}

/** Start a purchase and hand the payer to the checkout form. */
export function useBuyAndCheckout() {
  const [pending, setPending] = useState<string | null>(null);
  const create = useCreateOrder();

  const buy = useCallback(
    async (lines: CheckoutLine[]) => {
      setPending('starting');
      try {
        const order = await create.mutateAsync({
          lines,
          // One idempotency key per click: a double click cannot make two orders.
          idempotencyKey:
            typeof crypto !== 'undefined' ? crypto.randomUUID() : `k-${Date.now()}-${Math.random()}`,
          successUrl: `${window.location.origin}/checkout/success`,
          cancelUrl: `${window.location.origin}/cart`,
        });
        // The checkout page takes over and renders the gateway form.
        window.location.href = `/checkout?order=${order.orderId}`;
        return order;
      } finally {
        setPending(null);
      }
    },
    [create],
  );

  return { buy, pending, isPending: create.isPending };
}

export function usePaymentConfig(enabled = true) {
  return useQuery({
    queryKey: ['payments', 'config'],
    queryFn: () =>
      api.get<{
        data: {
          publishableKey: string | null;
          currency: string;
          liveMode: boolean;
          enabled: boolean;
          status: string;
        };
      }>('/payments/moyasar/config'),
    enabled,
    staleTime: 60_000,
  });
}

export function useMyOrders(enabled = true) {
  const query = useQuery({
    queryKey: ['payments', 'orders', 'mine'],
    queryFn: () => api.get<{ data: OrderView[] }>('/payments/orders/mine'),
    enabled,
  });
  return { ...query, orders: query.data?.data ?? [] };
}

export function useMyOrder(orderId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['payments', 'orders', orderId],
    queryFn: () => api.get<{ data: OrderView }>(`/payments/orders/${orderId}`),
    enabled: enabled && !!orderId,
  });
}
