import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { EngineManagementPage } from './EngineManagementPage';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('./EngineOptionsModal', () => ({ EngineOptionsModal: () => null }));
describe('Engine management', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(invoke).mockImplementation(async command => command === 'get_engines'
      ? { success: true, data: [{ id: 'test', name: 'Test', display_name: 'Test engine', path: '/test', enabled: true, is_builtin: false, is_favorite: false, created_at: '' }] }
      : { success: false, message: 'Unavailable' });
  });
  it('loads the current native engine catalog', async () => {
    render(<BrowserRouter><EngineManagementPage /></BrowserRouter>);
    expect(await screen.findByRole('heading', { name: /Test engine/ })).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith('get_engines');
  });
  it('keeps Add Engine disabled until both fields are filled', async () => {
    render(<BrowserRouter><EngineManagementPage /></BrowserRouter>);
    await screen.findByRole('heading', { name: /Test engine/ });
    fireEvent.click(screen.getByRole('button', { name: 'Add New Engine' }));
    const add = screen.getByRole('button', { name: 'Add Engine' });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('e.g., Apery, YaneuraOu'), { target: { value: 'New engine' } });
    expect(add).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Path to engine executable'), { target: { value: '/new' } });
    expect(add).toBeEnabled();
  });
  it('shows native catalog errors', async () => {
    vi.mocked(invoke).mockResolvedValue({ success: false, message: 'Catalog unavailable' });
    render(<BrowserRouter><EngineManagementPage /></BrowserRouter>);
    expect(await screen.findByText('Catalog unavailable')).toBeTruthy();
  });
});
