export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

export const getServerUrl = () => '/api';

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

export const uploadFile = async (file: File): Promise<{url: string, filename: string, isImage: boolean}> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch(`${getServerUrl()}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    });

    if (res.status === 403) {
      throw new Error('ACCESS_DENIED');
    }
    if (!res.ok) throw new Error('API Error');
    
    return res.json();
  } catch (error) {
    console.error('Failed to upload file:', error);
    throw error;
  }
};
