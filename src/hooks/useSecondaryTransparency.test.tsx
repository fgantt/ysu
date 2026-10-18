import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SECONDARY_TRANSPARENCY_KEY, SecondaryTransparencyStyle, loadSecondaryTransparency, useSecondaryTransparency } from './useSecondaryTransparency';
afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.style.removeProperty('--secondary-window-opacity'); });
function Preference() {
  const { transparency, setTransparency } = useSecondaryTransparency();
  return <><output>{transparency}%</output><button onClick={() => setTransparency(25)}>Set transparency</button><button onClick={() => setTransparency(0)}>Reset</button></>;
}
it('updates all mounted consumers and the shared panel opacity immediately and restores saved values', () => {
  const view = render(<><SecondaryTransparencyStyle /><Preference /><Preference /></>);
  fireEvent.click(view.getAllByText('Set transparency')[0]);
  expect(view.getAllByText('25%')).toHaveLength(2);
  expect(document.documentElement.style.getPropertyValue('--secondary-window-opacity')).toBe('0.75');
  expect(localStorage.getItem(SECONDARY_TRANSPARENCY_KEY)).toBe('25');
  view.unmount();
  const reopened = render(<><SecondaryTransparencyStyle /><Preference /></>);
  expect(reopened.getByText('25%')).toBeTruthy();
  fireEvent.click(reopened.getByText('Reset'));
  expect(document.documentElement.style.getPropertyValue('--secondary-window-opacity')).toBe('1');
});
it('synchronizes external window storage changes and resets when storage is cleared', () => {
  const view = render(<><SecondaryTransparencyStyle /><Preference /></>);
  localStorage.setItem(SECONDARY_TRANSPARENCY_KEY, '40');
  fireEvent(window, new StorageEvent('storage', { key: SECONDARY_TRANSPARENCY_KEY }));
  expect(view.getByText('40%')).toBeTruthy();
  expect(document.documentElement.style.getPropertyValue('--secondary-window-opacity')).toBe('0.6');
  localStorage.clear();
  fireEvent(window, new StorageEvent('storage', { key: null }));
  expect(view.getByText('0%')).toBeTruthy();
});
it('bounds saved values and safely handles malformed settings', () => {
  for (const [raw, expected] of [['bad', 0], ['-20', 0], ['100', 60], ['Infinity', 0], ['24.6', 25]] as const) {
    localStorage.setItem(SECONDARY_TRANSPARENCY_KEY, raw);
    expect(loadSecondaryTransparency()).toBe(expected);
  }
});
