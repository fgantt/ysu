import React, { useState, useEffect } from 'react';
import { getAvailablePieceThemes } from '../utils/pieceThemes';
import { ThemeConfig } from '../utils/themeConfig';

interface ThemeSelectorProps {
  selectedTheme: string;
  onThemeChange: (theme: string) => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ selectedTheme, onThemeChange }) => {
  const [themes, setThemes] = useState<ThemeConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadThemes = async () => {
      try {
        const availableThemes = await getAvailablePieceThemes();
        if (mounted) setThemes(availableThemes);
      } catch (error) {
        console.error('Error loading themes:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadThemes();
    };
    void loadThemes();
    window.addEventListener('focus', loadThemes);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      mounted = false;
      window.removeEventListener('focus', loadThemes);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  if (loading) {
    return <div>Loading themes...</div>;
  }

  return (
    <div className="setting-group">
      {/* Text-based themes */}
      <label>
        <input
          type="radio"
          value="kanji"
          checked={selectedTheme === 'kanji'}
          onChange={() => onThemeChange('kanji')}
        />
        Kanji
      </label>
      <label>
        <input
          type="radio"
          value="english"
          checked={selectedTheme === 'english'}
          onChange={() => onThemeChange('english')}
        />
        English
      </label>
      
      {/* SVG themes from config */}
      {themes.map((theme) => (
        <label key={theme.id}>
          <input
            type="radio"
            value={theme.id}
            checked={selectedTheme === theme.id}
            onChange={() => onThemeChange(theme.id)}
          />
          {theme.displayName}
        </label>
      ))}
    </div>
  );
};

export default ThemeSelector;
