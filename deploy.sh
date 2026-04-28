#!/bin/bash
# 机票价格监测 - 一键部署脚本
# 在云服务器上运行此脚本即可完成部署

set -e

echo "======================================"
echo "  ✈️  机票价格监测 - 一键部署"
echo "======================================"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "📦 正在安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker 安装完成"
fi

# 检查 Docker Compose
if ! command -v docker compose &> /dev/null; then
    echo "📦 正在安装 Docker Compose..."
    apt-get update -qq && apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose 安装完成"
fi

# 创建数据目录
mkdir -p data

# 构建并启动
echo ""
echo "🔨 正在构建镜像（首次约需 5-10 分钟）..."
docker compose build

echo ""
echo "🚀 正在启动服务..."
docker compose up -d

# 等待服务就绪
echo ""
echo "⏳ 等待服务启动..."
sleep 5

# 获取公网 IP
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 ip.sb 2>/dev/null || echo "YOUR_SERVER_IP")

echo ""
echo "======================================"
echo "  ✅ 部署成功！"
echo "======================================"
echo ""
echo "  📱 手机/电脑访问地址："
echo "     http://${PUBLIC_IP}:9400"
echo ""
echo "  🔧 常用命令："
echo "     查看日志：docker compose logs -f"
echo "     重启服务：docker compose restart"
echo "     停止服务：docker compose down"
echo "     更新应用：git pull && docker compose up -d --build"
echo ""
echo "  ⚠️  请确保云服务器安全组已开放 9400 端口"
echo "======================================"
