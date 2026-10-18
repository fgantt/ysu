import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSecondaryTransparency } from '../hooks/useSecondaryTransparency';
import PiecePreview from './PiecePreview';
import ThemeSelector from './ThemeSelector';
import { useTheme } from '../hooks/useTheme';
import { NEW_BOARD_BACKGROUNDS, NEW_WALLPAPERS } from '../data/backgroundArtwork';
import { BackgroundGallery } from './BackgroundGallery';
import { ColorThemePicker } from './ColorThemePicker';
import { playPreviewSound } from '../utils/audio';
import { EngineSelector } from './EngineSelector';
import { EngineOptionsModal } from './EngineOptionsModal';
import type { EngineConfig } from '../types/engine';
import { invoke } from '@tauri-apps/api/core';
import { loadSettingsViewState, saveSettingsViewState, type SettingsTab } from '../utils/settingsViewState';
import '../styles/settings.css';

type Notation = 'western' | 'kifu' | 'usi' | 'csa';

interface SettingsPanelProps {
  pieceThemeType: string;
  onPieceThemeTypeChange: (type: string) => void;
  notation: Notation;
  onNotationChange: (notation: Notation) => void;
  wallpaperList: string[];
  onSelectWallpaper: (wallpaper: string) => void;
  boardBackgroundList: string[];
  onSelectBoardBackground: (background: string) => void;
  onClose: () => void;
  currentWallpaper: string;
  currentBoardBackground: string;
  showAttackedPieces: boolean;
  onShowAttackedPiecesChange: (show: boolean) => void;
  showPieceTooltips: boolean;
  onShowPieceTooltipsChange: (show: boolean) => void;
  showEngineThinking: boolean;
  onShowEngineThinkingChange: (show: boolean) => void;
  soundsEnabled: boolean;
  onSoundsEnabledChange: (enabled: boolean) => void;
  soundVolume: number;
  onSoundVolumeChange: (volume: number) => void;
  // Recommendation engine settings
  recommendationEngineId: string | null;
  onRecommendationEngineChange: (engineId: string | null) => void;
  recommendationEngineOptions: {[key: string]: string} | null;
  onRecommendationEngineOptionsChange: (options: {[key: string]: string} | null) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  pieceThemeType,
  onPieceThemeTypeChange,
  notation,
  onNotationChange,
  wallpaperList,
  onSelectWallpaper,
  boardBackgroundList,
  onSelectBoardBackground,
  onClose,
  currentWallpaper,
  currentBoardBackground,
  showAttackedPieces,
  onShowAttackedPiecesChange,
  showPieceTooltips,
  onShowPieceTooltipsChange,
  showEngineThinking,
  onShowEngineThinkingChange,
  soundsEnabled,
  onSoundsEnabledChange,
  soundVolume,
  onSoundVolumeChange,
  // Recommendation engine settings
  recommendationEngineId,
  onRecommendationEngineChange,
  recommendationEngineOptions,
  onRecommendationEngineOptionsChange,
}) => {
  const { transparency, setTransparency } = useSecondaryTransparency();
  const [initialView] = useState(loadSettingsViewState);
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialView.activeTab);
  const [isBoardBackgroundCollapsed, setIsBoardBackgroundCollapsed] = useState(initialView.collapsed.boardBackground);
  const [isWallpaperCollapsed, setIsWallpaperCollapsed] = useState(initialView.collapsed.wallpaper);
  const [isColorThemeCollapsed, setIsColorThemeCollapsed] = useState(initialView.collapsed.colorTheme);
  const [isPieceThemesCollapsed, setIsPieceThemesCollapsed] = useState(initialView.collapsed.pieceThemes);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef(initialView.scrollTop);
  const restoringScrollRef = useRef(false);
  const restoreObserverRef = useRef<MutationObserver | null>(null);
  const { theme, setTheme } = useTheme();
  const volumePreviewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const persistView = useCallback(() => {
    saveSettingsViewState({
      activeTab,
      scrollTop: scrollPositionsRef.current,
      collapsed: {
        boardBackground: isBoardBackgroundCollapsed,
        wallpaper: isWallpaperCollapsed,
        colorTheme: isColorThemeCollapsed,
        pieceThemes: isPieceThemesCollapsed,
      },
    });
  }, [activeTab, isBoardBackgroundCollapsed, isWallpaperCollapsed, isColorThemeCollapsed, isPieceThemesCollapsed]);

  useEffect(() => { persistView(); }, [persistView]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const desired = scrollPositionsRef.current[activeTab];
    if (desired === 0) { content.scrollTop = 0; return; }
    restoringScrollRef.current = true;
    const restore = () => {
      content.scrollTop = desired;
      if (Math.abs(content.scrollTop - desired) < 1) {
        restoringScrollRef.current = false;
        observer.disconnect();
        restoreObserverRef.current = null;
      }
    };
    const observer = new MutationObserver(restore);
    restoreObserverRef.current = observer;
    observer.observe(content, { childList: true, subtree: true });
    const frame = requestAnimationFrame(restore);
    restore();
    return () => { observer.disconnect(); restoreObserverRef.current = null; cancelAnimationFrame(frame); restoringScrollRef.current = false; };
  }, [activeTab]);

  const cancelScrollRestore = () => {
    restoreObserverRef.current?.disconnect();
    restoreObserverRef.current = null;
    restoringScrollRef.current = false;
  };

  const switchTab = (next: SettingsTab) => {
    if (contentRef.current && !restoringScrollRef.current) scrollPositionsRef.current[activeTab] = contentRef.current.scrollTop;
    setActiveTab(next);
  };

  const closeSettings = () => {
    if (contentRef.current && !restoringScrollRef.current) scrollPositionsRef.current[activeTab] = contentRef.current.scrollTop;
    persistView();
    onClose();
  };
  
  // Recommendation engine options modal state
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<EngineConfig | null>(null);
  const [engines, setEngines] = useState<EngineConfig[]>([]);

  // Load engines when component mounts
  useEffect(() => {
    loadEngines();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (volumePreviewTimeoutRef.current) {
        clearTimeout(volumePreviewTimeoutRef.current);
      }
    };
  }, []);

  const loadEngines = async () => {
    try {
      const response = await invoke<{ success: boolean; data?: EngineConfig[] }>('get_engines');
      if (response.success && response.data) {
        setEngines(response.data);
        
        // Auto-select favorite engine if no recommendation engine is selected
        if (!recommendationEngineId && response.data.length > 0) {
          const favoriteEngine = response.data.find(e => e.is_favorite);
          const defaultEngine = favoriteEngine || response.data.find(e => e.is_builtin) || response.data[0];
          if (defaultEngine) {
            onRecommendationEngineChange(defaultEngine.id);
          }
        }
      }
    } catch (error) {
      console.error('Error loading engines:', error);
    }
  };

  const handleOpenRecommendationEngineOptions = () => {
    if (!recommendationEngineId) return;
    
    const engine = engines.find(e => e.id === recommendationEngineId);
    if (engine) {
      setSelectedEngine(engine);
      setOptionsModalOpen(true);
    }
  };

  const handleCloseRecommendationEngineOptions = () => {
    setOptionsModalOpen(false);
    setSelectedEngine(null);
  };

  const handleSaveRecommendationEngineOptions = (options: {[key: string]: string}) => {
    onRecommendationEngineOptionsChange(options);
    setOptionsModalOpen(false);
    setSelectedEngine(null);
  };

  const toggleBoardBackgroundCollapse = () => {
    setIsBoardBackgroundCollapsed(!isBoardBackgroundCollapsed);
  };

  const toggleWallpaperCollapse = () => {
    setIsWallpaperCollapsed(!isWallpaperCollapsed);
  };

  const toggleColorThemeCollapse = () => {
    setIsColorThemeCollapsed(!isColorThemeCollapsed);
  };

  const togglePieceThemesCollapse = () => {
    setIsPieceThemesCollapsed(!isPieceThemesCollapsed);
  };

  const handleVolumeChange = (volume: number) => {
    // Update the volume immediately
    onSoundVolumeChange(volume);
    
    // Clear any existing timeout
    if (volumePreviewTimeoutRef.current) {
      clearTimeout(volumePreviewTimeoutRef.current);
    }
    
    // Set a new timeout to play the preview sound after user stops dragging
    volumePreviewTimeoutRef.current = setTimeout(() => {
      playPreviewSound();
    }, 150); // 150ms delay after user stops moving the slider
  };
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'appearance':
        return (
          <>
            <section>
              <h3 onClick={toggleColorThemeCollapse} style={{ cursor: 'pointer' }}>
                Color Theme
                <span className={`collapse-arrow ${isColorThemeCollapsed ? 'collapsed' : ''}`}>&#9660;</span>
              </h3>
              {!isColorThemeCollapsed && (
                <ColorThemePicker theme={theme} onChange={setTheme} />
                )}
            </section>

            <section>
              <h3 onClick={togglePieceThemesCollapse} style={{ cursor: 'pointer' }}>
                Piece Themes
                <span className={`collapse-arrow ${isPieceThemesCollapsed ? 'collapsed' : ''}`}>&#9660;</span>
              </h3>
              {!isPieceThemesCollapsed && (
                <>
                  <PiecePreview theme={pieceThemeType} />
                  <ThemeSelector 
                    selectedTheme={pieceThemeType} 
                    onThemeChange={onPieceThemeTypeChange} 
                  />
                </>
              )}
            </section>
          </>
        );

      case 'display':
        return (
          <>
            <section>
              <h3>Secondary window transparency</h3>
              <label>Transparency: {transparency}%<input aria-label="Secondary window transparency" type="range" min="0" max="60" step="5" value={transparency} onChange={event => setTransparency(Number(event.target.value))} /></label>
              <p>Applies to all analysis windows, including native pop-outs. 0% is fully opaque. Text and controls fade with the window.</p>
              <button onClick={() => setTransparency(0)} disabled={transparency === 0}>Restore opaque windows</button>
            </section>
            <section>
              <h3>Show Attacked Pieces</h3>
              <div className="setting-group">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={showAttackedPieces}
                    onChange={(e) => onShowAttackedPiecesChange(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </section>

            <section>
              <h3>Show Piece Tooltips</h3>
              <div className="setting-group">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={showPieceTooltips}
                    onChange={(e) => onShowPieceTooltipsChange(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </section>

            <section>
              <h3>Show Engine Thinking</h3>
              <div className="setting-group">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={showEngineThinking}
                    onChange={(e) => onShowEngineThinkingChange(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
              <p className="setting-description">Display an arrow showing the AI's current thinking move</p>
            </section>

            <section>
              <h3>Piece Movement Sounds</h3>
              <div className="setting-group">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={soundsEnabled}
                    onChange={(e) => onSoundsEnabledChange(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
                <span style={{ marginLeft: '10px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                  Play clacking sound when pieces are moved
                </span>
              </div>
              {soundsEnabled && (
                <div className="setting-group" style={{ marginTop: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                    <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', minWidth: '60px' }}>
                      Volume:
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(soundVolume * 100)}
                      onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', minWidth: '40px', textAlign: 'right' }}>
                      {Math.round(soundVolume * 100)}%
                    </span>
                  </label>
                </div>
              )}
            </section>
          </>
        );

      case 'notation':
        return (
          <section>
            <h3>Move Log Notation</h3>
            <div className="setting-group">
              <label className="notation-option">
                <input
                  type="radio"
                  value="western"
                  checked={notation === 'western'}
                  onChange={() => onNotationChange('western')}
                />
                <div className="notation-label">
                  <span className="notation-name">English</span>
                  <span className="notation-example">P-7f, Rx2d</span>
                </div>
              </label>
              <label className="notation-option">
                <input
                  type="radio"
                  value="kifu"
                  checked={notation === 'kifu'}
                  onChange={() => onNotationChange('kifu')}
                />
                <div className="notation-label">
                  <span className="notation-name">KIF</span>
                  <span className="notation-example">７六歩, ２四飛</span>
                </div>
              </label>
              <label className="notation-option">
                <input
                  type="radio"
                  value="usi"
                  checked={notation === 'usi'}
                  onChange={() => onNotationChange('usi')}
                />
                <div className="notation-label">
                  <span className="notation-name">USI</span>
                  <span className="notation-example">7g7f, 2d2b</span>
                </div>
              </label>
              <label className="notation-option">
                <input
                  type="radio"
                  value="csa"
                  checked={notation === 'csa'}
                  onChange={() => onNotationChange('csa')}
                />
                <div className="notation-label">
                  <span className="notation-name">CSA</span>
                  <span className="notation-example">+7776FU, -2424HI</span>
                </div>
              </label>
            </div>
          </section>
        );

      case 'backgrounds':
        return (
          <>
            <div className="settings-page-intro"><h3>Make the game your own</h3><p>Choose a board surface and a scene for your workspace. Your selections apply immediately.</p></div>
            <section>
              <h3><button className="settings-section-toggle" onClick={toggleBoardBackgroundCollapse} aria-expanded={!isBoardBackgroundCollapsed}>Board Background<span className={`collapse-arrow ${isBoardBackgroundCollapsed ? 'collapsed' : ''}`} aria-hidden="true">&#9660;</span></button></h3>
              {!isBoardBackgroundCollapsed && <BackgroundGallery kind="board" images={[...NEW_BOARD_BACKGROUNDS, ...boardBackgroundList]} current={currentBoardBackground} onSelect={onSelectBoardBackground} />}
            </section>
            <section>
              <h3><button className="settings-section-toggle" onClick={toggleWallpaperCollapse} aria-expanded={!isWallpaperCollapsed}>Wallpaper<span className={`collapse-arrow ${isWallpaperCollapsed ? 'collapsed' : ''}`} aria-hidden="true">&#9660;</span></button></h3>
              {!isWallpaperCollapsed && <BackgroundGallery kind="wallpaper" images={[...NEW_WALLPAPERS, ...wallpaperList]} current={currentWallpaper} onSelect={onSelectWallpaper} />}
            </section>
          </>
        );

        case 'engines':
          return (
            <>
              <section>
                <h3>Recommendation Engine</h3>
                <p className="setting-description">
                  Select the engine to use for move recommendations when hints are enabled.
                  This engine will analyze the position and suggest moves for human players.
                </p>
                <div className="setting-group">
                  <EngineSelector
                    selectedEngineId={recommendationEngineId}
                  onEngineSelect={(engineId) => {
                    console.log('[SettingsPanel] Engine selection changed:', engineId);
                    onRecommendationEngineChange(engineId);
                  }}
                    label="Recommendation Engine"
                    autoSelect={false}
                  />
                  {recommendationEngineId && (
                    <button
                      className="engine-options-btn"
                      onClick={handleOpenRecommendationEngineOptions}
                      style={{
                        marginTop: '10px',
                        padding: '8px 16px',
                        backgroundColor: 'var(--color-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      Engine Options
                    </button>
                  )}
                </div>
              </section>
            </>
          );

      default:
        return null;
    }
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel settings-panel-tabbed">
        <div className="settings-header">
          <h2>Settings</h2><p className="settings-header-subtitle">Personalize your Shogi workspace</p>
        </div>
        <button aria-label="Close settings" title="Close settings" className="settings-close-btn" onClick={closeSettings}>×</button>
        
        <div className="settings-content">
          <div className="settings-tabs">
            <button 
              className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
              aria-current={activeTab === 'appearance' ? 'page' : undefined}
              onClick={() => switchTab('appearance')}
            >
              <span className="tab-icon">🎨</span>
              <span className="tab-label">Appearance</span>
            </button>
            <button 
              className={`settings-tab ${activeTab === 'display' ? 'active' : ''}`}
              aria-current={activeTab === 'display' ? 'page' : undefined}
              onClick={() => switchTab('display')}
            >
              <span className="tab-icon">⚙️</span>
              <span className="tab-label">Display</span>
            </button>
            <button 
              className={`settings-tab ${activeTab === 'notation' ? 'active' : ''}`}
              aria-current={activeTab === 'notation' ? 'page' : undefined}
              onClick={() => switchTab('notation')}
            >
              <span className="tab-icon">📝</span>
              <span className="tab-label">Notation</span>
            </button>
            <button 
              className={`settings-tab ${activeTab === 'backgrounds' ? 'active' : ''}`}
              aria-current={activeTab === 'backgrounds' ? 'page' : undefined}
              onClick={() => switchTab('backgrounds')}
            >
              <span className="tab-icon">🖼️</span>
              <span className="tab-label">Backgrounds</span>
            </button>
            <button 
              className={`settings-tab ${activeTab === 'engines' ? 'active' : ''}`}
              aria-current={activeTab === 'engines' ? 'page' : undefined}
              onClick={() => switchTab('engines')}
            >
              <span className="tab-icon">🤖</span>
              <span className="tab-label">Engines</span>
            </button>
          </div>
          
          <div
            ref={contentRef}
            className="settings-tab-content"
            onScroll={event => {
              if (!restoringScrollRef.current) scrollPositionsRef.current[activeTab] = event.currentTarget.scrollTop;
            }}
            onWheel={cancelScrollRestore}
            onPointerDown={cancelScrollRestore}
          >
            {renderTabContent()}
          </div>
        </div>
      </div>
      
      {/* Engine Options Modal */}
      {optionsModalOpen && selectedEngine && (
        <EngineOptionsModal
          isOpen={optionsModalOpen}
          engine={selectedEngine}
          onClose={handleCloseRecommendationEngineOptions}
          onSave={handleSaveRecommendationEngineOptions}
          tempOptions={recommendationEngineOptions}
        />
      )}
    </div>
  );
};

export default SettingsPanel;
