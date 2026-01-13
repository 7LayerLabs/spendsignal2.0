// Data Mode Hook
// Manages switching between demo (localStorage) and real (database) data modes

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type DataMode = 'demo' | 'real';

interface DataModeState {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  toggleMode: () => void;
  isRealMode: () => boolean;
  isDemoMode: () => boolean;
}

export const useDataMode = create<DataModeState>()(
  persist(
    (set, get) => ({
      mode: 'demo', // Default to demo mode for safety
      setMode: (mode) => set({ mode }),
      toggleMode: () => set((state) => ({ mode: state.mode === 'demo' ? 'real' : 'demo' })),
      isRealMode: () => get().mode === 'real',
      isDemoMode: () => get().mode === 'demo',
    }),
    {
      name: 'spendsignal-data-mode',
    }
  )
);
