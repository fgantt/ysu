import React, { useState, useEffect } from 'react';
import { isSvgTheme } from '../utils/pieceThemes';
import { getThemeById, ThemeConfig } from '../utils/themeConfig';
import SvgPiece from './SvgPiece';
import './PiecePreview.css';

interface PiecePreviewProps { theme: string; }

const piecePairs = [
  ['pawn', 'promPawn', 'Pawn'], ['lance', 'promLance', 'Lance'],
  ['knight', 'promKnight', 'Knight'], ['silver', 'promSilver', 'Silver'],
  ['gold', 'gold', 'Gold'], ['bishop', 'horse', 'Bishop'],
  ['rook', 'dragon', 'Rook'], ['king', 'king', 'King'],
];

const PiecePreview: React.FC<PiecePreviewProps> = ({ theme }) => {
  const [themeConfig, setThemeConfig] = useState<ThemeConfig | null>(null);
  useEffect(() => {
    let mounted = true;
    setThemeConfig(null);
    void getThemeById(theme).then(config => {
      if (mounted) setThemeConfig(config || null);
    });
    return () => { mounted = false; };
  }, [theme]);
  const name = themeConfig?.displayName || (theme === 'kanji' ? 'Kanji' : theme === 'english' ? 'English' : 'Selected theme');
  const description = themeConfig?.description || (theme === 'kanji' ? 'Simple, clear Japanese characters on wooden pieces.' : theme === 'english' ? 'English initials for easy piece recognition.' : '');
  return (
    <div className="piece-preview" aria-label="Selected piece preview">
      <div className="piece-preview-heading">
        <span className="piece-preview-caption">Selected theme</span>
        <h4>{name}</h4>
        {description && <p>{description}</p>}
      </div>
      <div className="piece-preview-grid">
        {piecePairs.map(([base, promoted, label]) => (
          <div key={base} className="piece-preview-pair">
            <div className="piece-preview-pieces">
              <SvgPiece type={base} player="player1" pieceThemeType={theme} size={64} />
              {base !== promoted && <>
                <span aria-label="promotes to">→</span>
                <SvgPiece type={promoted} player="player1" pieceThemeType={theme} size={64} />
              </>}
              {isSvgTheme(theme) && base === 'king' && <>
                <span aria-hidden="true">/</span>
                <SvgPiece type={base} player="player2" pieceThemeType={theme} size={64} />
              </>}
            </div>
            <span className="piece-preview-label">{label}</span>
          </div>
        ))}
      </div>
      {themeConfig?.attribution && <p className="piece-preview-attribution">
        Piece designs by{' '}
        <a href={themeConfig.attribution.url} target="_blank" rel="noopener noreferrer">{themeConfig.attribution.name}</a>
        , licensed under{' '}
        <a href={themeConfig.attribution.licenseUrl} target="_blank" rel="noopener noreferrer">{themeConfig.attribution.license}</a>.
      </p>}
    </div>
  );
};
export default PiecePreview;
