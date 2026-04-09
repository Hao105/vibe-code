// 基礎的 Service Worker，用於滿足 PWA 的安裝條件
self.addEventListener('install', (event) => {
  console.log('SW installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW activated');
});

self.addEventListener('fetch', (event) => {
  // 保持空實現即可滿足安裝要求
});
