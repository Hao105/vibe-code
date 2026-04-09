import { useEffect, useRef } from 'react';

/**
 * useChatScroll Hook
 * 處理聊天室滾動自動置底邏輯。
 * @param dep 用於觸發置底的依賴陣列（如訊息列表）
 */
export const useChatScroll = <T>(dep: T) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [dep]);

  return ref;
};
