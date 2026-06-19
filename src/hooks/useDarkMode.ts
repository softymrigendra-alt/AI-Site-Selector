import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function resolvedDark(theme: Theme): boolean {
  if (theme === 'light') return false;
  if (theme === 'dark') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('ev-theme') as Theme | null;
    return saved ?? 'system';
  });

  const isDark = resolvedDark(theme);

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedDark(theme)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('ev-theme', theme);
  }, [theme]);

  // Re-evaluate when system preference changes (only matters in 'system' mode)
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.classList.toggle('dark', mq.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme, isDark };
}
