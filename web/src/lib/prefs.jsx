import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { load, save } from './storage.js';

// Preferensi per perangkat: tema, ukuran teks soal, dan maskot melayang.
const PrefsCtx = createContext(null);

function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function PrefsProvider({ children }) {
  const [theme, setTheme] = useState(() => load('iup-theme', 'light'));
  const [textScale, setTextScale] = useState(() => load('iup-text-scale', 1));
  const [mascotHidden, setMascotHidden] = useState(() => load('iup-mascot-hidden', false));
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

  useEffect(() => { save('iup-theme', theme); applyTheme(theme); }, [theme]);
  useEffect(() => {
    if (theme !== 'system' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);
  useEffect(() => { save('iup-text-scale', textScale); document.documentElement.style.setProperty('--q-scale', String(textScale)); }, [textScale]);
  useEffect(() => { save('iup-mascot-hidden', mascotHidden); }, [mascotHidden]);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const value = useMemo(() => ({
    theme, setTheme, textScale, setTextScale, mascotHidden, setMascotHidden, reducedMotion,
  }), [theme, textScale, mascotHidden, reducedMotion]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export function usePrefs() {
  return useContext(PrefsCtx);
}

export const TEXT_SCALES = [1, 1.15, 1.3, 1.5];
