import { useRef } from 'react';

/**
 * 提供簡易的通知音效
 */
export const useSound = () => {
  // 使用 Base64 內嵌一段清脆的叮咚聲 (免去讀取檔案失敗的煩惱)
  const audioContext = useRef<AudioContext | null>(null);

  const playNotificationSound = () => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContext.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // 模擬經典提示音：由高音降至低音的頻率
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.warn('播放音效失敗，可能需要使用者先與頁面互動過', e);
    }
  };

  return { playNotificationSound };
};
