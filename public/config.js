// Lavender Tiny Phone — 运行时配置
// 构建后可直接修改此文件，无需重新构建
// API_BASE: 部署后改为 Cloudflare Worker 的地址
//   例如: window.__API_BASE__ = 'https://your-worker.xxx.workers.dev';
// 本地开发时保持为空或 '/'，走 Vite 内置 API 中间件

window.__API_BASE__ = window.__API_BASE__ || '';
