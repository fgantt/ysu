import { useSyncExternalStore } from 'react';
import { thinkingHistoryStore } from '../utils/thinkingHistory';

export function useThinkingHistory() {
  return useSyncExternalStore(thinkingHistoryStore.subscribe, thinkingHistoryStore.getSnapshot);
}
