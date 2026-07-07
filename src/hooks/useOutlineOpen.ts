import { useCallback, useEffect, useRef, useState } from "react";
import { Store } from "@tauri-apps/plugin-store";

const STORE_KEY = "outlineOpen";
const STORE_PATH = "settings.json";

export function useOutlineOpen(initialOpen: boolean = false): [boolean, () => void, (open: boolean) => void] {
  const [isOpen, setIsOpen] = useState<boolean>(initialOpen);
  const isInitialMount = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        const store = await Store.load(STORE_PATH);
        const value = await store.get<boolean>(STORE_KEY);
        if (!cancelled && value !== undefined) {
          setIsOpen(value);
        }
      } catch {
        try {
          const localValue = localStorage.getItem(STORE_KEY);
          if (!cancelled && localValue !== null) {
            setIsOpen(localValue === "true");
          }
        } catch {
          // ignore persistence failures
        }
      }
    }

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [initialOpen]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    async function saveState() {
      try {
        const store = await Store.load(STORE_PATH);
        await store.set(STORE_KEY, isOpen);
        await store.save();
      } catch {
        try {
          localStorage.setItem(STORE_KEY, String(isOpen));
        } catch {
          // ignore persistence failures
        }
      }
    }

    void saveState();
  }, [isOpen]);

  const toggle = useCallback(() => setIsOpen((open) => !open), []);
  const setOpen = useCallback((open: boolean) => setIsOpen(open), []);

  return [isOpen, toggle, setOpen];
}
