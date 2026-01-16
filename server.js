const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// 配置会话
app.use(session({
  secret: process.env.SESSION_SECRET || 'file-server-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // 在生产环境中设置为 true（需要 HTTPS）
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// 认证中间件
function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: '需要登录' });
  }
}

// 启动目录（存储文件的目录）
// 可以通过环境变量 STORAGE_DIR 自定义存储路径
// 默认使用项目目录下的 files 文件夹
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, 'files');

// 确保存储目录存在
if (!fsSync.existsSync(STORAGE_DIR)) {
  fsSync.mkdirSync(STORAGE_DIR, { recursive: true });
}

// 配置 multer 用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 从请求中获取当前路径，默认为空字符串（根目录）
    const currentPath = req.body.currentPath || '';
    const targetDir = path.join(STORAGE_DIR, currentPath);
    
    // 确保目标目录存在
    if (!fsSync.existsSync(targetDir)) {
      fsSync.mkdirSync(targetDir, { recursive: true });
    }
    
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    // 保持原始文件名，如果重复则添加时间戳
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const currentPath = req.body.currentPath || '';
    const targetDir = path.join(STORAGE_DIR, currentPath);
    const filePath = path.join(targetDir, originalName);

    if (fsSync.existsSync(filePath)) {
      const ext = path.extname(originalName);
      const name = path.basename(originalName, ext);
      const timestamp = Date.now();
      cb(null, `${name}_${timestamp}${ext}`);
    } else {
      cb(null, originalName);
    }
  }
});

const upload = multer({ storage });

// 解析 JSON 和 URL 编码的请求体
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（除了根路径，其他都需要认证）
app.use(express.static('public'));

// 登录 API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // 从环境变量获取用户名和密码，或使用默认值
  const validUsername = process.env.USERNAME || 'admin';
  const validPassword = process.env.PASSWORD || 'password';
  
  if (username === validUsername && password === validPassword) {
    req.session.authenticated = true;
    req.session.username = username;
    res.json({ message: '登录成功', username });
  } else {
    res.status(401).json({ error: '用户名或密码错误' });
  }
});

// 登出 API
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: '登出失败' });
    }
    res.json({ message: '登出成功' });
  });
});

// 检查认证状态 API
app.get('/api/auth-status', (req, res) => {
  if (req.session.authenticated) {
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.json({ authenticated: false });
  }
});

// 获取文件列表 API
app.get('/api/files', requireAuth, async (req, res) => {
  try {
    const subPath = req.query.path || '';
    const currentDir = path.join(STORAGE_DIR, subPath);

    // 安全检查：防止路径遍历攻击
    if (!currentDir.startsWith(STORAGE_DIR)) {
      return res.status(403).json({ error: '非法访问' });
    }

    if (!fsSync.existsSync(currentDir)) {
      return res.status(404).json({ error: '目录不存在' });
    }

    const files = await fs.readdir(currentDir);
    const fileList = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(currentDir, filename);
        const stats = await fs.stat(filePath);
        const relativePath = path.join(subPath, filename);

        return {
          name: filename,
          size: stats.size,
          modified: stats.mtime,
          isDirectory: stats.isDirectory(),
          path: stats.isDirectory()
            ? relativePath
            : `/download/${encodeURIComponent(relativePath)}`
        };
      })
    );

    // 按类型和名称排序（目录在前）
    fileList.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    res.json({
      currentPath: subPath,
      files: fileList
    });
  } catch (error) {
    res.status(500).json({ error: '读取文件列表失败' });
  }
});

// 搜索文件 API
app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const query = req.query.q || '';
    const searchPath = req.query.path || '';

    if (!query) {
      return res.json({ results: [] });
    }

    const currentDir = path.join(STORAGE_DIR, searchPath);

    // 安全检查
    if (!currentDir.startsWith(STORAGE_DIR)) {
      return res.status(403).json({ error: '非法访问' });
    }

    const results = [];

    // 递归搜索函数
    async function searchDirectory(dir, relativePath = '') {
      try {
        const files = await fs.readdir(dir);

        for (const filename of files) {
          const filePath = path.join(dir, filename);
          const stats = await fs.stat(filePath);
          const fileRelativePath = path.join(relativePath, filename);

          // 模糊匹配文件名
          if (filename.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              name: filename,
              size: stats.size,
              modified: stats.mtime,
              isDirectory: stats.isDirectory(),
              path: stats.isDirectory()
                ? fileRelativePath
                : `/download/${encodeURIComponent(fileRelativePath)}`,
              relativePath: fileRelativePath
            });
          }

          // 递归搜索子目录
          if (stats.isDirectory()) {
            await searchDirectory(filePath, fileRelativePath);
          }
        }
      } catch (error) {
        // 忽略无法访问的目录
      }
    }

    await searchDirectory(currentDir, searchPath);

    // 按类型和名称排序
    results.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    res.json({ results, query });
  } catch (error) {
    res.status(500).json({ error: '搜索失败' });
  }
});

// 文件下载 API
app.get('/download/:filename(*)', requireAuth, (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.join(STORAGE_DIR, filename);

  // 安全检查：防止路径遍历攻击
  if (!filePath.startsWith(STORAGE_DIR)) {
    return res.status(403).json({ error: '非法访问' });
  }

  if (!fsSync.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  res.download(filePath, path.basename(filename));
});

// 文件上传 API
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }

  // 构建相对路径用于下载链接
  const currentPath = req.body.currentPath || '';
  const relativePath = currentPath ? `${currentPath}/${req.file.filename}` : req.file.filename;

  res.json({
    message: '文件上传成功',
    filename: req.file.filename,
    size: req.file.size,
    path: `/download/${encodeURIComponent(relativePath)}`
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 文件服务器已启动！`);
  console.log(`📁 存储目录: ${STORAGE_DIR}`);
  console.log(`🌐 访问地址: http://localhost:${PORT}`);
  console.log(`\n按 Ctrl+C 停止服务器\n`);
});
