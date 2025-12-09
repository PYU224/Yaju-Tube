// src/stores/historyStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface HistoryItem {
  videoId: string;
  videoName: string;
  thumbnailPath: string;
  channelName: string;
  instanceUrl: string;
  watchedAt: number; // タイムスタンプ
  progress?: number; // 再生位置（秒）
  duration?: number; // 動画の長さ（秒）
}

export const useHistoryStore = defineStore('history', () => {
  // 視聴履歴（最新が先頭）
  const history = ref<HistoryItem[]>([]);
  
  // 最大保存件数
  const MAX_HISTORY = 100;

  // 視聴履歴を追加
  const addToHistory = (item: Omit<HistoryItem, 'watchedAt'>) => {
    // 既存の履歴から同じ動画を削除（重複防止）
    history.value = history.value.filter(h => h.videoId !== item.videoId);
    
    // 新しい履歴を先頭に追加
    history.value.unshift({
      ...item,
      watchedAt: Date.now()
    });
    
    // 最大件数を超えたら古いものを削除
    if (history.value.length > MAX_HISTORY) {
      history.value = history.value.slice(0, MAX_HISTORY);
    }
  };

  // 再生位置を更新
  const updateProgress = (videoId: string, progress: number, duration?: number) => {
    const item = history.value.find(h => h.videoId === videoId);
    if (item) {
      item.progress = progress;
      if (duration) {
        item.duration = duration;
      }
      // 視聴日時も更新
      item.watchedAt = Date.now();
    }
  };

  // 特定の履歴を削除
  const removeFromHistory = (videoId: string) => {
    history.value = history.value.filter(h => h.videoId !== videoId);
  };

  // すべての履歴を削除
  const clearHistory = () => {
    history.value = [];
  };

  // 特定の動画の履歴を取得
  const getHistoryItem = (videoId: string) => {
    return history.value.find(h => h.videoId === videoId);
  };

  // 日付でグループ化した履歴
  const groupedHistory = computed(() => {
    const groups: { [key: string]: HistoryItem[] } = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: []
    };

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const oneWeekMs = 7 * oneDayMs;
    const oneMonthMs = 30 * oneDayMs;

    history.value.forEach(item => {
      const diff = now - item.watchedAt;
      
      if (diff < oneDayMs) {
        groups.today.push(item);
      } else if (diff < 2 * oneDayMs) {
        groups.yesterday.push(item);
      } else if (diff < oneWeekMs) {
        groups.thisWeek.push(item);
      } else if (diff < oneMonthMs) {
        groups.thisMonth.push(item);
      } else {
        groups.older.push(item);
      }
    });

    return groups;
  });

  // 視聴率を計算（続きから再生用）
  const getWatchProgress = (videoId: string): number => {
    const item = getHistoryItem(videoId);
    if (!item || !item.progress || !item.duration) return 0;
    return (item.progress / item.duration) * 100;
  };

  return {
    history,
    groupedHistory,
    addToHistory,
    updateProgress,
    removeFromHistory,
    clearHistory,
    getHistoryItem,
    getWatchProgress
  };
}, {
  persist: true // ローカルストレージに自動保存
});
