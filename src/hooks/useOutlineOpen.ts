import { useCallback, useEffect, useRef, useState } from "react";
import { Store } from "@tauri-apps/plugin-store";

const STORE_KEY = "outlineOpen";
const STORE_PATH = "settings.json";

function logStoreFailure(operation: string, error: unknown) {
  console.warn(`outlineOpen Store ${operation} failed:`, error);
}

function logPersistenceFailure(operation: string, error: unknown) {
  console.warn(`Failed to ${operation} outlineOpen preference:`, error);
}

export function useOutlineOpen(initialOpen: boolean = false): [boolean, () => void, (open: boolean) => void] {
  const [isOpen, setIsOpen] = useState<boolean>(initialOpen);
  const hasInteracted = useRef(false);
  // 缓存 Store 实例（以 promise 形式），避免每次读写都重新 Store.load；
  // 加载失败时不缓存，让下次操作可以重试
  const storePromiseRef = useRef<Promise<Store> | null>(null);

  function getStore(): Promise<Store> {
    if (!storePromiseRef.current) {
      storePromiseRef.current = Store.load(STORE_PATH).catch((error) => {
        storePromiseRef.current = null;
        throw error;
      });
    }
    return storePromiseRef.current;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        const store = await getStore();
        const value = await store.get<boolean>(STORE_KEY);
        if (!cancelled && value !== undefined && !hasInteracted.current) {
          setIsOpen(value);
        }
      } catch (storeError) {
        logStoreFailure("load", storeError);
        try {
          const localValue = localStorage.getItem(STORE_KEY);
          if (!cancelled && localValue !== null && !hasInteracted.current) {
            setIsOpen(localValue === "true");
          }
        } catch (localError) {
          logPersistenceFailure("load", localError);
        }
      }
    }

    void loadState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasInteracted.current) {
      return;
    }

    async function saveState() {
      try {
        const store = await getStore();
        await store.set(STORE_KEY, isOpen);
        await store.save();
      } catch (storeError) {
        logStoreFailure("save", storeError);
        try {
          localStorage.setItem(STORE_KEY, String(isOpen));
        } catch (localError) {
          logPersistenceFailure("save", localError);
        }
      }
    }

    void saveState();
  }, [isOpen]);

  const toggle = useCallback(() => {
    hasInteracted.current = true;
    setIsOpen((open) => !open);
  }, []);

  const setOpen = useCallback((open: boolean) => {
    hasInteracted.current = true;
    setIsOpen(open);
  }, []);

  return [isOpen, toggle, setOpen];
}
