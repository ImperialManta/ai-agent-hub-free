export type ThemeKey = 'dark' | 'purple';

export interface Theme {
  bg: string; bg2: string; bg3: string;
  accent: string; accentFg: string;
  text: string; text2: string; text3: string;
  border: string; border2: string;
  radius: string; inputBg: string;
  dot: string; label: string;
  headerBorder: string;
}

export const THEMES: Record<ThemeKey, Theme> = {
  dark: {
    bg: '#000',
    bg2: '#0d0d0d',
    bg3: '#1a1a1a',
    accent: '#FFB800',
    accentFg: '#000',
    text: '#ffffff',
    text2: '#c0c0c0',
    text3: '#555',
    border: '#2a2a2a',
    border2: '#111',
    radius: '2px',
    inputBg: '#000',
    dot: '#FFB800',
    label: 'Dark',
    headerBorder: '#FFB800',
  },
  purple: {
    bg: '#ffffff',
    bg2: '#f5f3ff',
    bg3: '#ede9fe',
    accent: '#7c3aed',
    accentFg: '#ffffff',
    text: '#1e1b4b',
    text2: '#4c1d95',
    text3: '#a78bfa',
    border: '#ddd6fe',
    border2: '#ede9fe',
    radius: '12px',
    inputBg: '#ffffff',
    dot: '#7c3aed',
    label: 'Purple',
    headerBorder: '#ddd6fe',
  },
};
