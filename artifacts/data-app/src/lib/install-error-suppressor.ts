const THREE_LOADER_PATTERNS = [
  /THREE\.GLTFLoader/i,
  /THREE\.TextureLoader/i,
  /THREE\.FileLoader/i,
  /Failed to load buffer/i,
  /Couldn't load texture/i,
  /Could not load \/api\/storage/i,
  /Error creating WebGL context/i,
  /WebGL context could not be created/i,
];

function isThreeLoaderError(message: unknown): boolean {
  if (typeof message !== "string") return false;
  return THREE_LOADER_PATTERNS.some((re) => re.test(message));
}

export function installErrorSuppressor() {
  if (typeof window === "undefined") return;

  window.addEventListener(
    "error",
    (event) => {
      const msg = event.message ?? event.error?.message ?? "";
      if (isThreeLoaderError(msg)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const reason = event.reason;
      const msg =
        typeof reason === "string"
          ? reason
          : reason?.message ?? "";
      if (isThreeLoaderError(msg)) {
        event.preventDefault();
      }
    },
    true,
  );
}
