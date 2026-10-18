import { useId } from 'react';
import { COLOR_THEMES, NEW_COLOR_THEMES, getThemeDescription, getThemeDisplayName, type Theme } from '../hooks/useTheme';
import './ColorThemePicker.css';

interface ColorThemePickerProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
}

export function ColorThemePicker({ theme, onChange }: ColorThemePickerProps) {
  const id = useId();
  return (
    <fieldset className="color-theme-picker">
      <legend>Choose your interface palette</legend>
      <p className="color-theme-help">Select a preview to apply and save it. Board and piece artwork stay as selected.</p>
      <div className="color-theme-grid">
        {COLOR_THEMES.map(option => (
          <label key={option} className={`color-theme-choice${theme === option ? ' is-selected' : ''}`}>
            <input type="radio" name={`${id}-theme`} value={option} checked={theme === option}
              aria-label={getThemeDisplayName(option)} aria-describedby={`${id}-${option}`}
              onChange={() => onChange(option)} />
            <span className="color-theme-preview" data-theme={option} aria-hidden="true">
              <span className="color-theme-preview-heading">Analysis <span>+128</span></span>
              <span className="color-theme-preview-row"><span>Candidate moves</span><span className="color-theme-preview-action">Analyze</span></span>
              <span className="color-theme-swatches"><i /><i /><i /><i /></span>
            </span>
            <span className="color-theme-name">{getThemeDisplayName(option)}
              {theme === option ? <span className="color-theme-badge">✓ Selected</span>
                : NEW_COLOR_THEMES.includes(option) ? <span className="color-theme-badge">New</span> : null}
            </span>
            <span className="color-theme-description" id={`${id}-${option}`}>{getThemeDescription(option)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
