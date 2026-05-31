# 🌸 Lavender Tiny Phone

一部超迷你的手机模拟器，内置微信聊天、塔罗牌占卜、网易云音乐、剧本杀、Liar's Bar 等功能，AI 角色与你实时互动。

## 🚀 部署方案（永久免费）

### 前端 → 又拍云（国内 CDN，无需备案）

又拍云免费联盟提供 **10GB 存储 + 15GB/月 CDN 流量，永久免费**，国内节点极速不白屏。

**部署步骤：**

1. **注册又拍云** → [console.upyun.com](https://console.upyun.com/register)
2. **创建服务** → 类型选「静态文件」，存储类型选「文件存储」
3. **上传文件** → 把 `dist/` 目录里所有文件都上传上去
4. **配置 CDN** → 等你传完就自动有 CDN 加速了
5. **绑定域名**（可选）→ 可以用又拍云提供的 `xxx.test.upcdn.net` 三级域名（免备案）

> 前端文件在哪个平台托管都行，又拍云只是推荐选项。你也可以用腾讯云 COS、阿里云 OSS 的免费层。

### 后端 API → Cloudflare Worker（无限免费请求）

网易云音乐、Gemini AI 等后端功能由 Cloudflare Worker 提供，**每天 10 万次免费请求**。

**部署步骤：**

1. **注册 Cloudflare** → [dash.cloudflare.com](https://dash.cloudflare.com)
2. **进入 Workers & Pages** → 创建 Worker
3. **粘贴代码** → 打开 `worker/api-worker.js`，全选复制到 Worker 编辑器中
4. **部署** → 点「部署」按钮
5. **设置环境变量** → 在 Worker 设置中添加：
   - `GEMINI_API_KEY` = 你的 Google Gemini API Key（AI 对话功能需要，不填也能用其他功能）
6. **绑定域名**（可选）→ Worker 设置 → Triggers → Custom Domain
7. **修改前端配置** → 在又拍云上编辑 `config.js`，把 `__API_BASE__` 改成你的 Worker 地址，例如：
   ```js
   window.__API_BASE__ = 'https://your-worker.xxx.workers.dev';
   ```

> 如果修改了 `config.js`，**不需要重新构建**。直接改又拍云上的那个文件就行。

### 自定义域名

又拍云和 Cloudflare Worker **都支持绑定你自己的域名**。需要先买个域名（阿里云/腾讯云/Cloudflare 都有，大约 30-80 元/年），然后分别绑定到两个服务。

### Gemini API Key 在哪获取？

1. 打开 [aistudio.google.com/apikey](https://aistudio.google.com/apikey)（需要 Google 账号）
2. 点击「Create API Key」
3. 复制生成的 key，填到 Cloudflare Worker 的环境变量 `GEMINI_API_KEY` 中

## 💻 本地开发

```bash
npm install
npm run dev
```

打开 http://localhost:3000

## 🛠 构建生产版本

```bash
npm run build
```

产物在 `dist/` 目录，直接上传到又拍云即可。

## 📁 项目结构

```
public/              → 静态资源（图标、图片、config.js）
  config.js          → 运行时配置（API 地址，部署后直接修改）
  tarot-cards/       → 78 张塔罗牌图片
  manifest.json      → PWA 配置文件
worker/              → Cloudflare Worker 后端
  api-worker.js      → 主 Worker（网易云 API + Gemini AI 代理）
dist/                → 构建产物（上传到又拍云）
server.js            → 本地开发/Zeabur 用的 Express 服务器
zeabur.json          → Zeabur 部署配置（备选方案）
```
