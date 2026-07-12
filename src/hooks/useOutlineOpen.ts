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

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        const store = await Store.load(STORE_PATH);
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
        const store = await Store.load(STORE_PATH);
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
