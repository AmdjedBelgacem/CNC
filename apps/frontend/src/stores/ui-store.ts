import { create } from 'zustand';
interface UIState {
  sidebarOpen: boolean;
  cartOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setCartOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleCart: () => void;
}
export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: false,
  cartOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setCartOpen: (cartOpen) => set({ cartOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleCart: () => set((s) => ({ cartOpen: !s.cartOpen })),
}));
