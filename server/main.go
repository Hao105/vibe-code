package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

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

var (
	whitelist     map[string]string
	whitelistLock sync.RWMutex

	messages = []Message{
		{ID: "1", Sender: "System", Text: "Go Server 已上線！已升級 WebSocket 即時通訊。", Timestamp: time.Now()},
	}
	mu sync.Mutex

	traces   []Trace
	traceMu  sync.Mutex

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

	var uniqUsers []string
	for name := range users {
		uniqUsers = append(uniqUsers, name)
	}

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

	fmt.Println("🚀 Antigravity Chat Server is running on https://localhost:8080")
	log.Fatal(http.ListenAndServeTLS(":8080", "cert.pem", "key.pem", nil))
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
		var msg Message
		err := ws.ReadJSON(&msg)
		if err != nil {
			log.Printf("Client disconnected (%s): %v", userName, err)
			clientsMu.Lock()
			delete(clients, ws)
			clientsMu.Unlock()
			go broadcastOnlineUsers()
			addTrace("LEAVE", userName, ip)
			break
		}

		msg.ID = fmt.Sprintf("%d", time.Now().UnixNano())
		msg.Timestamp = time.Now()
		msg.Sender = userName

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
