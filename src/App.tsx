import React, { useState, useEffect } from 'react';
import { useNotification } from './hooks/useNotification';
import { useChatScroll } from './hooks/useChatScroll';
import { useFaviconBlink } from './hooks/useFaviconBlink';
import { useSound } from './hooks/useSound';
import { fetchTraces, fetchMe, ChatMessage } from './api/chatApi';
import { STRINGS } from './constants';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traces, setTraces] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // 用於判斷是否該顯示軌跡紀錄
  const [currentUser, setCurrentUser] = useState<string>(''); // 用於記錄自己發送時拿到的真實姓名
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  
  // 新增：動態網址配置狀態
  const [isConfigured, setIsConfigured] = useState(!import.meta.env.PROD || !!localStorage.getItem('chat_server_url'));
  const [serverInput, setServerInput] = useState('');
  
  const { notify } = useNotification();
  const { startBlink } = useFaviconBlink();
  const { playNotificationSound } = useSound();
  const scrollRef = useChatScroll<ChatMessage[]>(messages);
  const ws = React.useRef<WebSocket | null>(null);

  const STICKERS = [
    { id: 'grinning', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.webp' },
    { id: 'joy', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.webp' },
    { id: 'rofl', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f923/512.webp' },
    { id: 'smile_hearts', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f970/512.webp' },
    { id: 'heart_eyes', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60d/512.webp' },
    { id: 'star_struck', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f929/512.webp' },
    { id: 'kiss', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f618/512.webp' },
    { id: 'zany', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f92a/512.webp' },
    { id: 'cool', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.webp' },
    { id: 'party', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f973/512.webp' },
    { id: 'smirk', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f60f/512.webp' },
    { id: 'unamused', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f612/512.webp' },
    { id: 'roll_eyes', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f644/512.webp' },
    { id: 'pleading', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f97a/512.webp' },
    { id: 'cry', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f62d/512.webp' },
    { id: 'rage', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f621/512.webp' },
    { id: 'exploding', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f92f/512.webp' },
    { id: 'swear', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f92c/512.webp' },
    { id: 'poop', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4a9/512.webp' },
    { id: 'clown', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f921/512.webp' },
    { id: 'ghost', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47b/512.webp' },
    { id: 'alien', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f47d/512.webp' },
    { id: 'robot', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f916/512.webp' },
    { id: 'cat', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f63a/512.webp' },
    { id: 'dog', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f436/512.webp' },
    { id: 'monkey', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f412/512.webp' },
    { id: 'unicorn', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f984/512.webp' },
    { id: 'fire', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp' },
    { id: '100', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f4af/512.webp' },
    { id: 'sparkles', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2728/512.webp' },
    { id: 'star', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f31f/512.webp' },
    { id: 'heart', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2764/512.webp' },
    { id: 'broken_heart', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f494/512.webp' },
    { id: 'thumbs_up', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.webp' },
    { id: 'peace', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/270c/512.webp' },
    { id: 'ok', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44c/512.webp' }
  ];

  useEffect(() => {
    // 監聽 PWA 安裝事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 解析網址列是否有 ?server= 參數
    const params = new URLSearchParams(window.location.search);
    const serverParam = params.get('server');
    if (serverParam) {
      // 若沒有 http 開頭幫他加上 (Ngrok 預設 https)
      const validUrl = serverParam.startsWith('http') ? serverParam : `https://${serverParam}`;
      localStorage.setItem('chat_server_url', validUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsConfigured(true);
    }

    // 取得自己的用戶名稱
    fetchMe().then(name => {
      if (name) setCurrentUser(name);
    });

    if (!isConfigured || isAccessDenied) return;

    // 建立 WebSocket 連線
    let wsUrl = '';
    if (!import.meta.env.PROD) {
      // 本地開發：直接使用相對路徑，善用 Vite Proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}${window.location.pathname.replace(/\/$/, '')}/api/ws`;
    } else {
      // 正式環境 (GitHub Pages)：解析使用者填寫的伺服器網址
      const savedUrl = localStorage.getItem('chat_server_url');
      if (!savedUrl) return;
      try {
        const parsedUrl = new URL(savedUrl);
        const protocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${parsedUrl.host}${parsedUrl.pathname.replace(/\/$/, '')}/api/ws`;
      } catch (e) {
        console.error("Invalid server URL", savedUrl);
        setIsConfigured(false);
        return;
      }
    }

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket 連線成功');
      setIsLoading(false);
    };

    socket.onmessage = (event) => {
      try {
        console.log("WebSocket DATA:", event.data);
        const packet = JSON.parse(event.data);
        console.log("WebSocket PARSED PACKET:", packet);
        
        switch (packet.type) {
          case 'HISTORY':
            setMessages(packet.payload);
            break;
            
          case 'MESSAGE':
            const newMsg = packet.payload;
            setMessages(prev => [...prev, newMsg]);
            
            // 如果不是自己發的，觸發系統通知與 Favicon 閃爍
            if (newMsg.sender !== currentUser) {
              notify(`${newMsg.sender}: 傳送了新訊息`);
              startBlink();
              if (soundEnabled && document.hidden) {
                playNotificationSound();
              }
            }
            break;
            
          case 'ONLINE_USERS':
            setOnlineUsers(packet.payload);
            break;
        }
      } catch (err) {
        console.error('無法解析 WebSocket 訊息', err);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket 已斷線');
    };

    ws.current = socket;

    // 軌跡定時刷新 (WebSocket 不負責軌跡，保持 REST 分離)
    let interval: number | null = null;
    if (currentUser === 'Admin') {
      setIsAdmin(true);
      interval = window.setInterval(async () => {
        try {
          const latestTraces = await fetchTraces();
          if (latestTraces !== null) {
            setTraces(latestTraces);
          }
        } catch (error: any) {
          if (error.message === 'ACCESS_DENIED') {
            setIsAccessDenied(true);
          }
        }
      }, 3000);
    } else {
      setIsAdmin(false);
    }

    return () => {
      if (interval !== null) clearInterval(interval);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      socket.close();
    };
  }, [isConfigured, isAccessDenied, currentUser, notify]);

  const handleSend = async (e?: React.FormEvent, overridingText?: string) => {
    e?.preventDefault();
    const textToSend = overridingText || inputText;
    
    if (!textToSend.trim() || !ws.current) return;

    if (!overridingText) {
      setInputText('');
    }
    setShowStickers(false);
    
    // 透過 WebSocket 即時發送
    if (ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ text: textToSend }));
    } else {
      console.error(STRINGS.ERROR_SEND, 'WebSocket is not open');
      if (!overridingText) setInputText(textToSend);
    }
  };

  const renderMessageText = (text: string) => {
    if (text.startsWith('[STICKER:') && text.endsWith(']')) {
      const url = text.substring(9, text.length - 1);
      return <img src={url} alt="sticker" className="w-24 h-24 object-contain animate-bounce" />;
    }
    return text;
  };



  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    let url = serverInput.trim();
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    try {
      new URL(url); // 測試是否為合法網址
      localStorage.setItem('chat_server_url', url);
      setIsConfigured(true);
    } catch {
      alert("請輸入有效的網址 (例如 https://xxxxx.ngrok.app)");
    }
  };

  if (!isConfigured) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-base-300 p-4">
        <div className="card w-full max-w-md glass-panel shadow-2xl animate-scale-up border border-white/20">
          <div className="card-body items-center text-center p-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mb-4 shadow-lg border border-white/30 rotate-3 cursor-pointer hover:rotate-6 transition-transform">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
               </svg>
            </div>
            <h2 className="card-title text-2xl mb-2 font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">連線大門</h2>
            <p className="text-sm opacity-80 mb-6 leading-relaxed">請輸入您的伺服器位址<br/>(例如 Ngrok 網址)，以建立安全加密連線。</p>
            
            <form onSubmit={handleSaveConfig} className="w-full flex flex-col gap-4">
               <input 
                 type="text" 
                 required 
                 value={serverInput}
                 onChange={e => setServerInput(e.target.value)}
                 className="input w-full bg-white/60 border-none focus:bg-white focus:ring-2 focus:ring-primary/50 shadow-inner rounded-xl font-mono text-center tracking-wider text-primary"
                 placeholder="https://xxxxx.ngrok.app"
               />
               <button type="submit" className="btn btn-primary w-full rounded-xl shadow-lg border-none hover:scale-[1.02] active:scale-[0.98] transition-transform font-bold tracking-widest mt-2 h-12">
                 啟動連線 🚀
               </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (isAccessDenied) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-base-300 p-4">
        <div className="card w-full max-w-md bg-error text-error-content shadow-2xl">
          <div className="card-body items-center text-center">
            <h2 className="card-title text-4xl mb-4 font-black">🚫 拒絕存取</h2>
            <p className="text-lg">您的 IP 位置不在伺服器的白名單中。</p>
            <p className="opacity-80 mt-2">請聯繫系統管理員將您的 IP 加入 server/main.go 以獲取連線權限。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center p-2 md:p-6 gap-6">
      
      {/* Online Users Side Panel (Left) */}
      <div className="hidden md:flex card w-72 h-[88vh] glass-panel shadow-2xl flex-col overflow-hidden animate-scale-up rounded-[2.5rem]">
        <div className="glass-header text-primary p-4 font-bold text-lg text-center flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
          目前在線 ({onlineUsers.length})
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {onlineUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-40 italic text-sm">
              <span className="loading loading-spinner text-primary mb-2"></span>
              尋找旅伴中...
            </div>
          ) : (
            onlineUsers.map(user => (
              <div key={user} className="flex items-center gap-4 p-3 hover:bg-white/40 rounded-2xl transition-all duration-300 border border-transparent hover:border-white/50 group cursor-pointer shadow-sm hover:shadow-md">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shadow-lg group-hover:rotate-6 transition-transform">
                    {user.charAt(0)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-white shadow-sm"></div>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-gray-800 text-sm">{user}</span>
                  <span className="text-[10px] text-success font-medium uppercase tracking-wider">Active</span>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* PWA Install Button or Manual Hint */}
        {installPrompt ? (
          <div className="p-4 border-t border-white/20">
            <button 
              onClick={handleInstallClick}
              className="btn btn-primary w-full rounded-xl shadow-lg border-none animate-bounce"
            >
              📥 安裝此 APP
            </button>
          </div>
        ) : (
          <div className="p-4 border-t border-white/10 opacity-40 hover:opacity-100 transition-opacity">
            <p className="text-[10px] text-center italic">
              提示：若要常駐提醒，請點擊瀏覽器選單 <br/> 
              <strong>「應用程式 → 安裝此站台」</strong>
            </p>
          </div>
        )}
      </div>

      {/* Main Chat Window */}
      <div className="card w-full max-w-3xl h-[88vh] glass-panel shadow-2xl flex flex-col overflow-hidden animate-scale-up rounded-[2.5rem] border border-white/40">
        {/* Header */}
        <div className="glass-header p-5 shadow-sm z-10 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <h1 className="text-2xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent italic tracking-tighter">
                {STRINGS.APP_TITLE.toUpperCase()}
              </h1>
              <span className="text-[10px] font-bold opacity-40 tracking-widest uppercase">Secure End-to-End</span>
            </div>

            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`btn btn-sm btn-circle btn-ghost ${soundEnabled ? 'text-primary' : 'text-gray-400'}`}
              title={soundEnabled ? "音效已開啟" : "音效已關閉"}
            >
              {soundEnabled ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zm10.914-11l3.5 3.5m-3.5 0l3.5-3.5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-30">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.827-1.24L3 20l1.326-3.945A8.96 8.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="font-medium italic">寂靜的頻道... 傳個貼圖打破沉默吧！</p>
            </div>
          )}
          {messages.map(msg => {
            const isMe = msg.sender === currentUser; 
            return (
              <div key={msg.id} className={`chat ${isMe ? 'chat-end' : 'chat-start'} animate-message-in`}>
                <div className="chat-image avatar">
                  <div className="w-8 h-8 rounded-full shadow-md border border-white">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.sender}`} alt="avatar" />
                  </div>
                </div>
                <div className="chat-header opacity-50 text-[10px] font-bold uppercase mb-1 mx-2">
                  {msg.sender} <time className="ml-1 opacity-40">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</time>
                </div>
                <div className={`chat-bubble shadow-lg border-none min-h-0 px-4 py-3 text-sm font-medium ${
                  isMe 
                    ? 'bg-gradient-to-br from-primary to-indigo-600 text-white rounded-2xl rounded-tr-none' 
                    : 'bg-white text-gray-800 rounded-2xl rounded-tl-none'
                  } ${msg.text.startsWith('[STICKER:') ? 'bg-transparent shadow-none p-0 overflow-visible' : ''}`}>
                  {renderMessageText(msg.text)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Area */}
        <div className="p-5 glass-header border-t-0 relative">
          
          {/* Sticker Picker Popup */}
          {showStickers && (
            <div className="absolute bottom-full left-5 mb-4 glass-panel bg-white/95 shadow-2xl rounded-[2rem] p-5 border border-white/60 w-[350px] max-h-80 overflow-y-auto animate-scale-up z-[60]">
              <div className="grid grid-cols-5 gap-4">
                {STICKERS.map(sticker => (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => handleSend(undefined, `[STICKER:${sticker.url}]`)}
                    className="hover:scale-125 hover:-translate-y-1 hover:shadow-xl hover:bg-white/40 rounded-2xl p-2 transition-all duration-300 focus:outline-none flex items-center justify-center bg-transparent"
                  >
                    <img loading="lazy" src={sticker.url} alt={sticker.id} className="w-12 h-12 drop-shadow-md" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSend} className="flex gap-3 items-center">
            <button
              type="button"
              className="btn btn-circle bg-white/50 border-none hover:bg-white text-primary shadow-sm"
              onClick={() => setShowStickers(!showStickers)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <input 
              type="text" 
              placeholder={STRINGS.INPUT_PLACEHOLDER}
              className="input bg-white/60 border-none focus:bg-white focus:ring-2 focus:ring-primary/50 transition-all flex-1 shadow-inner h-12 rounded-2xl font-medium" 
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="btn btn-primary rounded-2xl shadow-lg border-none px-6 h-12 hover:scale-105 active:scale-95 transition-all" 
              disabled={isLoading || !inputText.trim()}
            >
              {isLoading ? <span className="loading loading-spinner"></span> : STRINGS.SEND_BUTTON}
            </button>
          </form>
        </div>
      </div>

      {/* Trace Log Side Panel */}
      {isAdmin && (
        <div className="hidden lg:flex card w-80 h-[88vh] glass-panel shadow-2xl flex-col overflow-hidden animate-scale-up rounded-[2.5rem]">
          <div className="glass-header text-neutral p-4 font-bold text-lg text-center">
            🛡️ 監控軌跡 (Monitor)
          </div>
          <div className="flex-1 overflow-y-auto p-4 text-xs space-y-3 font-mono">
            {traces.length === 0 && <div className="text-center opacity-40 mt-10 italic">載入監控中...</div>}
            {traces.map(t => (
              <div key={t.id} className="p-3 bg-white/40 rounded-2xl border border-white/50 shadow-sm animate-message-in">
                <div className="flex justify-between font-bold text-[9px] opacity-40 mb-2">
                  <span className={`px-2 py-0.5 rounded-full ${t.action === 'SEND' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>{t.action}</span>
                  <span>{new Date(t.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary opacity-50"></div>
                  <span className="font-bold text-gray-700">{t.user}</span>
                  <span className="opacity-30 text-[9px]">@{t.ip}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
