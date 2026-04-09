# Antigravity React Chat Room

這是依據 Antigravity 專案開發規範建置的高級感全端聊天室。
採用 **React (Vite)** + **Go (Gin/Gorilla)** 的現代化架構，具備 **PWA 安裝**、**即時通訊**、**IP 安全白名單**與**極致視覺美學**。

---

## ✨ 核心特色

1. **極致視覺體驗 (Glassmorphism)**: 採用半透明磨砂玻璃設計，搭配背景動態流體漸層，提供 premium 等級的視覺享受。
2. **即時雙向通訊 (WebSocket)**: 秒發秒至，支援表情貼圖解析與即時在線名單追蹤。
3. **PWA 安裝支援**: 支援將網頁直接「安裝」到桌面或手機，擁有獨立圖示、系統工作列提醒與自帶叮咚提示音。
4. **多維度提醒機制**: 結合「系統推播通知」、「網頁標籤紅點閃爍」與「任務列 Badge 標記」。
5. **安全存取控制**: 內建動態 IP 白名單熱更新機制，未授權用戶將自動導向存取拒絕頁面。
6. **管理員監控 (Trace Log)**: 專屬管理員權限可實時監控所有用戶的發送軌跡與連線來源。

---

## 🛠️ 自動化部署 (GitHub Actions)

本專案已配置 **CI/CD 自動化部署流程** (`.github/workflows/deploy.yml`)。

### 部署流程：
1. **Push 更新**：只要將程式碼推送到 GitHub 的 `main` 分支。
2. **自動 Build**：GitHub Actions 會自動啟動虛擬環境進行 `npm run build`。
3. **佈署 Pages**：編譯後的靜態檔案會被自動推送到同步的 `gh-pages` 分支。
4. **上線**：您的前端聊天室將在 `https://您的帳號.github.io/專案名` 即時更新。

> **注意：** GitHub Pages 僅提供靜態網頁託管。您的 **Go Server** 仍需運行於具備公網 IP 的環境（或本機電腦），並確保前端 API 網址指向正確。

---

## 🚀 快速啟動指南

### 1. 啟動後端 (Go Server)
```powershell
cd server
go build -o app.exe main.go
.\app.exe
```
*後端預設執行於 https://localhost:8080，支援 HTTPS 自簽憑證。*

### 2. 啟動前端 (React Vite)
```powershell
npm install
npm run dev
```
*前端將執行於 https://localhost:5173。*

---

## 📱 安裝為桌面 App (PWA)

為了獲得最佳體驗（不漏掉訊息），強烈建議將網頁安裝為 App：
1. 使用 **Microsoft Edge** 或 **Chrome** 開啟聊天室。
2. 點擊網址列右側的 **[+]** (安裝應用程式) 圖示。
3. 安裝後從桌面啟動，並將其**釘選到工作列**。
4. **叮咚提示音**：在 App 右上角開啟小喇叭圖示，即可在背景接收聲音提醒。

---

## 🛡️ 管理員權限 (Whitelist 設定)
管理員與使用者名單定義於 `server/whitelist.json`。
* 若 IP 顯示為 `Admin`，將自動開啟右側的 **監控軌跡 (Monitor)** 面板。
* 支援**熱更新**：直接修改 `whitelist.json`，後端會自動在 3 秒內載入新設定，無需重啟。

---

## 📦 系統目錄架構
- `/src`: React 前端原始碼 (包含 Hooks, API, Components)。
- `/public`: 靜態資源、PWA Manifest 與 Service Worker。
- `/server`: Go 語言實現的即時後端。
- `.github/workflows`: 自動化部署流程定義。
