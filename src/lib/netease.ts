// 网易云音乐服务 — 通过 Cloudflare Worker 代理调用
// 部署后需修改 public/config.js 中的 __API_BASE__

import { Song } from '../types';
import { apiUrl } from './apiBase';

const DEFAULT_LYRICS = '[00:00.00] 暂无歌词\n[00:10.00] 正在播放这首歌';

/** 尝试把输入解析为 URL，自动补 https:// */
function tryParseUrl(input: string): URL | null {
  try { return new URL(input); } catch {}
  try { return new URL('https://' + input); } catch {}
  return null;
}

async function callApi<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const allParams = { endpoint, ...params };
  const query = '?' + new URLSearchParams(allParams).toString();
  const res = await fetch(apiUrl(`/api${query}`));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`请求失败 (${res.status}): ${text}`);
  }
  return res.json();
}

/** 解析网易云短链接（163cn.tv），获取真实类型和 ID */
export async function resolveShortUrl(input: string): Promise<{ type: 'song' | 'playlist' | 'unknown'; id: string | null } | null> {
  try {
    const url = tryParseUrl(input);
    if (!url) return null;
    if (!url.hostname.includes('163cn.tv') && !url.hostname.includes('126.net')) return null;
    const res = await fetch(apiUrl(`/api/resolve?url=${encodeURIComponent(input)}`));
    if (res.ok) return res.json();
    return null;
  } catch { return null; }
}

export function extractPlaylistId(input: string): string | null {
  if (/^\d+$/.test(input.trim())) return input.trim();
  try {
    const url = tryParseUrl(input);
    if (url && (url.hostname.includes('music.163.com') || url.hostname.includes('163.cn') || url.hostname.includes('126.net') || url.hostname.includes('163cn.tv'))) {
      const pathMatch = url.pathname.match(/\/playlist\/(\d+)/);
      if (pathMatch) return pathMatch[1];
      const idParam = url.searchParams.get('id');
      if (idParam) return idParam;
      // #/playlist?id=xxx 或 #/playlist/xxx
      const hashMatch = url.hash.match(/\/playlist(?:\?id=|\/)(\d+)/);
      if (hashMatch) return hashMatch[1];
    }
    const allNums = input.match(/(\d+)/g);
    if (allNums?.length) return allNums[allNums.length - 1];
  } catch {
    const allNums = input.match(/(\d+)/g);
    if (allNums?.length) return allNums[allNums.length - 1];
  }
  return null;
}

export function extractSongId(input: string): string | null {
  // 纯数字 ID
  if (/^\d+$/.test(input.trim())) return input.trim();
  try {
    const url = tryParseUrl(input);
    if (url && (url.hostname.includes('music.163.com') || url.hostname.includes('163.cn') || url.hostname.includes('126.net') || url.hostname.includes('163cn.tv'))) {
      // ?id=xxx
      const idParam = url.searchParams.get('id');
      if (idParam) return idParam;
      // /song/xxx
      const pathMatch = url.pathname.match(/\/song\/(\d+)/);
      if (pathMatch) return pathMatch[1];
      // #/song?id=xxx 或 #/song/xxx
      const hashMatch = url.hash.match(/\/song(?:\?id=|\/)(\d+)/);
      if (hashMatch) return hashMatch[1];
    }
  } catch {}
  return null;
}

async function fetchLyrics(songId: number): Promise<string> {
  try {
    const data = await callApi<any>('lyric', { id: String(songId) });
    if (data.code === 200 && data.lrc?.lyric) {
      let result = data.lrc.lyric;
      // 如果有翻译，合并到歌词中
      if (data.tlyric?.lyric) {
        const tlines = data.tlyric.lyric.split('\n').filter(Boolean);
        const tmap: Record<string, string> = {};
        for (const line of tlines) {
          const match = line.match(/^\[(\d+:\d+\.\d+)\](.*)/);
          if (match) tmap[match[1]] = match[2].trim();
        }
        // 在原歌词每行后面追加翻译
        const lines = result.split('\n');
        result = lines.map(line => {
          const match = line.match(/^\[(\d+:\d+\.\d+)\](.*)/);
          if (match && tmap[match[1]]) {
            return `${line} ─ ${tmap[match[1]]}`;
          }
          return line;
        }).join('\n');
      }
      return result;
    }
  } catch {}
  return '';
}

async function fetchLyricsForSongs(songIds: number[]): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  // 分批并行取歌词，一批 10 首避免请求风暴
  const batchSize = 10;
  for (let i = 0; i < songIds.length; i += batchSize) {
    const batch = songIds.slice(i, i + batchSize);
    await Promise.all(batch.map(async (id) => {
      const lyric = await fetchLyrics(id);
      if (lyric) map[id] = lyric;
    }));
  }
  return map;
}

export async function importPlaylist(playlistId: string): Promise<{
  playlist: { name: string; coverImgUrl: string };
  songs: Song[];
}> {
  const data = await callApi<any>('playlist/detail', { id: playlistId });

  if (data.code !== 200 || !data.playlist) {
    console.error('[netease] 返回:', JSON.stringify(data).slice(0, 300));
    throw new Error(`获取歌单失败 (code=${data.code})`);
  }

  const { playlist } = data;
  const name = playlist.name || '未知歌单';
  const coverImgUrl = playlist.coverImgUrl || '';
  const trackIds: number[] = (playlist.trackIds || []).map((t: any) => t.id).filter(Boolean);
  let tracks: any[] = playlist.tracks || [];

  if (!trackIds.length && !tracks.length) {
    throw new Error('歌单中没有找到歌曲');
  }

  // NetEase API 只返回部分 tracks，用 trackIds 补全缺失的歌曲详情
  if (trackIds.length > tracks.length) {
    const existingIds = new Set(tracks.map((t: any) => t.id));
    const missingIds = trackIds.filter((id: number) => !existingIds.has(id));
    // song/detail 支持批量查 ids，分批并行获取
    for (let i = 0; i < missingIds.length; i += 20) {
      const batch = missingIds.slice(i, i + 20);
      try {
        const detail = await callApi<any>('song/detail', { ids: batch.join(',') });
        if (detail.songs?.length) {
          tracks = [...tracks, ...detail.songs];
        }
      } catch {}
    }
  }

  // 收集所有歌曲 ID，批量获取播放地址
  const songIds = tracks.map((t: any) => t.id).filter(Boolean);
  let urlMap: Record<number, string> = {};

  try {
    const urlData = await callApi<any>('song/url', { ids: songIds.join(',') });
    if (urlData.code === 200 && urlData.data) {
      for (const item of urlData.data) {
        if (item.url) urlMap[item.id] = item.url.replace(/^http:\/\//i, 'https://');
      }
    }
  } catch {}

  // 获取歌词
  const lyricMap = await fetchLyricsForSongs(songIds);

  const songs: Song[] = tracks.map((t: any) => ({
    id: `netease_${t.id}`,
    title: t.name || '未知歌曲',
    artist: (t.ar || []).map((a: any) => a.name).join(', ') || '未知歌手',
    coverUrl: t.al?.picUrl || '',
    url: urlMap[t.id] || apiUrl(`/api/play?id=${t.id}`),
    lyrics: lyricMap[t.id] || DEFAULT_LYRICS,
    isFavorite: false,
  }));

  return {
    playlist: { name, coverImgUrl },
    songs,
  };
}

export async function importSingleSong(songId: string): Promise<Song> {
  // 获取歌曲详情
  const detailData = await callApi<any>('song/detail', { id: songId });
  if (detailData.code !== 200 || !detailData.songs?.length) {
    throw new Error(`获取歌曲信息失败 (code=${detailData.code})`);
  }

  const s = detailData.songs[0];

  // 获取播放地址
  let url = apiUrl(`/api/play?id=${s.id}`);
  try {
    const urlData = await callApi<any>('song/url', { ids: String(s.id) });
    if (urlData.code === 200 && urlData.data?.[0]?.url) {
      url = urlData.data[0].url.replace(/^http:\/\//i, 'https://');
    }
  } catch {}

  // 获取歌词
  const lyrics = await fetchLyrics(s.id) || DEFAULT_LYRICS;

  return {
    id: `netease_${s.id}`,
    title: s.name || '未知歌曲',
    artist: (s.ar || []).map((a: any) => a.name).join(', ') || '未知歌手',
    coverUrl: s.al?.picUrl || '',
    url,
    lyrics,
    isFavorite: false,
  };
}

/** 搜索歌曲，返回简化后的歌曲列表 */
export async function searchSongs(keywords: string, limit: number = 10): Promise<Song[]> {
  const data = await callApi<any>('search', { s: keywords, type: '1', limit: String(limit) });
  if (data.code !== 200 || !data.result?.songs?.length) return [];

  const songs = data.result.songs.slice(0, limit);
  const songIds = songs.map((s: any) => s.id).filter(Boolean);

  // 批量获取歌词
  const lyricMap = await fetchLyricsForSongs(songIds);

  // 先尝试从搜索结果的 album/al 字段取封面
  let coverMap: Record<number, string> = {};
  for (const s of songs) {
    if (s.al?.picUrl) coverMap[s.id] = s.al.picUrl;
    else if (s.album?.picUrl) coverMap[s.id] = s.album.picUrl;
  }

  // 对没有封面的歌曲，通过 song/detail 批量补全
  const missingIds = songIds.filter(id => !coverMap[id]);
  if (missingIds.length > 0) {
    try {
      const detail = await callApi<any>('song/detail', { ids: missingIds.join(',') });
      if (detail.songs?.length) {
        for (const s of detail.songs) {
          if (s.al?.picUrl) coverMap[s.id] = s.al.picUrl;
        }
      }
    } catch {}
  }

  // 批量获取播放地址（CDN 直链，不走代理）
  let urlMap: Record<number, string> = {};
  try {
    const urlData = await callApi<any>('song/url', { ids: songIds.join(',') });
    if (urlData.code === 200 && urlData.data) {
      for (const item of urlData.data) {
        if (item.url) urlMap[item.id] = item.url.replace(/^http:\/\//i, 'https://');
      }
    }
  } catch {}

  return songs.map((s: any) => ({
    id: `netease_${s.id}`,
    title: s.name || '未知歌曲',
    artist: (s.artists || []).map((a: any) => a.name).join(', ') || '未知歌手',
    coverUrl: coverMap[s.id] || '',
    url: urlMap[s.id] || apiUrl(`/api/play?id=${s.id}`),
    lyrics: lyricMap[s.id] || DEFAULT_LYRICS,
    isFavorite: false,
  }));
}
