import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ColorThemePicker } from './ColorThemePicker';
import { COLOR_THEMES, NEW_COLOR_THEMES, getThemeDisplayName, useTheme } from '../hooks/useTheme';

function Picker() {
  const { theme, setTheme } = useTheme();
  return <ColorThemePicker theme={theme} onChange={setTheme} />;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('color theme picker', () => {
  it('offers every existing palette and five new palettes as named radio previews', () => {
    const view = render(<Picker />);
    expect(NEW_COLOR_THEMES).toHaveLength(5);
    expect(screen.getAllByRole('radio')).toHaveLength(COLOR_THEMES.length);
    for (const theme of COLOR_THEMES) {
      expect(screen.getByRole('radio', { name: getThemeDisplayName(theme) })).toBeTruthy();
      expect(view.container.querySelector(`.color-theme-preview[data-theme="${theme}"]`)).toBeTruthy();
    }
  });

  it.each(NEW_COLOR_THEMES)('applies and persists %s, and restores its selected state on reopening', theme => {
    const first = render(<Picker />);
    fireEvent.click(screen.getByRole('radio', { name: getThemeDisplayName(theme) }));
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
    expect(localStorage.getItem('shogiVibeTheme')).toBe(theme);
    expect(screen.getAllByRole('radio').filter((input: HTMLElement) => (input as HTMLInputElement).checked)).toHaveLength(1);
    first.unmount();
    render(<Picker />);
    expect((screen.getByRole('radio', { name: getThemeDisplayName(theme) }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('✓ Selected')).toBeTruthy();
  });
});
