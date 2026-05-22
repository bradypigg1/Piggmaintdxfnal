import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Lock } from "lucide-react";

const STORAGE_KEY = "piggtdx:site-unlocked";
const SITE_PASSWORD =
  (import.meta.env.VITE_SITE_PASSWORD as string | undefined) ?? "piggtdx";

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (value === SITE_PASSWORD) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
      setUnlocked(true);
      setError("");
    } else {
      setError("Incorrect password. Please try again.");
      setValue("");
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-wide text-foreground">
            PIGGTDX
          </h1>
          <p className="mt-1 text-sm uppercase tracking-widest text-muted-foreground">
            Parts &amp; Inventory 3D Viewer
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            This site is private. Enter the access password to continue.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label
            htmlFor="site-password"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Access Password
          </label>
          <input
            id="site-password"
            data-testid="input-site-password"
            type="password"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError("");
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            placeholder="Enter password"
          />
          {error ? (
            <p
              data-testid="text-password-error"
              className="text-xs text-red-500"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            data-testid="button-unlock"
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
          >
            Unlock Site
          </button>
        </form>
      </div>
    </div>
  );
}
