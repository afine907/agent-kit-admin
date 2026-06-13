FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json* ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建
RUN npm run build

# 全局安装
RUN npm link

# 入口
ENTRYPOINT ["akit"]
