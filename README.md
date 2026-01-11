# 文件服务器

一个功能完整的文件服务器应用，支持文件上传、下载和分享。

## 功能特性

✨ **核心功能**
- 📂 显示启动目录所有文件列表
- ⬇️ 文件下载功能
- ☁️ 文件上传功能（支持拖拽上传）
- 📋 一键复制文件分享链接
- 📊 显示文件大小和修改时间
- 🎨 美观的现代化界面

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动。

### 3. 访问应用

在浏览器中打开 `http://localhost:3000`

## 使用说明

### 上传文件

- **方式一**：点击上传区域的"选择文件"按钮
- **方式二**：直接拖拽文件到上传区域

### 下载文件

点击文件右侧的下载按钮 ⬇️

### 复制分享链接

点击文件右侧的复制按钮 📋，链接将自动复制到剪贴板，可以分享给其他用户

## 目录结构

```
http_server/
├── server.js           # 后端服务器
├── package.json        # 项目配置
├── README.md          # 说明文档
├── public/            # 前端静态文件
│   └── index.html     # 主页面
└── files/             # 文件存储目录（自动创建）
```

## 技术栈

- **后端**: Node.js + Express
- **文件上传**: Multer
- **前端**: 原生 HTML/CSS/JavaScript

## 配置

### 修改端口

编辑 `server.js` 文件，修改 `PORT` 变量：

```javascript
const PORT = process.env.PORT || 3000;
```

或通过环境变量设置：

```bash
PORT=8080 npm start
```

### 修改存储目录

通过环境变量设置：

```bash
STORAGE_DIR=/path/to/your/storage npm start
```

或编辑 `server.js` 文件，修改默认路径：

```javascript
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, 'files');
```

## API 接口

### 获取文件列表

```
GET /api/files
```

返回所有文件的列表信息。

### 下载文件

```
GET /download/:filename
```

下载指定文件。

### 上传文件

```
POST /api/upload
```

上传文件，使用 `multipart/form-data` 格式。

## 安全说明

- 包含路径遍历攻击防护
- 文件名重复时自动添加时间戳
- 支持中文文件名

## 许可证

MIT
