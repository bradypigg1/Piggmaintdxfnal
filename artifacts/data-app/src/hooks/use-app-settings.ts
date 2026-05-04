import { useCallback, useEffect, useState } from "react";

const AUTO_ROTATE_KEY = "data-app:autoRotate3D";

function readBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "true";
}

function writeBool(key: string, value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value ? "true" : "false");
}

/**
 * Persist the "auto-rotate 3D models when idle" preference across page
 * navigations and tab reloads. Mirrors the storage pattern used by
 * use-selected-model so multiple tabs stay in sync via the `storage` event.
 */
export function useAutoRotate(): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => readBool(AUTO_ROTATE_KEY, false));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTO_ROTATE_KEY) {
        setValue(e.newValue === "true");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = useCallback((next: boolean) => {
    writeBool(AUTO_ROTATE_KEY, next);
    setValue(next);
  }, []);

  return [value, set];
}
