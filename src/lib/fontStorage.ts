/**
 * 字体注入工具
 * 方案：FontFace API（ArrayBuffer 直接加载）+ CSS 全局规则 + IndexedDB 持久化
 *
 * 为什么不用 CSS @font-face 的 url(data:...) 或 url(blob:...)？
 * - 华为内置浏览器对超长 data URL 的 CSS 解析有问题
 * - Blob URL 在某些浏览器 file:// 协议下被限制
 * - FontFace API 直接接收 ArrayBuffer，无 URL 长度问题
 */

const DB_NAME = 'dc-font-store';
const DB_VERSION = 1;
const STORE_NAME = 'fonts';
const FONT_STYLE_ID = '__custom_font_style__';

let currentFont: FontFace | null = null;

/** 打开 IndexedDB 数据库 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 保存字体原始数据到 IndexedDB */
export async function saveFontData(fontName: string, arrayBuffer: ArrayBuffer): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(arrayBuffer, fontName);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** 从 IndexedDB 读取字体原始数据 */
export async function loadFontData(fontName: string): Promise<ArrayBuffer | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(fontName);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** 从 IndexedDB 删除字体数据 */
async function deleteFontData(fontName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(fontName);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** FontFace API 加载字体字体 + CSS 全局规则确保动态元素也生效 */
export async function injectFont(fontName: string, arrayBuffer: ArrayBuffer): Promise<void> {
  const oldStyle = document.getElementById(FONT_STYLE_ID);
  if (oldStyle) oldStyle.remove();

  if (currentFont) {
    document.fonts.delete(currentFont);
    currentFont = null;
  }

  const safeName = fontName.replace(/[^a-zA-Z0-9_-]/g, '') || 'CustomFont';

  // FontFace API 直接加载 ArrayBuffer，不经过 URL
  let fontLoaded = false;
  try {
    const fontFace = new FontFace(safeName, arrayBuffer);
    await fontFace.load();
    document.fonts.add(fontFace);
    currentFont = fontFace;
    fontLoaded = true;
    console.log('[Font] loaded via FontFace API:', fontName);
  } catch (e) {
    console.warn('[Font] FontFace API with ArrayBuffer failed:', e);
  }

  // 无论如何都注入 CSS 全局规则（确保所有动态元素应用字体）
  // 如果 FontFace 注册成功了，浏览器会用注册的字体渲染
  // 如果没成功，CSS @font-face 作为兜底
  const cssParts: string[] = [];

  if (!fontLoaded) {
    // FontFace 注册失败，用 CSS @font-face 兜底
    // data URL 太长，华为可能有 CSS 解析问题，所以用 Blob URL
    try {
      const blob = new Blob([arrayBuffer], { type: 'application/x-font-ttf' });
      const blobUrl = URL.createObjectURL(blob);
      cssParts.push(`@font-face{font-family:'${safeName}';src:url('${blobUrl}');}`);
    } catch (e) {
      console.warn('[Font] Blob URL fallback also failed:', e);
    }
  }

  cssParts.push(`*{font-family:'${safeName}',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif!important}`);
  const style = document.createElement('style');
  style.id = FONT_STYLE_ID;
  style.textContent = cssParts.join('');
  document.head.appendChild(style);
}

/** 从 IndexedDB 读取并注入已保存的字体 */
export async function loadAndInjectFont(fontName: string): Promise<boolean> {
  try {
    const arrayBuffer = await loadFontData(fontName);
    if (!arrayBuffer) {
      console.warn('[Font] no data in IndexedDB for:', fontName);
      return false;
    }
    await injectFont(fontName, arrayBuffer);
    return true;
  } catch (e) {
    console.error('[Font] loadAndInjectFont failed:', e);
    return false;
  }
}

/** 清除字体注入并从 IndexedDB 删除字体数据 */
export async function removeInjectedFont(fontName?: string): Promise<void> {
  if (currentFont) {
    document.fonts.delete(currentFont);
    currentFont = null;
  }
  const style = document.getElementById(FONT_STYLE_ID);
  if (style) style.remove();
  document.body.style.fontFamily = '';
  if (fontName) {
    try {
      await deleteFontData(fontName);
    } catch (e) {
      console.warn('[Font] delete from IndexedDB failed:', e);
    }
  }
}
