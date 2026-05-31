/**
 * API 地址工具函数
 * 开发环境：走 Vite 内置 API（/api/*）
 * 部署环境：走 Cloudflare Worker（通过 public/config.js 配置 __API_BASE__）
 * 构建后只需修改 dist/config.js 中的 __API_BASE__，无需重新构建
 */
export function apiUrl(path: string): string {
  const base =
    typeof window !== 'undefined'
      ? (window as any).__API_BASE__ || ''
      : '';
  // 如果 base 非空但结尾有 /，去掉
  const cleanBase = base.replace(/\/+$/, '');
  // path 以 / 开头，cleanBase 可能为空或完整 URL
  return cleanBase ? `${cleanBase}${path}` : path;
}
