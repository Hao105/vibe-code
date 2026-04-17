import React, { useState, useEffect } from 'react';
import { useNotification } from './hooks/useNotification';
import { useChatScroll } from './hooks/useChatScroll';
import { useFaviconBlink } from './hooks/useFaviconBlink';
import { useSound } from './hooks/useSound';
import { fetchTraces, fetchMe, uploadFile, ChatMessage } from './api/chatApi';
import { STRINGS } from './constants';
import SnakeGame from './components/SnakeGame';
import Screensaver from './components/Screensaver';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traces, setTraces] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // 用於判斷是否該顯示軌跡紀錄
  const [currentUser, setCurrentUser] = useState<string>(''); // 用於記錄自己發送時拿到的真實姓名
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  

  
  const { notify } = useNotification();
  const { startBlink } = useFaviconBlink();
  const { playNotificationSound } = useSound();
  const scrollRef = useChatScroll<ChatMessage[]>(messages);
  const ws = React.useRef<WebSocket | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = React.useRef<number | null>(null);

  const resetIdleTimer = React.useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setIsIdle(true);
    }, 60000); // 60秒無動作觸發
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);
    resetIdleTimer();

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    }
  }, [resetIdleTimer]);

  // 全域剪貼簿上傳機制 (Ctrl+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault(); // 阻止貼在輸入框內的預設行為
          const file = item.getAsFile();
          if (file) {
            if (file.size > 50 * 1024 * 1024) {
              alert("剪貼簿檔案大小不可超過 50MB");
              return;
            }
            setIsUploading(true);
            try {
              const { url } = await uploadFile(file);
              const payload = `[IMAGE:${url}]`;
              if (ws.current?.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ text: payload }));
              }
            } catch (error) {
              alert("剪貼簿圖片上傳失敗");
            } finally {
              setIsUploading(false);
            }
            break; // 每次貼上只處理第一張圖
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const STICKERS = [
    { id: 'grinning', char: '😀' }, { id: 'joy', char: '😂' }, { id: 'rofl', char: '🤣' },
    { id: 'smile_hearts', char: '🥰' }, { id: 'heart_eyes', char: '😍' }, { id: 'star_struck', char: '🤩' },
    { id: 'kiss', char: '😘' }, { id: 'zany', char: '🤪' }, { id: 'cool', char: '😎' },
    { id: 'party', char: '🥳' }, { id: 'smirk', char: '😏' }, { id: 'unamused', char: '😒' },
    { id: 'roll_eyes', char: '🙄' }, { id: 'pleading', char: '🥺' }, { id: 'cry', char: '😭' },
    { id: 'rage', char: '😡' }, { id: 'exploding', char: '🤯' }, { id: 'swear', char: '🤬' },
    { id: 'poop', char: '💩' }, { id: 'clown', char: '🤡' }, { id: 'ghost', char: '👻' },
    { id: 'alien', char: '👽' }, { id: 'robot', char: '🤖' }, { id: 'cat', char: '😺' },
    { id: 'dog', char: '🐶' }, { id: 'monkey', char: '🐵' }, { id: 'unicorn', char: '🦄' },
    { id: 'fire', char: '🔥' }, { id: '100', char: '💯' }, { id: 'sparkles', char: '✨' },
    { id: 'star', char: '🌟' }, { id: 'heart', char: '❤️' }, { id: 'broken_heart', char: '💔' },
    { id: 'thumbs_up', char: '👍' }, { id: 'peace', char: '✌️' }, { id: 'ok', char: '👌' }
  ];

  useEffect(() => {
    // 監聽 PWA 安裝事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);



    // 取得自己的用戶名稱
    fetchMe().then(name => {
      if (name) setCurrentUser(name);
    });

    if (isAccessDenied) return;

    // 建立 WebSocket 連線
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;


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
  }, [isAccessDenied, currentUser, notify]);

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
      const char = text.substring(9, text.length - 1);
      return <span className="text-6xl inline-block animate-bounce drop-shadow-lg">{char}</span>;
    }
    if (text.startsWith('[IMAGE:') && text.endsWith(']')) {
      const url = text.substring(7, text.length - 1);
      return <img src={url} alt="uploaded" className="max-w-[200px] md:max-w-xs rounded-xl shadow-md border border-white/20 mt-2 hover:scale-105 transition-transform" />;
    }
    if (text.startsWith('[FILE:') && text.endsWith(']')) {
      const parts = text.substring(6, text.length - 1).split('|');
      const url = parts[0];
      const filename = parts.length > 1 ? parts[1] : 'Download File';
      return (
        <a href={url} download={filename} target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-white/20 hover:bg-white/30 p-3 rounded-xl transition-colors mt-2 no-underline text-current group shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-white/40 flex items-center justify-center text-xl group-hover:-translate-y-1 transition-transform drop-shadow-sm">📥</div>
          <div className="flex flex-col">
            <span className="font-bold text-sm truncate max-w-[150px] md:max-w-[200px]">{filename}</span>
            <span className="text-[10px] opacity-70">點擊下載</span>
          </div>
        </a>
      );
    }
    return text;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert("檔案大小不可超過 50MB");
      return;
    }

    setIsUploading(true);
    try {
      const { url, filename, isImage } = await uploadFile(file);
      const payload = isImage ? `[IMAGE:${url}]` : `[FILE:${url}|${filename}]`;
      handleSend(undefined, payload);
    } catch (error) {
      alert("檔案上傳失敗");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
    <>
      {isIdle && <Screensaver />}
      <div className="flex h-screen w-full items-center justify-center p-2 md:p-6 gap-6 relative overflow-hidden" onClick={resetIdleTimer}>
        
        {/* Flashy Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="floating-shape absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/40 rounded-full mix-blend-multiply blur-[80px]" style={{ animationDelay: '0s' }}></div>
        <div className="floating-shape absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-secondary/30 rounded-full mix-blend-multiply blur-[100px]" style={{ animationDelay: '4s' }}></div>
        <div className="floating-shape absolute bottom-[-20%] left-[20%] w-[800px] h-[800px] bg-accent/40 rounded-full mix-blend-multiply blur-[120px]" style={{ animationDelay: '8s' }}></div>
      </div>

      {/* Online Users Side Panel (Left) */}
      <div className="hidden md:flex flex-col relative z-10 card w-72 h-[88vh] glass-panel shadow-2xl overflow-hidden animate-scale-up rounded-[2.5rem]">
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
            onlineUsers.map(user => {
              const isMe = user.name === currentUser;
              return (
                <div key={user.name} className="flex items-center gap-4 p-3 hover:bg-white/40 rounded-2xl transition-all duration-300 border border-transparent hover:border-white/50 group cursor-pointer shadow-sm hover:shadow-md">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shadow-lg group-hover:rotate-6 transition-transform">
                      {user.name.charAt(0)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-white shadow-sm"></div>
                  </div>
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-gray-800 text-sm">{user.name}</span>
                    {isMe ? (
                      <input 
                        type="text" 
                        placeholder="打點什麼..." 
                        className="input input-xs input-ghost text-[10px] text-success font-medium uppercase tracking-wider h-5 px-1 mt-0.5 focus:bg-white focus:outline-none focus:border-success/30 rounded w-full" 
                        defaultValue={user.status || ''}
                        onBlur={(e) => {
                          if (ws.current?.readyState === WebSocket.OPEN) {
                            ws.current.send(JSON.stringify({ type: 'STATUS', status: e.target.value.trim() }));
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                      />
                    ) : (
                      <span className="text-[10px] text-success font-medium uppercase tracking-wider pl-1">{user.status || 'Active'}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* PWA Install Button or Manual Hint */}
        <div className="p-4 border-t border-white/20 flex flex-col gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsIdle(true);
            }}
            className="btn btn-secondary btn-outline w-full rounded-xl text-white shadow-sm hover:shadow-md bg-white/20 border-white/40 font-bold"
          >
            💤 進入放空模式
          </button>
          
          {installPrompt ? (
            <button 
              onClick={handleInstallClick}
              className="btn btn-primary w-full rounded-xl shadow-lg border-none animate-bounce mt-2"
            >
              📥 安裝此 APP
            </button>
          ) : (
            <p className="text-[10px] text-center italic opacity-40 mt-1">
              提示：若要常駐提醒，請點擊瀏覽器選單 <br/> 
              <strong>「應用程式 → 安裝此站台」</strong>
            </p>
          )}
        </div>
      </div>

      {/* Main Chat Window */}
      <div className="relative z-10 card w-full max-w-3xl h-[88vh] glass-panel shadow-2xl flex flex-col overflow-hidden animate-scale-up rounded-[2.5rem] border border-white/40">
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
                  <div className="w-8 h-8 rounded-full shadow-md border border-white bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                    {msg.sender.charAt(0)}
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
                    onClick={() => handleSend(undefined, `[STICKER:${sticker.char}]`)}
                    className="hover:scale-125 hover:-translate-y-1 hover:shadow-xl hover:bg-white/40 rounded-2xl p-2 transition-all duration-300 focus:outline-none flex items-center justify-center bg-transparent"
                  >
                    <span className="text-3xl drop-shadow-md">{sticker.char}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSend} className="flex gap-2 md:gap-3 items-center">
            <button
              type="button"
              className="btn btn-circle bg-white/50 border-none hover:bg-white text-primary shadow-sm"
              onClick={() => setShowStickers(!showStickers)}
              title="貼圖"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            <button
              type="button"
              className="btn btn-circle bg-white/50 border-none hover:bg-white text-primary shadow-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="上傳圖片或檔案 (上限 50MB)"
            >
              {isUploading ? <span className="loading loading-spinner loading-sm"></span> : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
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

      {/* Snake Game Side Panel (Right) */}
      <div className="hidden xl:flex relative z-10">
        <SnakeGame />
      </div>

      {/* Trace Log Side Panel (Only if Admin, will push UI or stack) */}
      {isAdmin && (
        <div className="hidden 2xl:flex relative z-10 card w-80 h-[88vh] glass-panel shadow-2xl flex-col overflow-hidden animate-scale-up rounded-[2.5rem]">
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
    </>
  );
}
