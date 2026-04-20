package main

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

func init() {
	// 避免在脫機 Windows 環境下，因缺乏註冊表關聯而導致 CSS/JS 檔案的 Content-Type 不能正確解析 (引起 ERR_BLOCKED_BY_ORB 問題)
	mime.AddExtensionType(".css", "text/css")
	mime.AddExtensionType(".js", "application/javascript")
	mime.AddExtensionType(".svg", "image/svg+xml")
	mime.AddExtensionType(".html", "text/html")
	mime.AddExtensionType(".webmanifest", "application/manifest+json")
	mime.AddExtensionType(".json", "application/json")
}

type Message struct {
	ID        string    `json:"id"`
	Sender    string    `json:"sender"`
	Text      string    `json:"text"`
	Timestamp time.Time `json:"timestamp"`
}

type Trace struct {
	ID        string    `json:"id"`
	Action    string    `json:"action"`
	User      string    `json:"user"`
	IP        string    `json:"ip"`
	Timestamp time.Time `json:"timestamp"`
}

type WSPacket struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type IncomingPacket struct {
	Type   string `json:"type"` // empty or 'MESSAGE' / 'STATUS'
	Text   string `json:"text"`
	Status string `json:"status"`
}

type UserStatus struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

var (
	whitelist     map[string]string
	whitelistLock sync.RWMutex

	messages = []Message{
		{ID: "1", Sender: "System", Text: "Go Server 已上線！已升級 WebSocket 即時通訊。", Timestamp: time.Now()},
	}
	mu sync.Mutex

	traces   []Trace
	traceMu  sync.Mutex

	userStatuses  = make(map[string]string)
	statusMu      sync.RWMutex

	clients   = make(map[*websocket.Conn]string)
	clientsMu sync.Mutex
	broadcast = make(chan WSPacket)

	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

// 廣播最新上線名單
func broadcastOnlineUsers() {
	clientsMu.Lock()
	users := make(map[string]bool)
	for _, name := range clients {
		users[name] = true
	}
	clientsMu.Unlock()

	var uniqUsers []UserStatus
	statusMu.RLock()
	for name := range users {
		uniqUsers = append(uniqUsers, UserStatus{
			Name:   name,
			Status: userStatuses[name],
		})
	}
	statusMu.RUnlock()

	broadcast <- WSPacket{
		Type:    "ONLINE_USERS",
		Payload: uniqUsers,
	}
}

// WebSocket 廣播處理迴圈
func handleMessages() {
	for {
		packet := <-broadcast
		
		clientsMu.Lock()
		for client := range clients {
			err := client.WriteJSON(packet)
			if err != nil {
				log.Printf("WS Error: %v", err)
				client.Close()
				delete(clients, client)
			}
		}
		clientsMu.Unlock()
	}
}

// 新增軌跡紀錄
func addTrace(action, user, ip string) {
	traceMu.Lock()
	defer traceMu.Unlock()
	
	newTrace := Trace{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		Action:    action,
		User:      user,
		IP:        ip,
		Timestamp: time.Now(),
	}
	
	// 只保留最近 20 筆
	traces = append([]Trace{newTrace}, traces...)
	if len(traces) > 20 {
		traces = traces[:20]
	}
}

// 載入白名單
func loadWhitelist() error {
	data, err := os.ReadFile("whitelist.json")
	if err != nil {
		return err
	}

	var newWhitelist map[string]string
	if err := json.Unmarshal(data, &newWhitelist); err != nil {
		return err
	}

	whitelistLock.Lock()
	whitelist = newWhitelist
	whitelistLock.Unlock()

	return nil
}

// 檔案上傳處理程序
func uploadHandler(w http.ResponseWriter, r *http.Request) {
	setupCORS(&w, r)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 白名單驗證
	ip := getClientIP(r)
	whitelistLock.RLock()
	_, allowed := whitelist[ip]
	whitelistLock.RUnlock()
	if !allowed {
		http.Error(w, "Access Denied", http.StatusForbidden)
		return
	}

	// 限制上傳大小 50MB
	r.Body = http.MaxBytesReader(w, r.Body, 50<<20)
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		http.Error(w, "File too large or malformed", http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Error retrieving file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 產生防撞擊新檔名
	timestamp := time.Now().UnixNano() / int64(time.Millisecond)
	cleanFileName := strings.ReplaceAll(handler.Filename, " ", "_")
	newFileName := fmt.Sprintf("%d-%s", timestamp, cleanFileName)
	filePath := filepath.Join("uploads", newFileName)

	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// 判斷是否為圖片，協助前端預處理
	isImage := false
	ext := strings.ToLower(filepath.Ext(newFileName))
	if ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".gif" || ext == ".webp" {
		isImage = true
	}

	url := fmt.Sprintf("/uploads/%s", newFileName)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"url": url,
		"filename": handler.Filename,
		"isImage": isImage,
	})
}

// 背景監聽白名單修改
func watchWhitelist() {
	var lastModTime time.Time

	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		info, err := os.Stat("whitelist.json")
		if err != nil {
			log.Printf("Error checking whitelist.json: %v", err)
			continue
		}

		if info.ModTime().After(lastModTime) {
			if !lastModTime.IsZero() {
				if err := loadWhitelist(); err != nil {
					log.Printf("Failed to reload whitelist.json: %v", err)
				} else {
					log.Println("🔄 Whitelist reloaded automatically from whitelist.json!")
				}
			}
			lastModTime = info.ModTime()
		}
	}
}

// 取得客戶端真實 IP
func getClientIP(r *http.Request) string {
	ip := r.Header.Get("X-Real-IP")
	if ip == "" {
		ip = r.Header.Get("X-Forwarded-For")
	}
	if ip == "" {
		var err error
		ip, _, err = net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}
	}
	if strings.Contains(ip, ",") {
		ip = strings.Split(ip, ",")[0]
	}
	return strings.TrimSpace(ip)
}

func main() {
	// 初始化白名單
	if err := loadWhitelist(); err != nil {
		log.Fatalf("Failed to load initial whitelist: %v", err)
	}
	log.Println("✅ Initial whitelist loaded.")

	// 初始化上傳目錄
	if err := os.MkdirAll("./uploads", 0755); err != nil {
		log.Printf("Warning: Failed to create uploads directory: %v", err)
	}

	// 啟動背景熱更新與 WS 廣播
	go watchWhitelist()
	go handleMessages()

	// 設定路由
	http.HandleFunc("/api/messages", messagesHandler) // 暫留兼容前端 REST
	http.HandleFunc("/api/traces", tracesHandler)
	http.HandleFunc("/api/ws", wsHandler)
	http.HandleFunc("/api/me", func(w http.ResponseWriter, r *http.Request) {
		setupCORS(&w, r)
		ip := getClientIP(r)
		whitelistLock.RLock()
		userName, allowed := whitelist[ip]
		whitelistLock.RUnlock()
		if !allowed {
			http.Error(w, "Access Denied", http.StatusForbidden)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"username": userName})
	})

	// 上傳 API
	http.HandleFunc("/api/upload", uploadHandler)

	// 伺服前端靜態檔案 (取代 Nginx 功能)
	fs := http.FileServer(http.Dir("./dist"))
	http.Handle("/vibe-code/", http.StripPrefix("/vibe-code/", fs))
	
	// 伺服上傳的檔案
	fileFs := http.FileServer(http.Dir("./uploads"))
	http.Handle("/uploads/", http.StripPrefix("/uploads/", fileFs))

	// 如果直接訪問根目錄，自動跳轉
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/vibe-code/", http.StatusFound)
			return
		}
	})

	fmt.Println("🚀 Antigravity Chat Server is running on https://localhost:1501")
	server := &http.Server{
		Addr: ":1501",
		TLSConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
	}
	log.Fatal(server.ListenAndServeTLS("cert.pem", "key.pem"))
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	ip := getClientIP(r)

	whitelistLock.RLock()
	userName, allowed := whitelist[ip]
	whitelistLock.RUnlock()

	if !allowed {
		fmt.Printf("⚠️ 拒絕連線(WS): 未經授權的 IP 來源 %s\n", ip)
		addTrace("DENIED", "Unknown", ip)
		http.Error(w, "Access Denied: IP not in whitelist", http.StatusForbidden)
		return
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS Upgrade Failed: %v\n", err)
		return
	}
	defer ws.Close()

	// 1. 連線成功後，立即單獨發送歷史訊息給該 websocket (不要產生併發寫入)
	mu.Lock()
	historyPacket := WSPacket{
		Type:    "HISTORY",
		Payload: messages,
	}
	if err := ws.WriteJSON(historyPacket); err != nil {
		log.Printf("Failed to send history: %v\n", err)
	}
	mu.Unlock()

	// 2. 註冊客戶端進入廣播池
	clientsMu.Lock()
	clients[ws] = userName
	clientsMu.Unlock()

	// 3. 廣播上線消息給所有人
	go broadcastOnlineUsers()
	addTrace("ENTER", userName, ip)

	for {
		var incoming IncomingPacket
		err := ws.ReadJSON(&incoming)
		if err != nil {
			log.Printf("Client disconnected (%s): %v", userName, err)
			clientsMu.Lock()
			delete(clients, ws)
			clientsMu.Unlock()
			go broadcastOnlineUsers()
			addTrace("LEAVE", userName, ip)
			break
		}

		if incoming.Type == "STATUS" {
			statusMu.Lock()
			userStatuses[userName] = incoming.Status
			statusMu.Unlock()
			go broadcastOnlineUsers()
			continue
		}

		// 處理普通的訊息
		msg := Message{
			ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
			Timestamp: time.Now(),
			Sender:    userName,
			Text:      incoming.Text,
		}

		mu.Lock()
		messages = append(messages, msg)
		mu.Unlock()

		addTrace("SEND", userName, ip)
		fmt.Printf("💬 [WS] %s (IP: %s): %s\n", userName, ip, msg.Text)

		broadcast <- WSPacket{
			Type:    "MESSAGE",
			Payload: msg,
		}
	}
}

func tracesHandler(w http.ResponseWriter, r *http.Request) {
	setupCORS(&w, r)
	if r.Method == "OPTIONS" {
		return
	}

	ip := getClientIP(r)

	whitelistLock.RLock()
	userName, allowed := whitelist[ip]
	whitelistLock.RUnlock()

	// 檢查是否為合法IP且身分為Admin
	if !allowed || userName != "Admin" {
		http.Error(w, "Access Denied: Only Admin can view traces", http.StatusForbidden)
		return
	}

	traceMu.Lock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(traces)
	traceMu.Unlock()
}

func messagesHandler(w http.ResponseWriter, r *http.Request) {
	setupCORS(&w, r)
	if r.Method == "OPTIONS" {
		return
	}

	ip := getClientIP(r)

	// 安全的讀取白名單
	whitelistLock.RLock()
	userName, allowed := whitelist[ip]
	whitelistLock.RUnlock()

	if !allowed {
		fmt.Printf("⚠️ 拒絕連線: 未經授權的 IP 來源 %s\n", ip)
		addTrace("DENIED", "Unknown", ip)
		http.Error(w, "Access Denied: IP not in whitelist", http.StatusForbidden)
		return
	}

	switch r.Method {
	case "GET":
		// 紀錄進入聊天室的軌跡
		addTrace("ENTER", userName, ip)
		
		mu.Lock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(messages)
		mu.Unlock()

	case "POST":
		var msg Message
		if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
			http.Error(w, "Invalid message", http.StatusBadRequest)
			return
		}
		
		msg.ID = fmt.Sprintf("%d", time.Now().UnixNano())
		msg.Timestamp = time.Now()
		msg.Sender = userName
		
		mu.Lock()
		messages = append(messages, msg)
		mu.Unlock()

		// 紀錄發言軌跡
		addTrace("SEND", userName, ip)

		fmt.Printf("💬 %s (IP: %s): %s\n", userName, ip, msg.Text)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(msg)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func setupCORS(w *http.ResponseWriter, r *http.Request) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
	(*w).Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, ngrok-skip-browser-warning")
}
