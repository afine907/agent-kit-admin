FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm（使用与项目兼容的版本）
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# 复制根目录的 package.json、pnpm-lock.yaml 和 workspace 配置
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 复制 web 目录的 package.json
COPY apps/web/package.json ./apps/web/

# 安装依赖（包括 devDependencies）
RUN pnpm install --frozen-lockfile

# 复制 web 源代码
COPY apps/web ./apps/web

# 进入 web 目录并构建
WORKDIR /app/apps/web
RUN pnpm exec tsc && pnpm exec vite build

# 生产阶段
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动
CMD ["nginx", "-g", "daemon off;"]
