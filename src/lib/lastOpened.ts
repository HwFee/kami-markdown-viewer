import { getSettingsStore } from "./settings";

const STORE_KEY = "lastOpenedPath";

/** 保存最近打开的文件路径 */
export async function saveLastOpened(path: string): Promise<void> {
  try {
    const store = await getSettingsStore();
    await store.set(STORE_KEY, path);
    await store.save();
  } catch {
    // 持久化失败不影响正常使用
  }
}

/** 读取最近打开的文件路径，无记录时返回 null */
export async function loadLastOpened(): Promise<string | null> {
  try {
    const store = await getSettingsStore();
    const value = await store.get<string>(STORE_KEY);
    return value ?? null;
  } catch {
    return null;
  }
}
