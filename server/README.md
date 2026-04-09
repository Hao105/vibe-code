# Antigravity Go Chat Server

這是聊天室的後端服務，使用 Go 語言開發。

## 如何執行後端
1. 進入目錄：`cd server`
2. 執行：`go run main.go`
3. 預期輸出：`🚀 Antigravity Chat Server is running on http://localhost:8080`

## API 指南
- **GET /api/messages**: 取得所有訊息列表
- **POST /api/messages**: 發送新訊息
  - Body: `{"text": "your message"}`
