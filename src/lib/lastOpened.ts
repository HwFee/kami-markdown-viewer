import { Store } from "@tauri-apps/plugin-store";

const STORE_KEY = "lastOpenedPath";
const STORE_PATH = "settings.json";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = Store.load(STORE_PATH).catch((error) => {
      storePromise = null;
      throw error;
    });
  }
  return storePromise;
}

/** 保存最近打开的文件路径 */
export async function saveLastOpened(path: string): Promise<void> {
  try {
    const store = await getStore();
    await store.set(STORE_KEY, path);
    await store.save();
  } catch {
    // 持久化失败不影响正常使用
  }
}

/** 读取最近打开的文件路径，无记录时返回 null */
export async function loadLastOpened(): Promise<string | null> {
  try {
    const store = await getStore();
    const value = await store.get<string>(STORE_KEY);
    return value ?? null;
  } catch {
    return null;
  }
}
