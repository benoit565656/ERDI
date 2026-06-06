import { create } from 'zustand';

interface UIStore {
  themeMode: 'light' | 'dark';
  sidebarCollapsed: boolean;
  setThemeMode: (mode: 'light' | 'dark') => void;
  toggleThemeMode: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => {
  // Safe detection of localStorage in browser
  const getInitialTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('erdi_admin_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark'; // Premium dark mode by default
  };

  return {
    themeMode: getInitialTheme(),
    sidebarCollapsed: false,
    setThemeMode: (mode) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('erdi_admin_theme', mode);
      }
      set({ themeMode: mode });
    },
    toggleThemeMode: () => set((state) => {
      const next = state.themeMode === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        localStorage.setItem('erdi_admin_theme', next);
      }
      return { themeMode: next };
    }),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  };
});
