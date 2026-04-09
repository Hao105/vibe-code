export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

// 判斷是否為生產環境 (例如 GitHub Pages)，若是則指向您的 Go 後端真實位址
// TODO(2024-05-01): 系統管理員 - 若要讓外部網路連線，請將 127.0.0.1 修改為您的公網 IP 或 Ngrok 網址
const BASE_URL = import.meta.env.PROD ? 'https://127.0.0.1:8080/api' : 'api';

/**
 * 取得歷史訊息
 */
export const fetchMessages = async (): Promise<ChatMessage[]> => {
  try {
    const res = await fetch(`${BASE_URL}/messages`);
    
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
    const res = await fetch(`${BASE_URL}/traces`);
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
    const res = await fetch(`${BASE_URL}/me`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.username;
  } catch {
    return null;
  }
};

export const sendMessage = async (text: string): Promise<ChatMessage> => {
  try {
    const res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
