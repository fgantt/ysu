import React, { useState, useEffect } from 'react';
import { getAvailablePieceThemes } from '../utils/pieceThemes';
import { ThemeConfig } from '../utils/themeConfig';
import SvgPiece from './SvgPiece';
import './ThemeSelector.css';

interface ThemeSelectorProps {
  selectedTheme: string;
  onThemeChange: (theme: string) => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ selectedTheme, onThemeChange }) => {
  const [themes, setThemes] = useState<ThemeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [style, setStyle] = useState('All styles');

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

  const choices: ThemeConfig[] = [
    { id: 'kanji', displayName: 'Kanji', description: 'Simple, clear Japanese characters on wooden pieces.' },
    { id: 'english', displayName: 'English', description: 'English initials for easy piece recognition.' },
    ...themes.filter(theme => theme.id !== 'kanji' && theme.id !== 'english'),
  ];
  const getStyle = (theme: ThemeConfig) => {
    if (theme.id === 'english' || theme.id === 'international') return 'International';
    if (theme.id === 'doubutsu' || theme.id === 'learning-arrows') return 'Illustrated';
    if (theme.id === 'kanji' || /kanji|mikurajima/i.test(theme.id)) return 'Japanese';
    return 'Other';
  };
  const query = search.trim().toLowerCase();
  const visible = choices.filter(theme =>
    (style === 'All styles' || getStyle(theme) === style) &&
    `${theme.displayName} ${theme.description || ''}`.toLowerCase().includes(query));

  return (
    <div className="piece-theme-picker">
      <div className="piece-theme-tools">
        <label className="piece-theme-search">
          <span>Find a piece theme</span>
          <input type="search" value={search} placeholder="Search names or descriptions"
            onChange={event => setSearch(event.target.value)} />
        </label>
        <label className="piece-theme-filter">
          <span>Style</span>
          <select value={style} onChange={event => setStyle(event.target.value)}>
            {['All styles', 'Japanese', 'International', 'Illustrated', 'Other'].map(value =>
              <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <p className="piece-theme-count" role="status">
        {loading ? 'Loading themes…' : `${visible.length} of ${choices.length} piece themes`}
      </p>
      <div className="piece-theme-grid" role="radiogroup" aria-label="Piece theme">
        {visible.map(theme => (
          <label key={theme.id} title={theme.description} className={`piece-theme-card${selectedTheme === theme.id ? ' selected' : ''}`}>
            <input type="radio" name="piece-theme" value={theme.id}
              aria-label={theme.displayName} checked={selectedTheme === theme.id}
              onChange={() => onThemeChange(theme.id)} />
            <span className="piece-theme-samples" aria-hidden="true">
              {['king', 'pawn', 'promPawn'].map(type =>
                <SvgPiece key={type} type={type} player="player1" pieceThemeType={theme.id} size={46} />)}
            </span>
            {selectedTheme === theme.id && <span className="piece-theme-check" aria-hidden="true">✓</span>}
            <span className="piece-theme-name">{theme.displayName}</span>
            <span className="piece-theme-style">{getStyle(theme)}</span>
            {theme.description && <span className="piece-theme-description">{theme.description}</span>}
          </label>
        ))}
      </div>
      {visible.length === 0 && <p className="piece-theme-count">No matching themes. Try another search or style.</p>}
    </div>
  );
};

export default ThemeSelector;
