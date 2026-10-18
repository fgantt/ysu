import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listen } from '@tauri-apps/api/event';
import { useTauriEvents } from './useTauriEvents';
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
describe('engine event subscription lifecycle', () => {
  beforeEach(() => vi.resetAllMocks());
  it('keeps one subscription and delivers messages to the latest callback', async () => {
    const unlisten = vi.fn();
    vi.mocked(listen).mockResolvedValue(unlisten);
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ onUsiMessage }) => useTauriEvents('engine', { onUsiMessage }), { initialProps: { onUsiMessage: first } });
    await waitFor(() => expect(listen).toHaveBeenCalledTimes(1));
    rerender({ onUsiMessage: second });
    const handler = vi.mocked(listen).mock.calls[0][1];
    act(() => handler({ payload: 'bestmove 7g7f', id: 1, event: 'usi-message::engine' }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('engine', 'bestmove 7g7f');
    expect(listen).toHaveBeenCalledTimes(1);
    unmount();
    expect(unlisten).toHaveBeenCalledOnce();
  });
  it('disposes listeners that finish registering after unmount', async () => {
    let resolve!: (value: () => void) => void;
    vi.mocked(listen).mockReturnValue(new Promise<() => void>(done => { resolve = done; }));
    const onUsiMessage = vi.fn();
    const { unmount } = renderHook(() => useTauriEvents('engine', { onUsiMessage }));
    const handler = vi.mocked(listen).mock.calls[0][1];
    unmount();
    const unlisten = vi.fn();
    await act(async () => resolve(unlisten));
    handler({ payload: 'bestmove 7g7f', id: 1, event: 'usi-message::engine' });
    expect(unlisten).toHaveBeenCalledOnce();
    expect(onUsiMessage).not.toHaveBeenCalled();
  });
});
