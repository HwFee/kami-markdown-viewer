import { Store } from "@tauri-apps/plugin-store";

const STORE_PATH = "scroll-positions.json";

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

/** 保存文件的阅读位置（滚动比例 0–1），窗口尺寸变化后仍能大致还原 */
export async function saveScrollPosition(path: string, ratio: number): Promise<void> {
  try {
    const store = await getStore();
    await store.set(path, ratio);
    await store.save();
  } catch {
    // 持久化失败不影响正常使用
  }
}

/** 读取文件的阅读位置，无记录时返回 null */
export async function loadScrollPosition(path: string): Promise<number | null> {
  try {
    const store = await getStore();
    const value = await store.get<number>(path);
    return typeof value === "number" && value >= 0 && value <= 1 ? value : null;
  } catch {
    return null;
  }
}
