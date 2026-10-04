import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_CURRENCY } from '@titan/shared';
import { trackAddToCart } from '@/lib/analytics';
interface CartItem {
  productId: string;
  title: string;
  price: number;
  /** Currency the stored `price` is held in; the cart converts for display. */
  currency: string;
  quantity: number;
  thumbnailUrl?: string;
}
interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity' | 'currency'> & { currency?: string }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
  itemCount: () => number;
}
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const items = get().items;
        const currency = item.currency || DEFAULT_CURRENCY;
        const existing = items.find((i) => i.productId === item.productId);
        if (existing) {
          set({
            items: items.map((i) =>
              i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i,
            ),
          });
        } else {
          set({ items: [...items, { ...item, currency, quantity: 1 }] });
        }
        trackAddToCart({
          productId: item.productId,
          title: item.title,
          price: item.price,
          quantity: 1,
        });
      },
      removeItem: (productId) =>
        set({ items: get().items.filter((i) => i.productId !== productId) }),
      updateQuantity: (productId, quantity) =>
        set({
          items: get().items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
        }),
      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'cart-storage' },
  ),
);
