# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# npm 使用淘宝镜像
RUN npm config set registry https://registry.npmmirror.com

COPY package.json ./
RUN npm install

COPY index.html ./
COPY main.tsx index.tsx constants.ts ./
COPY tsconfig.json vite.config.ts tailwind.config.js tailwind.css postcss.config.js ./
COPY components/ ./components/
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# apt 使用阿里云镜像
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources

RUN apt-get update && apt-get install -y \
    wget curl gnupg \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpango-1.0-0 libcairo2 libx11-6 libxext6 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# pip 使用清华镜像
COPY requirements.txt ./
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# Playwright 使用国内 CDN 镜像
ENV PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright/
RUN playwright install chromium
RUN apt-get update && apt-get install -y fonts-unifont fonts-ubuntu 2>/dev/null; \
    playwright install-deps chromium 2>/dev/null || true; \
    rm -rf /var/lib/apt/lists/*

COPY server.py ./

COPY --from=frontend-builder /build/dist ./static

RUN mkdir -p data

EXPOSE 9400

ENV PORT=9400
ENV DB_PATH=/app/data/flights.db

CMD ["python", "server.py"]
