type StorageItems = Record<string, unknown>;

type StorageArea = {
  get(
    keys: StorageItems,
    callback?: (items: StorageItems) => void
  ): Promise<StorageItems> | void;
  set(items: StorageItems, callback?: () => void): Promise<void> | void;
};

type ExtensionApi = {
  storage: { local: StorageArea };
  runtime: { getURL(path: string): string };
};

type GlobalWithExtensionApis = typeof globalThis & {
  browser?: ExtensionApi;
  chrome?: ExtensionApi;
};

function getExtensionApi(): ExtensionApi {
  const globals = globalThis as GlobalWithExtensionApis;
  const api = globals.browser ?? globals.chrome;
  if (!api) {
    throw new Error("Markdown Monroe extension APIs are unavailable");
  }
  return api;
}

function getStorageValue<T>(
  area: StorageArea,
  key: string,
  fallback: T
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value: T) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      const result = area.get({ [key]: fallback }, (items) => {
        finish((items[key] as T | undefined) ?? fallback);
      });

      if (result && typeof result.then === "function") {
        result.then((items) => {
          finish((items[key] as T | undefined) ?? fallback);
        }, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

function setStorageValue(area: StorageArea, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    try {
      const result = area.set({ [key]: value }, finish);
      if (result && typeof result.then === "function") {
        result.then(finish, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

export async function readPreference<T>(key: string, fallback: T): Promise<T> {
  try {
    return await getStorageValue(getExtensionApi().storage.local, key, fallback);
  } catch {
    return fallback;
  }
}

export async function writePreference(key: string, value: unknown): Promise<void> {
  try {
    await setStorageValue(getExtensionApi().storage.local, key, value);
  } catch {
    // Preferences are an enhancement; a browser policy or private window may deny storage.
  }
}

export function extensionUrl(path: string): string {
  return getExtensionApi().runtime.getURL(path);
}
