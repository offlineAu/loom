"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "loom.theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

/**
 * Minimal hand-rolled theme provider (system/light/dark) backed by
 * localStorage. Deliberately not a dependency (e.g. next-themes) — the
 * behavior needed is small enough that hand-rolling avoids an extra
 * package for ~30 lines of logic.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark" || stored === "system") {
        // Reading the persisted preference is only possible once mounted in the
        // browser (localStorage doesn't exist during server rendering), so this
        // one-time hydration of client-only state can't be expressed without an
        // effect — the state legitimately depends on an external system here.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThemeState(stored);
        applyTheme(stored);
      }
    } catch {
      // localStorage unavailable (e.g. private browsing) — fall back to system theme.
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persisting the preference is a convenience, not a correctness requirement.
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
