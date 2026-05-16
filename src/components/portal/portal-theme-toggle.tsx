"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type PortalThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "athenemy-portal-theme";
const THEME_CHANGE_EVENT = "athenemy-portal-theme-change";
const modes = [
  { value: "system", label: "Use portal default", icon: Monitor },
  { value: "light", label: "Use light mode", icon: Sun },
  { value: "dark", label: "Use dark mode", icon: Moon },
] as const;

export function PortalThemeToggle({
  defaultTheme,
  portalSlug,
}: {
  defaultTheme: PortalThemeMode;
  portalSlug: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const storageKey = `${STORAGE_KEY}:${portalSlug}`;
  const mode = useSyncExternalStore(
    subscribeToThemeChanges,
    () => readStoredTheme(storageKey) ?? defaultTheme,
    () => defaultTheme,
  );

  const applyTheme = useCallback(
    (nextMode: PortalThemeMode) => {
      const portal = rootRef.current?.closest<HTMLElement>(".portal-surface");
      portal?.setAttribute(
        "data-portal-theme",
        resolveTheme(nextMode, defaultTheme),
      );
    },
    [defaultTheme],
  );

  useEffect(() => {
    applyTheme(mode);
  }, [applyTheme, mode]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme(mode);
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [applyTheme, mode]);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Portal color theme"
      className="inline-flex h-9 items-center gap-1 rounded-md border border-[color:var(--portal-border)] bg-[color:var(--portal-card)] p-1"
    >
      {modes.map(({ value, label, icon: Icon }) => {
        const isActive = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-[color:var(--portal-panel)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--portal-primary-text)]",
              isActive &&
                "bg-[color:var(--portal-primary)] text-[color:var(--portal-primary-foreground)] hover:bg-[color:var(--portal-primary)] hover:text-[color:var(--portal-primary-foreground)]",
            )}
            onClick={() => {
              writeStoredTheme(storageKey, value);
              window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
              applyTheme(value);
            }}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function subscribeToThemeChanges(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function readStoredTheme(storageKey: string) {
  const value = window.localStorage.getItem(storageKey);
  return isPortalThemeMode(value) ? value : null;
}

function writeStoredTheme(storageKey: string, mode: PortalThemeMode) {
  if (mode === "system") {
    window.localStorage.removeItem(storageKey);
    return;
  }
  window.localStorage.setItem(storageKey, mode);
}

function resolveTheme(
  mode: PortalThemeMode,
  defaultTheme: PortalThemeMode,
): "light" | "dark" {
  const requestedMode = mode === "system" ? defaultTheme : mode;
  if (requestedMode === "light" || requestedMode === "dark") {
    return requestedMode;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function isPortalThemeMode(value: string | null): value is PortalThemeMode {
  return value === "system" || value === "light" || value === "dark";
}
