import { useCallback, useEffect, useState } from "react";

const MODEL_STORAGE_KEY = "data-app:selectedModelId";
const COMPONENT_STORAGE_KEY = "data-app:selectedComponentId";

function readNumber(key: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function writeNumber(key: string, value: number | null) {
  if (typeof window === "undefined") return;
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value.toString());
}

/**
 * Persist the selected model + component across tab navigations and page reloads.
 *
 * Reads initial value from URL query params first (so a deep link wins),
 * then falls back to localStorage. Whenever a value is set, it writes both
 * to localStorage and updates the workspace URL when the workspace page is active.
 */
export function useSelectedModel() {
  const [modelId, setModelIdState] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("modelId");
    if (fromUrl) {
      const n = parseInt(fromUrl, 10);
      if (Number.isFinite(n)) return n;
    }
    return readNumber(MODEL_STORAGE_KEY);
  });

  const [componentId, setComponentIdState] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("componentId");
    if (fromUrl) {
      const n = parseInt(fromUrl, 10);
      if (Number.isFinite(n)) return n;
    }
    return readNumber(COMPONENT_STORAGE_KEY);
  });

  // Sync across tabs/windows of the same origin.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === MODEL_STORAGE_KEY) {
        setModelIdState(e.newValue ? parseInt(e.newValue, 10) : null);
      } else if (e.key === COMPONENT_STORAGE_KEY) {
        setComponentIdState(e.newValue ? parseInt(e.newValue, 10) : null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSelection = useCallback(
    (mId: number | null, cId: number | null) => {
      writeNumber(MODEL_STORAGE_KEY, mId);
      writeNumber(COMPONENT_STORAGE_KEY, cId);
      setModelIdState(mId);
      setComponentIdState(cId);

      // Mirror into URL only when on workspace ("/") so deep links keep working.
      if (typeof window !== "undefined") {
        const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
        const path = window.location.pathname;
        const onWorkspace = path === base + "/" || path === base || path === "/";
        if (onWorkspace) {
          const params = new URLSearchParams();
          if (mId !== null) params.set("modelId", mId.toString());
          if (cId !== null) params.set("componentId", cId.toString());
          const qs = params.toString();
          const newUrl = qs ? `${path}?${qs}` : path;
          window.history.replaceState(null, "", newUrl);
        }
      }
    },
    [],
  );

  return { modelId, componentId, setSelection };
}
