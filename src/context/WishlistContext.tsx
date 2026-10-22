import {durableStorage} from "../services/durableStorage";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

interface WishlistContextType {
  wishlist: string[]; // array of product codes
  isInWishlist: (code: string) => boolean;
  toggleWishlist: (code: string) => void;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(
  undefined,
);

const WISHLIST_STORAGE_KEY = "hyper_sanat_wishlist_v1";

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentUser } = useAuth();
  const storageKey = `${WISHLIST_STORAGE_KEY}:${currentUser?.id || "guest"}`;
  const read = (key: string): string[] => {
    try {
      const data = JSON.parse(durableStorage.getItem(key) || "[]");
      return Array.isArray(data)
        ? data.filter((x) => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  };
  const [state, setState] = useState(() => ({
    key: storageKey,
    items: read(storageKey),
  }));
  const wishlist = state.key === storageKey ? state.items : [];
  const setWishlist = (update: string[] | ((items: string[]) => string[])) =>
    setState((previous) => {
      const items =
        previous.key === storageKey ? previous.items : read(storageKey);
      return {
        key: storageKey,
        items: typeof update === "function" ? update(items) : update,
      };
    });
  useEffect(() => {
    setState((previous) =>
      previous.key === storageKey
        ? previous
        : { key: storageKey, items: read(storageKey) },
    );
  }, [storageKey]);
  useEffect(() => {
    if (state.key === storageKey)
      try {
        durableStorage.setItem(storageKey, JSON.stringify(state.items));
      } catch {}
  }, [state, storageKey]);

  const isInWishlist = (code: string) => wishlist.includes(code);

  const toggleWishlist = (code: string) => {
    setWishlist((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const clearWishlist = () => {
    setWishlist([]);
  };

  return (
    <WishlistContext.Provider
      value={{ wishlist, isInWishlist, toggleWishlist, clearWishlist }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context)
    throw new Error("useWishlist must be used within a WishlistProvider");
  return context;
};
