'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useToast } from '@/components/ui/use-toast';
import type { Product } from '@/lib/data';

export type SubscriptionDuration = 'monthly' | 'annual' | 'per_user';

export type CartItem = Product & {
  subscriptionDuration: SubscriptionDuration;
  quantity: number;
  cartId: string;
};

type CartContextValue = {
  cartItems: CartItem[];
  addToCart: (product: Product, subscriptionDuration?: SubscriptionDuration, quantity?: number) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  updateSubscriptionDuration: (cartId: string, duration: SubscriptionDuration) => void;
  clearCart: () => void;
  getItemPrice: (item: CartItem) => number;
  getCartTotal: () => number;
  getCartItemCount: () => number;
  isInCart: (productId: string) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export const useCart = (): CartContextValue => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      setCartItems(JSON.parse(saved) as CartItem[]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems, hydrated]);

  const addToCart: CartContextValue['addToCart'] = (product, subscriptionDuration = 'monthly', quantity = 1) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.id === product.id && item.subscriptionDuration === subscriptionDuration,
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        toast({ title: 'Cart updated', description: `${product.name} quantity increased.` });
        return updated;
      }
      const newItem: CartItem = {
        ...product,
        subscriptionDuration,
        quantity,
        cartId: `${product.id}-${subscriptionDuration}-${Date.now()}`,
      };
      toast({ title: 'Added to cart', description: `${product.name} has been added to your cart.` });
      return [...prev, newItem];
    });
  };

  const removeFromCart = (cartId: string) => {
    setCartItems((prev) => {
      const item = prev.find((i) => i.cartId === cartId);
      if (item) {
        toast({
          title: 'Removed from cart',
          description: `${item.name} has been removed from your cart.`,
        });
      }
      return prev.filter((i) => i.cartId !== cartId);
    });
  };

  const updateQuantity = (cartId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartId);
      return;
    }
    setCartItems((prev) => prev.map((item) => (item.cartId === cartId ? { ...item, quantity } : item)));
  };

  const updateSubscriptionDuration = (cartId: string, duration: SubscriptionDuration) => {
    setCartItems((prev) =>
      prev.map((item) => (item.cartId === cartId ? { ...item, subscriptionDuration: duration } : item)),
    );
  };

  const clearCart = () => {
    setCartItems([]);
    toast({ title: 'Cart cleared', description: 'All items have been removed from your cart.' });
  };

  const getItemPrice = (item: CartItem): number => {
    switch (item.subscriptionDuration) {
      case 'annual':
        return item.price_annual ?? 0;
      case 'per_user':
        return item.price_per_user ?? 0;
      case 'monthly':
      default:
        return item.price_monthly ?? 0;
    }
  };

  const getCartTotal = () =>
    cartItems.reduce((total, item) => total + getItemPrice(item) * item.quantity, 0);

  const getCartItemCount = () =>
    cartItems.reduce((count, item) => count + item.quantity, 0);

  const isInCart = (productId: string) => cartItems.some((item) => item.id === productId);

  const value: CartContextValue = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateSubscriptionDuration,
    clearCart,
    getItemPrice,
    getCartTotal,
    getCartItemCount,
    isInCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
