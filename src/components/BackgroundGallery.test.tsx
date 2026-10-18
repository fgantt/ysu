import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backgroundName, BackgroundGallery } from './BackgroundGallery';
afterEach(cleanup);
const images = ['/boards/wood-maple-2.webp', '/boards/sakura-washi.png', '/boards/bamboo-morning.png'];
describe('Background gallery', () => {
  it('shows a readable current preview and selects a named image without changing the supplied list', () => {
    const select = vi.fn();
    const view = render(<BackgroundGallery kind="board" images={images} current={images[0]} onSelect={select} />);
    expect(view.getByAltText('Current board background: Wood Maple 2')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Select board background: Wood Maple 2' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(view.getByRole('button', { name: 'Select board background: Sakura Washi' }));
    expect(select).toHaveBeenCalledWith(images[1]);
    view.rerender(<BackgroundGallery kind="board" images={images} current={images[1]} onSelect={select} />);
    expect(view.getByAltText('Current board background: Sakura Washi')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Select board background: Sakura Washi' }).getAttribute('aria-pressed')).toBe('true');
  });
  it('combines a descriptive search with the new-artwork filter and handles empty matches', () => {
    const view = render(<BackgroundGallery kind="board" images={images} current={images[0]} onSelect={vi.fn()} />);
    fireEvent.click(view.getByRole('button', { name: 'New artwork' }));
    expect(view.queryByRole('button', { name: /Select board background: Wood/ })).toBeNull();
    expect(view.getByText('2 of 3 board backgrounds')).toBeTruthy();
    fireEvent.change(view.getByRole('searchbox'), { target: { value: 'celadon' } });
    expect(view.getByRole('button', { name: /Bamboo Morning/ })).toBeTruthy();
    expect(view.queryByRole('button', { name: /Sakura Washi/ })).toBeNull();
    fireEvent.change(view.getByRole('searchbox'), { target: { value: 'missing' } });
    expect(view.getByText(/No matching images/)).toBeTruthy();
  });
  it('handles empty libraries, duplicate paths and user filenames', () => {
    const view = render(<BackgroundGallery kind="wallpaper" images={[]} current="" onSelect={vi.fn()} />);
    expect(view.getByText(/No wallpaper images/)).toBeTruthy();
    view.rerender(<BackgroundGallery kind="wallpaper" images={['/wallpapers/snow-temple.png', '/wallpapers/snow-temple.png']} current="/wallpapers/snow-temple.png" onSelect={vi.fn()} />);
    expect(view.getAllByRole('button', { name: /Select wallpaper/ })).toHaveLength(1);
    expect(backgroundName('/wallpapers/my%20garden-at_dawn.jpg?version=2')).toBe('My Garden At Dawn');
  });
});


it('requests fresh bundled artwork URLs but keeps selection callbacks and existing image paths stable', () => {
  const select = vi.fn();
  const view = render(<BackgroundGallery kind="board" images={images} current={images[1]} onSelect={select} />);
  const selected = view.getByAltText('Current board background: Sakura Washi');
  expect(selected.getAttribute('src')).toBe('/boards/sakura-washi.png?artwork=2026-10-07-1');
  const newCard = view.getByRole('button', { name: 'Select board background: Bamboo Morning' });
  expect(newCard.querySelector('img')?.getAttribute('src')).toBe('/boards/bamboo-morning.png?artwork=2026-10-07-1');
  expect(view.getByRole('button', { name: 'Select board background: Wood Maple 2' }).querySelector('img')?.getAttribute('src')).toBe(images[0]);
  fireEvent.click(newCard);
  expect(select).toHaveBeenCalledWith(images[2]);
});
