import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Search, Heart, Play, Pause, SkipBack, SkipForward, Users, Upload, Link as LinkIcon, Pencil, RefreshCw, Trash2, Music, Cloud, Check, X } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';
import { Song } from '../../types';
import { saveVideoFile, loadVideoFile, deleteVideoFile } from '../../lib/db';
import { extractPlaylistId, extractSongId, importPlaylist, importSingleSong } from '../../lib/netease';

const getT = (theme: string) => {
  const t: Record<string, any> = {
    cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950', text: 'text-cyan-900 dark:text-cyan-50', header: 'bg-cyan-100/70 dark:bg-cyan-900/70', border: 'border-cyan-200 dark:border-cyan-800', prim: 'text-cyan-600 dark:text-cyan-400', inputBorder: 'border-cyan-300 dark:border-cyan-700', panel: 'bg-cyan-100 dark:bg-cyan-900/30', active: 'active:bg-cyan-200 dark:active:bg-cyan-800', light: 'bg-cyan-100/80 dark:bg-cyan-900/50', dark: 'bg-cyan-500/20 text-cyan-300', gradient: 'from-cyan-600 to-cyan-700', primary: 'bg-cyan-500 hover:bg-cyan-600', playerBg: 'from-cyan-600 to-cyan-800', playerCard: 'bg-white/10 backdrop-blur-xl', progress: 'bg-cyan-400', coverBg: '#67e8f9', coverFill: '#06b6d4' },
    pink: { bg: 'bg-pink-50 dark:bg-pink-950', text: 'text-pink-900 dark:text-pink-50', header: 'bg-pink-100/70 dark:bg-pink-900/70', border: 'border-pink-200 dark:border-pink-800', prim: 'text-pink-600 dark:text-pink-400', inputBorder: 'border-pink-300 dark:border-pink-700', panel: 'bg-pink-100 dark:bg-pink-900/30', active: 'active:bg-pink-200 dark:active:bg-pink-800', light: 'bg-pink-100/80 dark:bg-pink-900/50', dark: 'bg-pink-500/20 text-pink-300', gradient: 'from-pink-500 to-pink-700', primary: 'bg-pink-500 hover:bg-pink-600', playerBg: 'from-pink-500 to-pink-800', playerCard: 'bg-white/10 backdrop-blur-xl', progress: 'bg-pink-400', coverBg: '#f9a8d4', coverFill: '#ec4899' },
    white: { bg: 'bg-slate-50 dark:bg-[#0f0f0f]', text: 'text-slate-900 dark:text-slate-50', header: 'bg-white/70 dark:bg-[#1a1a1a]/70', border: 'border-slate-200 dark:border-white/10', prim: 'text-slate-500 dark:text-slate-400', inputBorder: 'border-slate-300 dark:border-white/10', panel: 'bg-white dark:bg-[#1f1f1f]/80', active: 'active:bg-slate-100 dark:active:bg-white/5', light: 'bg-slate-100/80 dark:bg-white/5', dark: 'bg-white/10 text-white/80', gradient: 'from-slate-600 to-slate-800', primary: 'bg-slate-700 hover:bg-slate-800', playerBg: 'from-slate-700 to-slate-900', playerCard: 'bg-white/10 backdrop-blur-xl', progress: 'bg-white', coverBg: '#e2e8f0', coverFill: '#64748b' },
    green: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-900 dark:text-emerald-50', header: 'bg-emerald-100/70 dark:bg-emerald-900/70', border: 'border-emerald-200 dark:border-emerald-800', prim: 'text-emerald-600 dark:text-emerald-400', inputBorder: 'border-emerald-300 dark:border-emerald-700', panel: 'bg-emerald-100 dark:bg-emerald-900/30', active: 'active:bg-emerald-200 dark:active:bg-emerald-800', light: 'bg-emerald-100/80 dark:bg-emerald-900/50', dark: 'bg-emerald-500/20 text-emerald-300', gradient: 'from-emerald-500 to-emerald-700', primary: 'bg-emerald-500 hover:bg-emerald-600', playerBg: 'from-emerald-600 to-emerald-800', playerCard: 'bg-white/10 backdrop-blur-xl', progress: 'bg-emerald-400', coverBg: '#6ee7b7', coverFill: '#10b981' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950', text: 'text-purple-900 dark:text-purple-50', header: 'bg-purple-100/70 dark:bg-purple-900/70', border: 'border-purple-200 dark:border-purple-800', prim: 'text-purple-600 dark:text-purple-400', inputBorder: 'border-purple-300 dark:border-purple-700', panel: 'bg-purple-100 dark:bg-purple-900/30', active: 'active:bg-purple-200 dark:active:bg-purple-800', light: 'bg-purple-100/80 dark:bg-purple-900/50', dark: 'bg-purple-500/20 text-purple-300', gradient: 'from-purple-500 to-purple-700', primary: 'bg-purple-500 hover:bg-purple-600', playerBg: 'from-purple-600 to-purple-800', playerCard: 'bg-white/10 backdrop-blur-xl', progress: 'bg-purple-400', coverBg: '#c4b5fd', coverFill: '#8b5cf6' },
    black: { bg: 'bg-zinc-900 dark:bg-black', text: 'text-zinc-100 dark:text-zinc-100', header: 'bg-zinc-800/70 dark:bg-black/70', border: 'border-zinc-700 dark:border-white/5', prim: 'text-zinc-400 dark:text-zinc-400', inputBorder: 'border-zinc-600 dark:border-white/5', panel: 'bg-zinc-800/50 dark:bg-white/5', active: 'active:bg-zinc-700 dark:active:bg-white/5', light: 'bg-zinc-700/50 dark:bg-white/5', dark: 'bg-white/10 text-white/80', gradient: 'from-zinc-600 to-zinc-800', primary: 'bg-zinc-600 hover:bg-zinc-500', playerBg: 'from-zinc-800 to-black', playerCard: 'bg-white/10 backdrop-blur-xl', progress: 'bg-zinc-400', coverBg: '#a1a1aa', coverFill: '#52525b' },
    gray: { bg: 'bg-gray-50 dark:bg-gray-950', text: 'text-gray-900 dark:text-gray-50', header: 'bg-gray-100/70 dark:bg-gray-900/70', border: 'border-gray-200 dark:border-gray-800', prim: 'text-gray-500 dark:text-gray-400', inputBorder: 'border-gray-300 dark:border-gray-700', panel: 'bg-gray-100 dark:bg-gray-900/30', active: 'active:bg-gray-200 dark:active:bg-gray-800', light: 'bg-gray-100/80 dark:bg-gray-900/50', dark: 'bg-gray-500/20 text-gray-300', gradient: 'from-gray-500 to-gray-700', primary: 'bg-gray-500 hover:bg-gray-600', playerBg: 'from-gray-600 to-gray-800', playerCard: 'bg-white/10 backdrop-blur-xl', progress: 'bg-gray-400', coverBg: '#d1d5db', coverFill: '#6b7280' },
    yellow: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-900 dark:text-amber-50', header: 'bg-amber-100/70 dark:bg-amber-900/70', border: 'border-amber-200 dark:border-amber-800', prim: 'text-amber-600 dark:text-amber-400', inputBorder: 'border-amber-300 dark:border-amber-700', panel: 'bg-amber-100 dark:bg-amber-900/30', active: 'active:bg-amber-200 dark:active:bg-amber-800', light: 'bg-amber-100/80 dark:bg-amber-900/50', dark: 'bg-amber-500/20 text-amber-300', gradient: 'from-amber-500 to-amber-700', primary: 'bg-amber-500 hover:bg-amber-600', playerBg: 'from-amber-600 to-amber-800', playerCard: 'bg-white/10 backdrop-blur-xl', progress: 'bg-amber-400', coverBg: '#fcd34d', coverFill: '#f59e0b' },
  }
  return t[theme] || t.green;
};

const getDefaultCover = (theme: string) => {
  const themeColors: Record<string, { bg: string; fill: string }> = {
    cyan: { bg: '#cffafe', fill: '#06b6d4' },
    pink: { bg: '#fce7f3', fill: '#ec4899' },
    white: { bg: '#f1f5f9', fill: '#64748b' },
    green: { bg: '#d1fae5', fill: '#10b981' },
    purple: { bg: '#ede9fe', fill: '#8b5cf6' },
    black: { bg: '#27272a', fill: '#71717a' },
    gray: { bg: '#f3f4f6', fill: '#6b7280' },
    yellow: { bg: '#fef3c7', fill: '#f59e0b' },
  };
  const colors = themeColors[theme] || themeColors.green;
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
      <rect width="400" height="400" rx="48" fill="${colors.bg}"/>
      <circle cx="200" cy="200" r="112" fill="${colors.fill}" opacity="0.3"/>
      <circle cx="200" cy="200" r="80" fill="${colors.fill}" opacity="0.5"/>
      <circle cx="200" cy="200" r="48" fill="${colors.fill}"/>
      <circle cx="200" cy="200" r="20" fill="${colors.bg}"/>
    </svg>
  `)}`;
};

const DEFAULT_COVER = getDefaultCover('green');

const DEFAULT_LYRICS = '[00:00.00] 暂无歌词\n[00:10.00] 正在播放这首歌';

const formatTime = (secs: number) => {
  if (!Number.isFinite(secs) || secs < 0) return '00:00';
  const minutes = Math.floor(secs / 60);
  const seconds = Math.floor(secs % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const sanitizeName = (value: string) => {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { decoded = value; }
  return decoded.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const cleanMusicToken = (value: string) =>
  value.replace(/^\d+\s*[-_.、]?\s*/g, '').replace(/\[(live|mv|official|audio|lyrics?)\]/ig, '').replace(/\((live|mv|official|audio|lyrics?)\)/ig, '').replace(/\s+(feat|ft)\.?.*$/i, '').replace(/\s+/g, ' ').trim();

const guessTitleArtist = (value: string) => {
  const clean = sanitizeName(value);
  const parts = clean.split(/\s*[-–—|｜·]\s*/).map(cleanMusicToken).filter(Boolean);
  if (parts.length >= 2) {
    const [first, ...rest] = parts;
    const title = rest.join(' - ');
    if (/^(track|audio|song|未知歌手)$/i.test(first)) {
      return { artist: '未知歌手', title: title || first || '未命名音频' };
    }
    return { artist: first || '未知歌手', title: title || '未命名音频' };
  }
  return { artist: '未知歌手', title: cleanMusicToken(clean) || '未命名音频' };
};

const getFileNameFromUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.searchParams.get('filename') || url.searchParams.get('file') || url.searchParams.get('name') || url.searchParams.get('title') || url.pathname.split('/').pop() || value;
  } catch { return value; }
};

const isLikelyAudioUrl = (value: string) => /^https?:\/\//i.test(value) && /\.(mp3|wav|m4a|aac|ogg|flac|webm)(\?.*)?$/i.test(value);

const pictureToDataUrl = (bytes?: Uint8Array, format = 'image/jpeg') => {
  if (!bytes?.length) return DEFAULT_COVER;
  let binary = ''; bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `data:${format};base64,${btoa(binary)}`;
};

const decodeFrameText = (bytes: Uint8Array) => {
  if (!bytes.length) return '';
  const encoding = bytes[0];
  const body = bytes.slice(1);
  try {
    if (encoding === 0) return new TextDecoder('latin1').decode(body).replace(/\0/g, '').trim();
    if (encoding === 1) return new TextDecoder('utf-16').decode(body).replace(/\0/g, '').trim();
    if (encoding === 2) return new TextDecoder('utf-16be').decode(body).replace(/\0/g, '').trim();
    if (encoding === 3) return new TextDecoder('utf-8').decode(body).replace(/\0/g, '').trim();
  } catch {}
  return new TextDecoder().decode(body).replace(/\0/g, '').trim();
};

const readSyncSafeInt = (bytes: Uint8Array) => ((bytes[0] & 0x7f) << 21) | ((bytes[1] & 0x7f) << 14) | ((bytes[2] & 0x7f) << 7) | (bytes[3] & 0x7f);
const readInt = (bytes: Uint8Array) => (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
const readAscii = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

const findDelimiterIndex = (bytes: Uint8Array, encoding: number, start: number) => {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i < bytes.length - 1; i += 2) { if (bytes[i] === 0 && bytes[i + 1] === 0) return i; }
    return bytes.length;
  }
  for (let i = start; i < bytes.length; i += 1) { if (bytes[i] === 0) return i; }
  return bytes.length;
};

const parseApicFrame = (bytes: Uint8Array) => {
  if (!bytes.length) return { coverUrl: DEFAULT_COVER };
  const mimeEnd = findDelimiterIndex(bytes, 0, 1);
  const mime = new TextDecoder('latin1').decode(bytes.slice(1, mimeEnd)) || 'image/jpeg';
  const descriptionStart = mimeEnd + 2;
  const descriptionEnd = findDelimiterIndex(bytes, bytes[0], descriptionStart);
  const imageStart = descriptionEnd + (bytes[0] === 1 || bytes[0] === 2 ? 2 : 1);
  return { coverUrl: pictureToDataUrl(bytes.slice(imageStart), mime) };
};

const parseUsltFrame = (bytes: Uint8Array) => {
  if (bytes.length < 4) return '';
  const lyricsStart = 4 + findDelimiterIndex(bytes, bytes[0], 4) + (bytes[0] === 1 || bytes[0] === 2 ? 2 : 1);
  return decodeFrameText(new Uint8Array([bytes[0], ...bytes.slice(lyricsStart)]));
};

const parseMp4TextAtom = (bytes: Uint8Array) => {
  if (bytes.length <= 8) return '';
  return new TextDecoder('utf-8').decode(bytes[7] === 0 ? bytes.slice(8) : bytes.slice(0)).replace(/\0/g, '').trim();
};

const parseMp4Metadata = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const metadata: { title?: string; artist?: string; coverUrl?: string } = {};
  const walk = (start: number, end: number) => {
    let offset = start;
    while (offset + 8 <= end) {
      const size = readInt(bytes.slice(offset, offset + 4));
      const type = readAscii(bytes.slice(offset + 4, offset + 8));
      if (!size || size < 8) break;
      const boxEnd = Math.min(offset + size, end);
      if (type === '©nam') metadata.title = metadata.title || parseMp4TextAtom(bytes.slice(offset + 8, boxEnd));
      else if (type === '©ART' || type === 'aART') metadata.artist = metadata.artist || parseMp4TextAtom(bytes.slice(offset + 8, boxEnd));
      else if (type === 'covr') { const coverBytes = bytes.slice(offset + 16, boxEnd); if (coverBytes.length) metadata.coverUrl = pictureToDataUrl(coverBytes, 'image/jpeg'); }
      if (['moov', 'udta', 'meta', 'ilst'].includes(type)) walk(offset + (type === 'meta' ? 12 : 8), boxEnd);
      offset = boxEnd;
    }
  };
  walk(0, bytes.length);
  return metadata;
};

const parseAudioMetadata = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const metadata: { title?: string; artist?: string; lyrics?: string; coverUrl?: string } = {};
  if (bytes.length >= 10 && String.fromCharCode(...bytes.slice(0, 3)) === 'ID3') {
    let offset = 10;
    const end = Math.min(bytes.length, 10 + readSyncSafeInt(bytes.slice(6, 10)));
    while (offset + 10 <= end) {
      const frameId = String.fromCharCode(...bytes.slice(offset, offset + 4)).replace(/\0/g, '');
      if (!frameId.trim()) break;
      const frameSize = bytes[3] === 4 ? readSyncSafeInt(bytes.slice(offset + 4, offset + 8)) : readInt(bytes.slice(offset + 4, offset + 8));
      if (!frameSize || frameSize < 0) break;
      const frameData = bytes.slice(offset + 10, Math.min(offset + 10 + frameSize, end));
      if (frameId === 'TIT2') metadata.title = decodeFrameText(frameData);
      if (frameId === 'TPE1') metadata.artist = decodeFrameText(frameData);
      if (frameId === 'USLT') metadata.lyrics = parseUsltFrame(frameData);
      if (frameId === 'APIC' && !metadata.coverUrl) metadata.coverUrl = parseApicFrame(frameData).coverUrl;
      offset += 10 + frameSize;
    }
  }
  if ((!metadata.title || !metadata.artist) && bytes.length >= 128) {
    const id3v1 = bytes.slice(bytes.length - 128);
    if (String.fromCharCode(...id3v1.slice(0, 3)) === 'TAG') {
      metadata.title = metadata.title || new TextDecoder('latin1').decode(id3v1.slice(3, 33)).replace(/\0/g, '').trim();
      metadata.artist = metadata.artist || new TextDecoder('latin1').decode(id3v1.slice(33, 63)).replace(/\0/g, '').trim();
    }
  }
  if (!metadata.title || !metadata.artist || !metadata.coverUrl) {
    try {
      const mp4Metadata = parseMp4Metadata(buffer);
      metadata.title = metadata.title || mp4Metadata.title;
      metadata.artist = metadata.artist || mp4Metadata.artist;
      metadata.coverUrl = metadata.coverUrl || mp4Metadata.coverUrl;
    } catch {}
  }
  return metadata;
};

export default function MusicApp() {
  const { songs, addSong, updateSong, deleteSong, toggleSongFavorite, characters, settings } = useAppStore();
  const [searchUrl, setSearchUrl] = useState('');
  const [currentSong, setCurrentSong] = useState<Song | null>(songs[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [showEditSong, setShowEditSong] = useState(false);
  const [editSongData, setEditSongData] = useState<Partial<Song>>({});
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [friendChat, setFriendChat] = useState<{sender: 'user'|'friend', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [recognitionHint, setRecognitionHint] = useState('');
  const [playError, setPlayError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyricLines, setLyricLines] = useState<{ time: number; text: string }[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const chatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const localAudioInputRef = useRef<HTMLInputElement>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const [currentDbKey, setCurrentDbKey] = useState<string | null>(null);
  const [showNetease, setShowNetease] = useState(false);
  const [neteaseInput, setNeteaseInput] = useState('');
  const [neteaseLoading, setNeteaseLoading] = useState(false);
  const [neteasePlaylist, setNeteasePlaylist] = useState<{ name: string; coverImgUrl: string; songs: Song[]; selected: Set<string> } | null>(null);
  const t = getT(settings.osTheme || 'green');
  const isDark = settings.isDark;

  useEffect(() => {
    if (!songs.length) { setCurrentSong(null); setIsPlaying(false); return; }
    setCurrentSong((prev) => prev ? songs.find(song => song.id === prev.id) || songs[0] : songs[0]);
  }, [songs]);

  useEffect(() => () => { if (chatTimeoutRef.current) clearTimeout(chatTimeoutRef.current); }, []);

  useEffect(() => {
    if (!currentSong?.dbKey || !audioRef.current) return;
    let cancelled = false;
    loadVideoFile(currentSong.dbKey).then(blob => {
      if (cancelled || !blob || !audioRef.current) return;
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
      const url = URL.createObjectURL(blob);
      audioObjectUrlRef.current = url;
      audioRef.current.src = url;
    });
    return () => { cancelled = true; };
  }, [currentSong?.id, currentSong?.dbKey]);

  // 解析 LRC 歌词
  useEffect(() => {
    if (!currentSong?.lyrics) { setLyricLines([]); return; }
    const lines = currentSong.lyrics.split('\n');
    const parsed: { time: number; text: string }[] = [];
    for (const line of lines) {
      const match = line.match(/^\[(\d+):(\d+\.\d+)\](.*)/);
      if (match) {
        const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
        const text = match[3].trim();
        if (text) parsed.push({ time, text });
      }
    }
    parsed.sort((a, b) => a.time - b.time);
    setLyricLines(parsed);
    setCurrentLyricIndex(-1);
  }, [currentSong?.lyrics]);

  // 根据播放时间更新当前歌词
  useEffect(() => {
    if (!lyricLines.length) { setCurrentLyricIndex(-1); return; }
    let idx = -1;
    for (let i = lyricLines.length - 1; i >= 0; i--) {
      if (currentTime >= lyricLines[i].time) { idx = i; break; }
    }
    setCurrentLyricIndex(idx);
  }, [currentTime, lyricLines]);

  useEffect(() => {
    return () => {
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    };
  }, []);

  const orderedSongs = useMemo(() => {
    const favorites = songs.filter(song => song.isFavorite);
    const others = songs.filter(song => !song.isFavorite);
    return [...favorites, ...others];
  }, [songs]);

  const buildSongDraft = async (source: { url: string; fallbackName: string; blob?: Blob; dbKey?: string }) => {
    const guessed = guessTitleArtist(source.fallbackName);
    let hint = source.blob ? '已读取本地音频信息。' : '已按文件名识别歌曲。';
    const draft: Partial<Song> = { title: guessed.title, artist: guessed.artist, coverUrl: DEFAULT_COVER, url: source.url, lyrics: DEFAULT_LYRICS, isFavorite: false, dbKey: source.dbKey };
    if (source.blob) {
      try {
        const metadata = parseAudioMetadata(await source.blob.arrayBuffer());
        draft.title = metadata.title || draft.title;
        draft.artist = metadata.artist || draft.artist;
        draft.coverUrl = metadata.coverUrl || draft.coverUrl;
        draft.lyrics = metadata.lyrics || draft.lyrics;
        hint = (metadata.title || metadata.artist || metadata.coverUrl || metadata.lyrics) ? '已提取封面、歌手、歌词。' : '未找到内嵌信息，已按文件名识别。';
      } catch { hint = '读取失败，按文件名识别。'; }
    }
    return { draft, hint };
  };

  const openSongEditor = async (source: { url: string; fallbackName: string; blob?: Blob; dbKey?: string; editingSongId?: string | null }) => {
    setIsImporting(true);
    try {
      const { draft, hint } = await buildSongDraft(source);
      setEditSongData(draft);
      setEditingSongId(source.editingSongId || null);
      setRecognitionHint(hint);
      setShowEditSong(true);
    } finally { setIsImporting(false); }
  };

  const handleSaveSong = () => {
    const songToSave = {
      title: editSongData.title || '未命名音频',
      artist: editSongData.artist || '未知歌手',
      coverUrl: editSongData.coverUrl || DEFAULT_COVER,
      url: editSongData.url || '',
      lyrics: editSongData.lyrics || DEFAULT_LYRICS,
      isFavorite: Boolean(editSongData.isFavorite),
      dbKey: editSongData.dbKey || undefined,
    } as Omit<Song, 'id'>;
    if (editingSongId) updateSong(editingSongId, songToSave);
    else addSong(songToSave);
    setSearchUrl('');
    setShowEditSong(false);
    setRecognitionHint('');
    setEditingSongId(null);
    setEditSongData({});
  };

  const handleDeleteSong = () => {
    if (!editingSongId) return;
    deleteSong(editingSongId);
    if (currentSong?.id === editingSongId) { setCurrentSong(null); setShowPlayer(false); setIsPlaying(false); }
    setShowEditSong(false);
    setRecognitionHint('');
    setEditingSongId(null);
    setEditSongData({});
  };

  const handleRetryRecognition = async () => {
    const sourceUrl = (editSongData.url || '').trim();
    const fallbackName = [editSongData.artist, editSongData.title].filter(Boolean).join(' - ') || sourceUrl || '未命名音频';
    if (!sourceUrl) { setRecognitionHint('请先填写音频链接。'); return; }
    setIsImporting(true);
    try {
      let blob: Blob | undefined;
      if (sourceUrl.startsWith('data:audio') || isLikelyAudioUrl(sourceUrl)) { try { const response = await fetch(sourceUrl); blob = await response.blob(); } catch { blob = undefined; } }
      const { draft, hint } = await buildSongDraft({ url: sourceUrl, fallbackName, blob });
      setEditSongData(prev => ({ ...prev, title: draft.title || prev.title, artist: draft.artist || prev.artist, coverUrl: draft.coverUrl || prev.coverUrl, lyrics: draft.lyrics && draft.lyrics !== DEFAULT_LYRICS ? draft.lyrics : prev.lyrics }));
      setRecognitionHint(hint);
    } finally { setIsImporting(false); }
  };

  const playSong = async (song: Song) => {
    setCurrentSong(song); setShowPlayer(true); setSelectedFriend(''); setPlayError('');
    requestAnimationFrame(() => { audioRef.current?.play().catch(() => { setPlayError('播放失败，请检查音频地址。'); }); });
  };

  const playRelativeSong = (direction: -1 | 1) => {
    if (!currentSong || !orderedSongs.length) return;
    const currentIndex = orderedSongs.findIndex(song => song.id === currentSong.id);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + orderedSongs.length) % orderedSongs.length;
    playSong(orderedSongs[nextIndex]);
  };

  const togglePlay = () => { if (!audioRef.current) return; isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(() => {}); };

  const handleListenWithFriend = async (charId: string) => {
    setSelectedFriend(charId); setShowFriends(false); setFriendChat([]); setIsFriendTyping(true);
    try {
      const char = characters[charId];
      const reply = await generateAIResponse(`我们正在一起听一首歌，歌名是《${currentSong?.title}》。请你以${char.name}的身份简短评论这首歌。`);
      setFriendChat([{ sender: 'friend', text: reply }]);
    } catch { setFriendChat([{ sender: 'friend', text: '这首歌不错。' }]); }
    finally { setIsFriendTyping(false); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !selectedFriend) return;
    const text = chatInput; setChatInput('');
    setFriendChat(prev => [...prev, { sender: 'user', text }]);
    setIsFriendTyping(true);
    try {
      const char = characters[selectedFriend];
      const reply = await generateAIResponse(`我们正在一起听《${currentSong?.title}》。你回复：${text}`);
      setFriendChat(prev => [...prev, { sender: 'friend', text: reply }]);
    } catch { setFriendChat(prev => [...prev, { sender: 'friend', text: '嗯。' }]); }
    finally { setIsFriendTyping(false); }
  };

  const [isImporting, setIsImporting] = useState(false);

  const handleLocalImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dbKey = `audio_${Date.now()}`;
    await saveVideoFile(dbKey, file);
    setCurrentDbKey(dbKey);
    const objectUrl = URL.createObjectURL(file);
    await openSongEditor({ url: objectUrl, blob: file, fallbackName: file.name, dbKey });
    e.target.value = '';
  };

  const handleSearch = async () => {
    const value = searchUrl.trim();
    if (!value) return;
    if (isLikelyAudioUrl(value)) { await openSongEditor({ url: value, fallbackName: getFileNameFromUrl(value) }); return; }
    await openSongEditor({ url: value, fallbackName: getFileNameFromUrl(value) });
  };

  const openExistingSongEditor = (song: Song) => {
    setEditingSongId(song.id);
    setEditSongData(song);
    setRecognitionHint('可修改信息或重新识别。');
    setShowEditSong(true);
  };

  const handleNeteaseImport = async () => {
    const input = neteaseInput.trim();
    if (!input) { setNeteaseInput('请输入网易云链接或 ID'); return; }

    // 先尝试当歌单导入
    const playlistId = extractPlaylistId(input);
    if (playlistId) {
      setNeteaseLoading(true);
      setNeteasePlaylist(null);
      try {
        const { playlist, songs } = await importPlaylist(playlistId);
        setNeteasePlaylist({
          name: playlist.name,
          coverImgUrl: playlist.coverImgUrl,
          songs,
          selected: new Set(songs.map(s => s.id)),
        });
        setNeteaseInput('');
      } catch (err: any) {
        setNeteaseInput(err.message || '导入失败');
      } finally {
        setNeteaseLoading(false);
      }
      return;
    }

    // 尝试当单曲导入
    const songId = extractSongId(input);
    if (songId) {
      setNeteaseLoading(true);
      try {
        const song = await importSingleSong(songId);
        addSong({ ...song, id: undefined as any });
        setNeteaseInput('');
        setShowNetease(false);
      } catch (err: any) {
        setNeteaseInput(err.message || '导入单曲失败');
      } finally {
        setNeteaseLoading(false);
      }
      return;
    }

    setNeteaseInput('无法识别，请输入网易云歌单/歌曲链接或 ID');
  };

  const toggleNeteaseSong = (songId: string) => {
    if (!neteasePlaylist) return;
    const next = new Set(neteasePlaylist.selected);
    if (next.has(songId)) next.delete(songId);
    else next.add(songId);
    setNeteasePlaylist({ ...neteasePlaylist, selected: next });
  };

  const importSelectedSongs = () => {
    if (!neteasePlaylist) return;
    const songsToAdd = neteasePlaylist.songs.filter(s => neteasePlaylist.selected.has(s.id));
    for (const song of songsToAdd) {
      addSong({ ...song, id: undefined as any });
    }
    setShowNetease(false);
    setNeteasePlaylist(null);
  };

  if (showEditSong) {
    return (
      <div className={`h-full flex flex-col ${t.bg} absolute inset-0 z-50`}>
        <div className={`${t.header} backdrop-blur-lg px-4 pt-12 pb-3 flex items-center justify-between border-b ${t.border}`}>
          <button onClick={() => { setShowEditSong(false); setRecognitionHint(''); setEditingSongId(null); setEditSongData({}); }} className={`${t.prim} font-medium`}>取消</button>
          <h1 className={`text-lg font-bold ${t.text}`}>{editingSongId ? '编辑歌曲' : '添加歌曲'}</h1>
          <button onClick={handleSaveSong} className={`${t.primary} text-white px-5 py-1.5 rounded-full text-sm font-semibold shadow-lg`}>保存</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className={`${t.panel} rounded-2xl p-5 border ${t.border} flex items-center gap-5`}>
            <div className="relative group">
              <img src={editSongData.coverUrl || DEFAULT_COVER} alt="cover" className="w-24 h-24 rounded-2xl object-cover shadow-md" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER; }} />
              <label className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => { setEditSongData({...editSongData, coverUrl: event.target?.result as string}); };
                    reader.readAsDataURL(file);
                  }
                }} />
                <span className="text-white text-xs font-medium">更换封面</span>
              </label>
            </div>
            <div className="flex-1">
              <p className={`text-sm ${t.prim}`}>{recognitionHint || '可手动修改信息'}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleRetryRecognition} disabled={isImporting} className={`flex-1 ${t.panel} border ${t.border} rounded-xl py-3 text-sm font-semibold ${t.prim} flex items-center justify-center gap-2 ${isImporting ? 'opacity-50' : ''}`}>
              <RefreshCw size={16} className={isImporting ? 'animate-spin' : ''} />重新识别
            </button>
            {editingSongId && (
              <button onClick={handleDeleteSong} className="flex-1 bg-red-50 border border-red-200 rounded-xl py-3 text-sm font-semibold text-red-500 flex items-center justify-center gap-2">
                <Trash2 size={16} />删除
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className={`text-xs font-semibold ${t.prim} mb-2 block`}>歌曲名</label>
              <input type="text" value={editSongData.title || ''} onChange={e => setEditSongData({...editSongData, title: e.target.value})} className={`w-full border ${t.inputBorder} rounded-xl p-4 ${t.text} ${t.panel} text-base`} placeholder="输入歌曲名" />
            </div>
            <div>
              <label className={`text-xs font-semibold ${t.prim} mb-2 block`}>歌手</label>
              <input type="text" value={editSongData.artist || ''} onChange={e => setEditSongData({...editSongData, artist: e.target.value})} className={`w-full border ${t.inputBorder} rounded-xl p-4 ${t.text} ${t.panel} text-base`} placeholder="输入歌手名" />
            </div>
            <div>
              <label className={`text-xs font-semibold ${t.prim} mb-2 block`}>音频链接</label>
              <input type="text" value={editSongData.url || ''} onChange={e => setEditSongData({...editSongData, url: e.target.value})} className={`w-full border ${t.inputBorder} rounded-xl p-4 ${t.text} ${t.panel} text-base`} placeholder="粘贴音频直链或填写URL" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showPlayer && currentSong) {
    return (
      <div className={`h-full flex flex-col bg-gradient-to-b ${t.playerBg} absolute inset-0 z-50`}>
        <audio ref={audioRef} src={currentSong?.dbKey ? undefined : (currentSong?.url || '')} preload="metadata" onEnded={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} onError={() => setPlayError('音频无法播放')} className="hidden" />
        <div className="px-4 pt-12 pb-4 flex items-center justify-between">
          <button onClick={() => setShowPlayer(false)} className="text-white/80"><ChevronLeft size={28} /></button>
          <div className="text-center">
            <div className="font-bold text-lg text-white">{currentSong.title}</div>
            <div className="text-sm text-white/60">{currentSong.artist}</div>
          </div>
          <button onClick={() => setShowFriends(true)} className="text-white/80"><Users size={24} /></button>
        </div>

        {selectedFriend && (
          <div className="absolute top-24 inset-x-4 bottom-48 z-20 flex flex-col pointer-events-none">
            <div className="flex justify-center mb-4">
              <div className="bg-white/20 backdrop-blur-md px-5 py-2 rounded-full text-sm text-white font-medium">和 {characters[selectedFriend]?.name} 一起听</div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 p-2 pointer-events-auto">
              {friendChat.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender === 'user' ? 'bg-white/30 text-white' : 'bg-white/10 text-white/90'}`}>{msg.text}</div>
                </div>
              ))}
              {isFriendTyping && <div className="flex justify-start"><div className="p-3 rounded-2xl bg-white/10 text-white/50">...</div></div>}
            </div>
            <div className="mt-4 flex gap-2 pointer-events-auto">
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChat()} className="flex-1 bg-white/20 border border-white/20 rounded-full px-5 py-2.5 text-sm text-white outline-none placeholder-white/50" placeholder="聊这首歌..." />
              <button onClick={handleSendChat} className="bg-white text-gray-800 rounded-full px-5 py-2.5 text-sm font-semibold">发送</button>
            </div>
          </div>
        )}

        <div className={`flex-1 flex flex-col items-center justify-center p-8 z-10 transition-all ${selectedFriend ? 'opacity-30' : ''}`}>
          <div className="relative">
            <div className={`w-64 h-64 rounded-full overflow-hidden shadow-2xl ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`}>
              <img src={currentSong.coverUrl || DEFAULT_COVER} alt="cover" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER; }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-white"></div>
              </div>
            </div>
          </div>
          <div className="mt-10 w-full max-w-sm mx-auto h-32 overflow-hidden relative">
            <div className="absolute inset-0 overflow-y-auto scrollbar-hide px-4" style={{ scrollBehavior: 'smooth' }}>
              {lyricLines.length > 0 ? (
                <div className="text-center space-y-2 py-8">
                  {lyricLines.map((line, i) => (
                    <div key={i} className={`transition-all duration-300 ${
                      i === currentLyricIndex
                        ? 'text-white text-base font-bold scale-105'
                        : i === currentLyricIndex - 1 || i === currentLyricIndex + 1
                          ? 'text-white/60 text-sm'
                          : 'text-white/30 text-xs'
                    }`}>
                      {line.text}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-white/50 pt-8 text-sm">暂无歌词</div>
              )}
            </div>
          </div>
          {playError && <div className="mt-4 text-red-300 text-sm bg-red-500/20 px-4 py-2 rounded-full">{playError}</div>}
        </div>

        <div className="p-8 z-10">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-xs text-white/50 w-10 text-right">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className={`h-full ${t.progress} rounded-full transition-all`} style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
            </div>
            <span className="text-xs text-white/50 w-10">{formatTime(duration)}</span>
          </div>
          <div className="flex items-center justify-center gap-10">
            <button onClick={() => toggleSongFavorite(currentSong.id)} className="text-white/70 hover:text-white transition-colors">
              <Heart size={26} className={currentSong.isFavorite ? 'fill-white' : ''} />
            </button>
            <button onClick={() => playRelativeSong(-1)} className="text-white/70 hover:text-white transition-colors"><SkipBack size={30} /></button>
            <button className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform" onClick={togglePlay}>
              {isPlaying ? <Pause size={28} className="text-gray-800" /> : <Play size={28} className="text-gray-800 ml-1" />}
            </button>
            <button onClick={() => playRelativeSong(1)} className="text-white/70 hover:text-white transition-colors"><SkipForward size={30} /></button>
            <div className="w-6"></div>
          </div>
        </div>

        {showFriends && (
          <div className="absolute inset-0 bg-black/80 z-50 flex flex-col">
            <div className="p-4 pt-12 flex justify-between items-center border-b border-white/10">
              <span className="text-lg text-white font-semibold">邀请好友</span>
              <button onClick={() => setShowFriends(false)} className="text-white/70">关闭</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {Object.values(characters).filter(c => !(c as any).isDisabled).map(char => (
                <div key={char.id} className="flex items-center gap-3 p-3 bg-white/10 rounded-xl cursor-pointer hover:bg-white/20 transition-colors" onClick={() => handleListenWithFriend(char.id)}>
                  <div className="w-12 h-12 rounded-full" style={{ background: char.avatar.startsWith('#') ? char.avatar : `url(${char.avatar}) center/cover` }} />
                  <span className="text-white font-medium">{char.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${t.bg} absolute inset-0 z-50`}>
      <audio ref={audioRef} src={currentSong?.dbKey ? undefined : (currentSong?.url || '')} preload="metadata" onEnded={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} onError={() => setPlayError('音频无法播放')} className="hidden" />

      <div className={`${t.header} backdrop-blur-lg px-4 pt-12 pb-3 flex items-center gap-3 border-b ${t.border}`}>
        <button className={`w-11 h-11 rounded-full ${t.light} flex items-center justify-center shadow-sm`} onClick={() => localAudioInputRef.current?.click()}>
          <Upload size={20} />
        </button>
        <button className={`w-11 h-11 rounded-full ${t.light} flex items-center justify-center shadow-sm`} onClick={() => setShowNetease(true)}>
          <Cloud size={20} />
        </button>
        <div className={`flex-1 ${t.panel} rounded-full h-11 flex items-center px-4 border ${t.border}`}>
          <Search size={18} className={t.prim} />
          <input type="text" value={searchUrl} onChange={e => setSearchUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className={`bg-transparent flex-1 text-sm outline-none ${t.text} ml-2`} placeholder="粘贴音频链接或导入本地文件..." />
          <button onClick={handleSearch} className={`${t.prim} font-medium text-sm flex items-center gap-1`}><LinkIcon size={14} />导入</button>
        </div>
      </div>

      <input ref={localAudioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleLocalImport} />

      <div className="flex-1 overflow-y-auto p-5">
        <p className={`text-xs ${t.prim} mb-4`}>支持导入本地音频文件或粘贴音频直链</p>
        <h2 className={`font-bold text-xl mb-5 ${t.text}`}>我的音乐</h2>
        <div className="space-y-3">
          {orderedSongs.length === 0 ? (
            <div className="text-center py-16">
              <Music size={64} className={`mx-auto mb-4 ${t.prim} opacity-30`} />
              <p className="font-medium">还没有音乐</p>
              <p className={`text-sm mt-1`}>点击上方按钮添加歌曲</p>
            </div>
          ) : (
            orderedSongs.map(song => (
              <div key={song.id} className={`flex items-center gap-4 cursor-pointer rounded-2xl border ${t.border} p-3 ${t.panel} hover:${t.active} transition-all`} onClick={() => playSong(song)}>
                <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                  <img src={song.coverUrl || DEFAULT_COVER} alt="cover" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER; }} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className={`font-semibold truncate ${t.text}`}>{song.title}</div>
                  <div className={`text-sm ${t.prim} truncate`}>{song.artist}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); openExistingSongEditor(song); }} className={`p-2 rounded-full ${t.light}`}><Pencil size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); toggleSongFavorite(song.id); }} className={`p-2 rounded-full ${song.isFavorite ? 'text-red-500' : t.prim}`}><Heart size={18} className={song.isFavorite ? 'fill-current' : ''} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showNetease && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black/60" onClick={() => { setShowNetease(false); setNeteasePlaylist(null); }}>
          <div className="mt-auto max-h-[85%] flex flex-col rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`${t.panel} backdrop-blur-2xl px-5 pt-5 pb-2 flex items-center justify-between border-b ${t.border}`}>
              <h2 className={`text-lg font-bold ${t.text}`}>导入网易云歌单</h2>
              <button onClick={() => { setShowNetease(false); setNeteasePlaylist(null); }} className={`p-2 rounded-full ${t.light}`}><X size={20} /></button>
            </div>
            {!neteasePlaylist ? (
              <div className={`${t.panel} p-5`}>
                <div className={`flex items-center gap-3 ${t.panel} rounded-2xl border ${t.border} p-2`}>
                  <input type="text" value={neteaseInput} onChange={e => setNeteaseInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNeteaseImport()} className={`flex-1 bg-transparent ${t.text} text-sm outline-none px-3`} placeholder="粘贴歌单链接或歌单 ID..." />
                  <button onClick={handleNeteaseImport} disabled={neteaseLoading} className={`${t.primary} text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 ${neteaseLoading ? 'opacity-50' : ''}`}>
                    {neteaseLoading ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}
                    获取
                  </button>
                </div>
                <p className={`text-xs ${t.prim} mt-3 text-center`}>支持 music.163.com 链接或纯数字歌单 ID</p>
              </div>
            ) : (
              <div className={`${t.panel} flex-1 overflow-y-auto p-4 space-y-2`}>
                <div className="flex items-center gap-4 mb-4 pb-3 border-b border-white/10">
                  <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-white/10">
                    {neteasePlaylist.coverImgUrl && <img src={neteasePlaylist.coverImgUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold ${t.text}`}>{neteasePlaylist.name}</div>
                    <div className={`text-sm ${t.prim}`}>{neteasePlaylist.songs.length} 首歌曲</div>
                  </div>
                  <button onClick={importSelectedSongs} className={`${t.primary} text-white px-4 py-2 rounded-xl text-sm font-semibold`}>
                    导入 ({neteasePlaylist.selected.size})
                  </button>
                </div>
                {neteasePlaylist.songs.map(song => (
                  <div key={song.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${neteasePlaylist.selected.has(song.id) ? t.light : 'opacity-50'}`} onClick={() => toggleNeteaseSong(song.id)}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${neteasePlaylist.selected.has(song.id) ? 'bg-cyan-500 border-cyan-500' : 'border-white/30'}`}>
                      {neteasePlaylist.selected.has(song.id) && <Check size={12} className="text-white" />}
                    </div>
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/10">
                      {song.coverUrl && <img src={song.coverUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className={`text-sm font-medium truncate ${t.text}`}>{song.title}</div>
                      <div className={`text-xs ${t.prim} truncate`}>{song.artist}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {currentSong && (
        <div className={`${t.header} backdrop-blur-lg border-t ${t.border} p-3`} onClick={() => setShowPlayer(true)}>
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-md flex-shrink-0">
              <img src={currentSong.coverUrl || DEFAULT_COVER} alt="cover" className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''}`} onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER; }} />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className={`font-semibold truncate ${t.text}`}>{currentSong.title}</div>
              <div className={`text-xs ${t.prim} truncate`}>{currentSong.artist}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className={`w-11 h-11 rounded-full ${t.primary} text-white flex items-center justify-center shadow-lg`}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
