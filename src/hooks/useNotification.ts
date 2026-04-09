import { useEffect, useRef, useCallback } from 'react';

/**
 * useNotification Hook
 * 封裝 Web Notification API 邏輯與網頁標題閃爍功能。
 */
export const useNotification = () => {
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTitleRef = useRef<string>(document.title);

  // 請求通知權限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const clearBlink = useCallback(() => {
    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
      document.title = originalTitleRef.current;
    }
  }, []);

  // 監聽網頁可視狀態以清除閃爍狀態
  useEffect(() => {
    const handleVisibilityChange = () => {
      // 當使用者切回該頁籤時，取消標題閃爍
      if (!document.hidden) {
        clearBlink();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearBlink(); // 組件卸載時務必清理
    };
  }, [clearBlink]);

  const notify = useCallback((title: string, options?: NotificationOptions) => {
    // 只在畫面隱藏時觸發閃爍與通知
    if (!document.hidden) return;

    // 瀏覽器相容性與權限檢查
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, options);
      
      // 點擊通知必須觸發 window.focus()
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }

    // 開始標題閃爍
    if (!blinkIntervalRef.current) {
      let isOriginal = false;
      blinkIntervalRef.current = setInterval(() => {
        document.title = isOriginal 
          ? originalTitleRef.current 
          : `【新訊息】${originalTitleRef.current}`;
        isOriginal = !isOriginal;
      }, 1000);
    }
  }, []);

  return { notify };
};
