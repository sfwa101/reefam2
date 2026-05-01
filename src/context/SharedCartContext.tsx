import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "reef.activeSharedCartId";

type Ctx = {
  sharedCartId: string | null;
  setSharedCartId: (id: string | null) => void;
};

const SharedCartCtx = createContext<Ctx | null>(null);

export const SharedCartProvider = ({ children }: { children: ReactNode }) => {
  const [sharedCartId, setSharedCartIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  const setSharedCartId = (id: string | null) => {
    setSharedCartIdState(id);
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  // Cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSharedCartIdState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <SharedCartCtx.Provider value={{ sharedCartId, setSharedCartId }}>
      {children}
    </SharedCartCtx.Provider>
  );
};

export const useSharedCartContext = () => {
  const v = useContext(SharedCartCtx);
  if (!v) throw new Error("useSharedCartContext must be used within SharedCartProvider");
  return v;
};
