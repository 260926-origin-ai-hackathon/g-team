import { useEffect, useState } from 'react';
export type Theme = 'system' | 'light' | 'dark';
export function useTheme() {
  const [theme, updateTheme] = useState<Theme>(() => {
    try { const saved = localStorage.getItem('mimamori-theme'); return saved === 'light' || saved === 'dark' ? saved : 'system'; } catch { return 'system'; }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    media.addEventListener('change', change); change();
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#14221c' : '#fefefd');
  }, [dark]);
  function setTheme(value: Theme) {
    updateTheme(value);
    try { localStorage.setItem('mimamori-theme', value); } catch { /* Theme still works for this session. */ }
  }
  return { theme, setTheme, dark };
}
