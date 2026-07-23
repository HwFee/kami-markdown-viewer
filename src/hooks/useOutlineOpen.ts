import { useCallback, useEffect, useRef, useState } from "react";
import { getSettingsStore } from "../lib/settings";

const STORE_KEY = "outlineOpen";

function logStoreFailure(operation: string, error: unknown) {
  console.warn(`outlineOpen Store ${operation} failed:`, error);
}

function logPersistenceFailure(operation: string, error: unknown) {
  console.warn(`Failed to ${operation} outlineOpen preference:`, error);
}

export function useOutlineOpen(initialOpen: boolean = false): [boolean, () => void, (open: boolean) => void] {
  const [isOpen, setIsOpen] = useState<boolean>(initialOpen);
  const hasInteracted = useRef(false);

  // 启动时恒为关闭，不恢复上次的开关状态（产品决定：默认关闭侧边栏）。
  // 用户交互后的状态仍会持久化写入（复用共享 settings Store），仅启动时不读取。
  useEffect(() => {
    if (!hasInteracted.current) {
      return;
    }

    async function saveState() {
      try {
        const store = await getSettingsStore();
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
