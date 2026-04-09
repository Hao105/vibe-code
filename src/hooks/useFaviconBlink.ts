import { useEffect, useRef } from 'react';

export const useFaviconBlink = () => {
  const blinkInterval = useRef<number | null>(null);
  const isBlinking = useRef(false);
  const originalFavicon = useRef<string>('');

  useEffect(() => {
    // 獲取或建立 favicon 元素
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    originalFavicon.current = link.href;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        stopBlink();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopBlink();
    };
  }, []);

  const startBlink = () => {
    if (isBlinking.current || !document.hidden) return;
    isBlinking.current = true;

    // Set Windows/PWA Taskbar Badge (Green dot / counter)
    if ('setAppBadge' in navigator) {
      (navigator as any).setAppBadge(1).catch((error: any) => console.error(error));
    }

    let toggle = false;
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;

    blinkInterval.current = setInterval(() => {
      // 交替切換紅點跟原圖
      if (link) {
        link.href = toggle 
          ? originalFavicon.current 
          : 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22red%22/></svg>';
      }
      toggle = !toggle;
    }, 500);
  };

  const stopBlink = () => {
    isBlinking.current = false;
    if (blinkInterval.current) {
      clearInterval(blinkInterval.current);
      blinkInterval.current = null;
    }
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (link && originalFavicon.current) {
      link.href = originalFavicon.current;
    }
    
    // Clear Windows/PWA Taskbar Badge
    if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge().catch((error: any) => console.error(error));
    }
  };

  return { startBlink, stopBlink };
};
