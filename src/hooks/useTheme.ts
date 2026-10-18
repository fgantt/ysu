import { useState, useEffect } from 'react';

export const COLOR_THEMES = ['dynamic', 'washi', 'jade', 'indigo', 'copper', 'plum', 'light', 'dark', 'traditional', 'ocean', 'forest', 'midnight', 'sunset', 'cyberpunk', 'cherry', 'monochrome', 'sepia'] as const;
export type Theme = typeof COLOR_THEMES[number];
export const NEW_COLOR_THEMES: readonly Theme[] = ['washi', 'jade', 'indigo', 'copper', 'plum'];

const THEME_STORAGE_KEY = 'shogiVibeTheme';
const DEFAULT_THEME: Theme = 'light';

/**
 * Custom hook for managing application theme
 * 
 * Persists theme selection to localStorage and applies it to the document element
 * 
 * @returns Object containing current theme and setter function
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage or use default
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    return savedTheme && isValidTheme(savedTheme) ? savedTheme : DEFAULT_THEME;
  });

  useEffect(() => {
    // Apply theme to document element
    document.documentElement.setAttribute('data-theme', theme);
    
    // Save to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    if (isValidTheme(newTheme)) {
      setThemeState(newTheme);
    } else {
      console.warn(`Invalid theme: ${newTheme}. Using default theme.`);
      setThemeState(DEFAULT_THEME);
    }
  };

  return { theme, setTheme };
}

/**
 * Type guard to check if a string is a valid Theme
 */
function isValidTheme(value: string): value is Theme {
  return COLOR_THEMES.some(theme => theme === value);
}

/**
 * Get theme display name for UI
 */
export function getThemeDisplayName(theme: Theme): string {
  const names: Record<Theme, string> = {
    washi: 'Washi Paper',
    jade: 'Jade Mist',
    indigo: 'Indigo Ink',
    copper: 'Copper Night',
    plum: 'Plum Silk',
    light: 'Light',
    dark: 'Dark',
    traditional: 'Traditional Wood',
    ocean: 'Ocean Blue',
    forest: 'Forest Green',
    midnight: 'Midnight Purple',
    sunset: 'Sunset Orange',
    cyberpunk: 'Cyberpunk Neon',
    cherry: 'Cherry Blossom',
    monochrome: 'Monochrome',
    sepia: 'Sepia Vintage',
    dynamic: 'Dynamic',
  };
  return names[theme];
}

/**
 * Get theme description
 */
export function getThemeDescription(theme: Theme): string {
  const descriptions: Record<Theme, string> = {
    washi: 'Ivory paper, charcoal text, and vermilion accents',
    jade: 'Pale jade surfaces with deep teal accents',
    indigo: 'Inky blue panels with soft periwinkle highlights',
    copper: 'Warm charcoal with burnished copper highlights',
    plum: 'Soft lavender surfaces with rich plum accents',
    light: 'Clean and modern light theme',
    dark: 'High contrast dark theme',
    traditional: 'Classic wood and gold aesthetic',
    ocean: 'Cool and calming ocean blues',
    forest: 'Natural forest greens',
    midnight: 'Dark purple theme for night gaming',
    sunset: 'Warm orange theme with energizing colors',
    cyberpunk: 'High contrast neon green on dark',
    cherry: 'Soft pink theme with Japanese aesthetics',
    monochrome: 'Clean black and white professional',
    sepia: 'Warm vintage aged paper look',
    dynamic: 'Colors coordinated with your current board and pieces',
  };
  return descriptions[theme];
}
