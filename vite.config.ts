import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  base: '/vibe-code/',
  plugins: [react()],
  server: {
    host: true,
    https: fs.existsSync(path.resolve(__dirname, 'server/key.pem')) && 
           fs.existsSync(path.resolve(__dirname, 'server/cert.pem')) 
      ? {
          key: fs.readFileSync(path.resolve(__dirname, 'server/key.pem')),
          cert: fs.readFileSync(path.resolve(__dirname, 'server/cert.pem')),
        }
      : false,
    proxy: {
      '/api': {
        target: 'https://127.0.0.1:8080',
        secure: false, // 忽略自簽名憑證 TLS 錯誤
        changeOrigin: true,
        ws: true, // 支援 WebSocket 代理
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            const remoteIp = req.socket.remoteAddress || '';
            const cleanIp = remoteIp.replace(/^::ffff:/, '');
            proxyReq.setHeader('X-Real-IP', cleanIp);
          });
          proxy.on('proxyReqWs', (proxyReq, req, _socket, _options, _head) => {
            const remoteIp = req.socket.remoteAddress || '';
            const cleanIp = remoteIp.replace(/^::ffff:/, '');
            proxyReq.setHeader('X-Real-IP', cleanIp);
          });
        }
      }
    }
  }
})
