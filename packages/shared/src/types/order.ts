export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  tenantId: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  subtotal: number;
  tax: number;
  shipping: number;
  currency: string;
  shippingAddress: Address | null;
  billingAddress: Address | null;
  paymentIntentId: string | null;
  stripeSessionId: string | null;
  medusaOrderId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  productId: string;
  title: string;
  quantity: number;
  price: number;
  thumbnailUrl: string | null;
  isDigital: boolean;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}
