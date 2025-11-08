const STORAGE_PREFIX = 'pydah_stationery_';

const getStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
};

export const loadJSON = (key, fallback) => {
  try {
    const storage = getStorage();
    if (!storage) return fallback;
    const raw = storage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to load "${key}" from storage:`, error);
    return fallback;
  }
};

export const saveJSON = (key, value) => {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save "${key}" to storage:`, error);
  }
};

export const removeStoredItem = (key) => {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch (error) {
    console.warn(`Failed to remove "${key}" from storage:`, error);
  }
};

