import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// === STORE INTERFACES ===

interface AppState {
  // Theme
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Global loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Error handling
  error: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Selected app for detailed view
  selectedAppSlug: string | null;
  setSelectedAppSlug: (slug: string | null) => void;

  // UI state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

// === ZUSTAND STORE ===

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Theme - default to light mode
        theme: "light",
        setTheme: (theme) => {
          set({ theme });
          // Update document class for theme
          if (typeof document !== "undefined") {
            const root = document.documentElement;
            root.classList.remove("light", "dark");
            if (theme === "system") {
              const systemTheme = window.matchMedia(
                "(prefers-color-scheme: dark)"
              ).matches
                ? "dark"
                : "light";
              root.classList.add(systemTheme);
            } else {
              root.classList.add(theme);
            }
          }
        },

        // Global loading
        isLoading: false,
        setIsLoading: (loading) => set({ isLoading: loading }),

        // Error handling
        error: null,
        setError: (error) => set({ error }),
        clearError: () => set({ error: null }),

        // Selected app
        selectedAppSlug: null,
        setSelectedAppSlug: (slug) => set({ selectedAppSlug: slug }),

        // UI state
        sidebarOpen: false,
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
      }),
      {
        name: "expo-updates-store",
        partialize: (state) => ({ theme: state.theme }), // Only persist theme
      }
    ),
    {
      name: "expo-updates-store", // persist in devtools
    }
  )
);

// === THEME HOOK ===

export const useTheme = () => {
  const { theme, setTheme } = useAppStore();
  return { theme, setTheme };
};
