FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

# 複製 Nginx 設定檔
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 複製打包後的靜態檔，依照 vite base 的設定放進 /vibe-code
RUN mkdir -p /usr/share/nginx/html/vibe-code
COPY --from=builder /app/dist /usr/share/nginx/html/vibe-code

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
