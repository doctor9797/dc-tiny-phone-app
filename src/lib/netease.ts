// 网易云音乐服务 — 直接调用公共 API（无需本地运行）
// 手机也能用，不需要开电脑

import { Song } from '../types';

const API_BASE = '/api';

const DEFAULT_LYRICS = '[00:00.00] 暂无歌词\n[00:10.00] 正在播放这首歌';

async function callApi<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const allParams = { endpoint, ...params };
  const query = '?' + new URLSearchParams(allParams).toString();
  const res = await fetch(`${API_BASE}${query}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`请求失败 (${res.status}): ${text}`);
  }
  return res.json();
}

export function extractPlaylistId(input: string): string | null {
  if (/^\d+$/.test(input.trim())) return input.trim();
  try {
    const url = new URL(input);
    if (url.hostname.includes('music.163.com') || url.hostname.includes('163.cn')) {
      const pathMatch = url.pathname.match(/\/playlist\/(\d+)/);
      if (pathMatch) return pathMatch[1];
      const idParam = url.searchParams.get('id');
      if (idParam) return idParam;
      const hashMatch = url.hash.match(/[?&]id=(\d+)/);
      if (hashMatch) return hashMatch[1];
    }
    const numMatch = input.match(/(\d+)$/);
    if (numMatch) return numMatch[1];
  } catch {
    const numMatch = input.match(/(\d+)/);
    if (numMatch) return numMatch[1];
  }
  return null;
}

export function extractSongId(input: string): string | null {
  // 纯数字 ID
  if (/^\d+$/.test(input.trim())) return input.trim();
  try {
    const url = new URL(input);
    if (url.hostname.includes('music.163.com') || url.hostname.includes('163.cn')) {
      // /song?id=xxx 或 /song/xxx
      const idParam = url.searchParams.get('id');
      if (idParam) return idParam;
      const pathMatch = url.pathname.match(/\/song\/(\d+)/);
      if (pathMatch) return pathMatch[1];
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
  const tracks = playlist.tracks || [];

  if (!tracks.length) {
    throw new Error('歌单中没有找到歌曲');
  }

  // 收集所有歌曲 ID，批量获取播放地址
  const songIds = tracks.map((t: any) => t.id).filter(Boolean);
  let urlMap: Record<number, string> = {};

  try {
    const urlData = await callApi<any>('song/url', { ids: songIds.join(',') });
    if (urlData.code === 200 && urlData.data) {
      for (const item of urlData.data) {
        if (item.url) urlMap[item.id] = item.url;
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
    url: urlMap[t.id] || `https://music.163.com/song/media/outer/url?id=${t.id}.mp3`,
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
  let url = `https://music.163.com/song/media/outer/url?id=${s.id}.mp3`;
  try {
    const urlData = await callApi<any>('song/url', { ids: String(s.id) });
    if (urlData.code === 200 && urlData.data?.[0]?.url) {
      url = urlData.data[0].url;
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
