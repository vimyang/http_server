const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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
    cb(null, STORAGE_DIR);
  },
  filename: (req, file, cb) => {
    // 保持原始文件名，如果重复则添加时间戳
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const filePath = path.join(STORAGE_DIR, originalName);

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

// 静态文件服务
app.use(express.static('public'));

// 获取文件列表 API
app.get('/api/files', async (req, res) => {
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

// 文件下载 API
app.get('/download/:filename(*)', (req, res) => {
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
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }

  res.json({
    message: '文件上传成功',
    filename: req.file.filename,
    size: req.file.size,
    path: `/download/${encodeURIComponent(req.file.filename)}`
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 文件服务器已启动！`);
  console.log(`📁 存储目录: ${STORAGE_DIR}`);
  console.log(`🌐 访问地址: http://localhost:${PORT}`);
  console.log(`\n按 Ctrl+C 停止服务器\n`);
});
