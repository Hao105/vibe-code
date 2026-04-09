export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

// 從 localStorage 動態取得伺服器網址
export const getServerUrl = () => {
  // 開發環境仍維持相對路徑，善用 Vite Proxy
  if (!import.meta.env.PROD) return 'api';
  
  const savedUrl = localStorage.getItem('chat_server_url');
  if (savedUrl) {
    // 確保結尾沒有斜線
    return `${savedUrl.replace(/\/$/, '')}/api`;
  }
  return ''; // 若無設定，回傳空字串 (會導致後續請求失敗，交由 UI 阻斷)
};

/**
 * 取得歷史訊息
 */
export const fetchMessages = async (): Promise<ChatMessage[]> => {
  try {
    const res = await fetch(`${getServerUrl()}/messages`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    // IP 白名單攔截檢查
    if (res.status === 403) {
      throw new Error('ACCESS_DENIED');
    }
    
    if (!res.ok) throw new Error('API Error');
    return res.json();
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    throw error; // 呼叫端必須使用 try/catch 區塊並妥善處理 Loading 狀態
  }
};

/**
 * 發送訊息
 */
export const fetchTraces = async (): Promise<any[] | null> => {
  try {
    const res = await fetch(`${getServerUrl()}/traces`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.status === 403) return null; // 403 表示權限不足(非管理員)，回傳 null
    if (!res.ok) throw new Error('API Error');
    return res.json();
  } catch (error) {
    console.error('Failed to fetch traces:', error);
    return [];
  }
};

export const fetchMe = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${getServerUrl()}/me`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.username;
  } catch {
    return null;
  }
};

export const sendMessage = async (text: string): Promise<ChatMessage> => {
  try {
    const res = await fetch(`${getServerUrl()}/messages`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ text }) // 不再傳送 sender，由後端決定
    });

    if (res.status === 403) {
      throw new Error('ACCESS_DENIED');
    }

    if (!res.ok) throw new Error('API Error');
    return res.json();
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
};
