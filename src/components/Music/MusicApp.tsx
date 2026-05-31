import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, ChevronDown, Search, Heart, Play, Pause, SkipBack, SkipForward, Users, Upload, Link as LinkIcon, Pencil, RefreshCw, Trash2, Music, Cloud, Check, X, Image as ImageIcon } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';
import { Song } from '../../types';
import { saveVideoFile, loadVideoFile, deleteVideoFile } from '../../lib/db';
import { saveInteractionMemory } from '../../lib/characterMemory';
import { extractPlaylistId, extractSongId, importPlaylist, importSingleSong } from '../../lib/netease';

// ── Ins-style design tokens ──
const INS_BG = 'bg-[#f8f8fa] dark:bg-[#0f0f12]';
const INS_TEXT = 'text-slate-800 dark:text-slate-200';
const INS_MUTED = 'text-slate-400 dark:text-slate-500';
const INS_CARD = 'bg-white/50 dark:bg-white/8 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-2xl';
const INS_INPUT = 'bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-slate-200/50 dark:border-white/10 rounded-xl';
const INS_BTN = 'active:scale-[0.98] transition-all duration-150';

const MUSIC_STORAGE_KEY = 'music_custom_bg';
const MUSIC_DEFAULT_BG = 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=400&q=80';

const DEFAULT_COVER = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
    <rect width="400" height="400" rx="48" fill="#f1f5f9"/>
    <circle cx="200" cy="200" r="112" fill="#94a3b8" opacity="0.3"/>
    <circle cx="200" cy="200" r="80" fill="#94a3b8" opacity="0.5"/>
    <circle cx="200" cy="200" r="48" fill="#94a3b8"/>
    <circle cx="200" cy="200" r="20" fill="#f1f5f9"/>
  </svg>
`)}`;

const DEFAULT_LYRICS = '[00:00.00] 暂无歌词\n[00:10.00] 正在播放这首歌';

// ── Utility functions (unchanged) ──
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
    if (/^(track|audio|song|未知歌手)$/i.test(first)) return { artist: '未知歌手', title: title || first || '未命名音频' };
    return { artist: first || '未知歌手', title: title || '未命名音频' };
  }
  return { artist: '未知歌手', title: cleanMusicToken(clean) || '未命名音频' };
};

const getFileNameFromUrl = (value: string) => {
  try { const url = new URL(value); return url.searchParams.get('filename') || url.searchParams.get('file') || url.searchParams.get('name') || url.searchParams.get('title') || url.pathname.split('/').pop() || value; }
  catch { return value; }
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
  if (encoding === 1 || encoding === 2) { for (let i = start; i < bytes.length - 1; i += 2) { if (bytes[i] === 0 && bytes[i + 1] === 0) return i; } return bytes.length; }
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
    try { const mp4Metadata = parseMp4Metadata(buffer); metadata.title = metadata.title || mp4Metadata.title; metadata.artist = metadata.artist || mp4Metadata.artist; metadata.coverUrl = metadata.coverUrl || mp4Metadata.coverUrl; } catch {}
  }
  return metadata;
};

// ── Background presets ──
const BG_PRESETS = [
  'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=400&q=80',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
  'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&q=80',
];

export default function MusicApp() {
  const { songs, addSong, updateSong, deleteSong, toggleSongFavorite, characters } = useAppStore();
  const musicPlayback = useAppStore((s) => s.musicPlayback);
  const setMusicPlayback = useAppStore((s) => s.setMusicPlayback);
  const playSongById = useAppStore((s) => s.playSongById);
  const togglePlayPause = useAppStore((s) => s.togglePlayPause);
  const nextSongAction = useAppStore((s) => s.nextSong);
  const prevSongAction = useAppStore((s) => s.prevSong);
  const setMusicPlayerMode = useAppStore((s) => s.setMusicPlayerMode);

  const currentSong = useMemo(() => songs.find(s => s.id === musicPlayback.currentSongId) || null, [songs, musicPlayback.currentSongId]);

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
  const [lyricLines, setLyricLines] = useState<{ time: number; text: string }[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const chatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localAudioInputRef = useRef<HTMLInputElement>(null);
  const [currentDbKey, setCurrentDbKey] = useState<string | null>(null);
  const [showNetease, setShowNetease] = useState(false);
  const [neteaseInput, setNeteaseInput] = useState('');
  const [neteaseLoading, setNeteaseLoading] = useState(false);
  const [neteasePlaylist, setNeteasePlaylist] = useState<{ name: string; coverImgUrl: string; songs: Song[]; selected: Set<string> } | null>(null);
  const [showBgPicker, setShowBgPicker] = useState(false);

  // Background image
  const [bgUrl, setBgUrl] = useState<string>(() => {
    try { return localStorage.getItem(MUSIC_STORAGE_KEY) || MUSIC_DEFAULT_BG; }
    catch { return MUSIC_DEFAULT_BG; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImportBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { const url = event.target?.result as string; setBgUrl(url); localStorage.setItem(MUSIC_STORAGE_KEY, url); };
    reader.readAsDataURL(file);
  };

  useEffect(() => { if (!songs.length) { setMusicPlayback({ currentSongId: null, isPlaying: false }); } }, [songs.length]);
  useEffect(() => () => { if (chatTimeoutRef.current) clearTimeout(chatTimeoutRef.current); }, []);

  // Parse lyrics
  useEffect(() => {
    if (!currentSong?.lyrics) { setLyricLines([]); return; }
    const lines = currentSong.lyrics.split('\n');
    const parsed: { time: number; text: string }[] = [];
    for (const line of lines) {
      const match = line.match(/^\[(\d+):(\d+\.\d+)\](.*)/);
      if (match) { const time = parseInt(match[1]) * 60 + parseFloat(match[2]); const text = match[3].trim(); if (text) parsed.push({ time, text }); }
    }
    parsed.sort((a, b) => a.time - b.time);
    setLyricLines(parsed);
    setCurrentLyricIndex(-1);
  }, [currentSong?.lyrics]);

  // Update lyric index
  useEffect(() => {
    if (!lyricLines.length) { setCurrentLyricIndex(-1); return; }
    let idx = -1;
    for (let i = lyricLines.length - 1; i >= 0; i--) { if (musicPlayback.currentTime >= lyricLines[i].time) { idx = i; break; } }
    setCurrentLyricIndex(idx);
  }, [musicPlayback.currentTime, lyricLines]);

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
      try { const metadata = parseAudioMetadata(await source.blob.arrayBuffer()); draft.title = metadata.title || draft.title; draft.artist = metadata.artist || draft.artist; draft.coverUrl = metadata.coverUrl || draft.coverUrl; draft.lyrics = metadata.lyrics || draft.lyrics; hint = (metadata.title || metadata.artist || metadata.coverUrl || metadata.lyrics) ? '已提取封面、歌手、歌词。' : '未找到内嵌信息，已按文件名识别。'; }
      catch { hint = '读取失败，按文件名识别。'; }
    }
    return { draft, hint };
  };

  const openSongEditor = async (source: { url: string; fallbackName: string; blob?: Blob; dbKey?: string; editingSongId?: string | null }) => {
    setIsImporting(true);
    try { const { draft, hint } = await buildSongDraft(source); setEditSongData(draft); setEditingSongId(source.editingSongId || null); setRecognitionHint(hint); setShowEditSong(true); }
    finally { setIsImporting(false); }
  };

  const handleSaveSong = () => {
    const songToSave = { title: editSongData.title || '未命名音频', artist: editSongData.artist || '未知歌手', coverUrl: editSongData.coverUrl || DEFAULT_COVER, url: editSongData.url || '', lyrics: editSongData.lyrics || DEFAULT_LYRICS, isFavorite: Boolean(editSongData.isFavorite), dbKey: editSongData.dbKey || undefined } as Omit<Song, 'id'>;
    if (editingSongId) updateSong(editingSongId, songToSave); else addSong(songToSave);
    setSearchUrl(''); setShowEditSong(false); setRecognitionHint(''); setEditingSongId(null); setEditSongData({});
  };

  const handleDeleteSong = () => {
    if (!editingSongId) return; deleteSong(editingSongId);
    if (currentSong?.id === editingSongId) { setMusicPlayback({ currentSongId: null, isPlaying: false }); setShowPlayer(false); }
    setShowEditSong(false); setRecognitionHint(''); setEditingSongId(null); setEditSongData({});
  };

  const handleRetryRecognition = async () => {
    const sourceUrl = (editSongData.url || '').trim();
    const fallbackName = [editSongData.artist, editSongData.title].filter(Boolean).join(' - ') || sourceUrl || '未命名音频';
    if (!sourceUrl) { setRecognitionHint('请先填写音频链接。'); return; }
    setIsImporting(true);
    try { let blob: Blob | undefined; if (sourceUrl.startsWith('data:audio') || isLikelyAudioUrl(sourceUrl)) { try { const response = await fetch(sourceUrl); blob = await response.blob(); } catch {} } const { draft, hint } = await buildSongDraft({ url: sourceUrl, fallbackName, blob }); setEditSongData(prev => ({ ...prev, title: draft.title || prev.title, artist: draft.artist || prev.artist, coverUrl: draft.coverUrl || prev.coverUrl, lyrics: draft.lyrics && draft.lyrics !== DEFAULT_LYRICS ? draft.lyrics : prev.lyrics })); setRecognitionHint(hint); }
    finally { setIsImporting(false); }
  };

  const playSong = (song: Song) => {
    playSongById(song.id);
    setShowPlayer(true);
    setSelectedFriend('');
    setPlayError('');
    // 听歌记忆 — 对所有非禁用角色
    const store = useAppStore.getState();
    const now = Date.now();
    Object.keys(store.characters).forEach(charId => {
      if ((store.characters[charId] as any).isDisabled) return;
      saveInteractionMemory(charId, `一起听了歌曲《${song.title}》`, `${song.artist} - ${song.title}`, 'event', 2);
      store.addEmotionEvent({
        characterId: charId, paDelta: 0.15, naDelta: -0.05,
        word: '愉快', valence: 0.6, arousal: 0.5,
        matchSource: 'free_form', source: 'manual',
      });
    });
  };

  const togglePlay = () => { togglePlayPause(); };

  const handleListenWithFriend = async (charId: string) => {
    setSelectedFriend(charId); setShowFriends(false); setFriendChat([]); setIsFriendTyping(true);
    try { const char = characters[charId]; const reply = await generateAIResponse(`我们正在一起听一首歌，歌名是《${currentSong?.title}》。请你以${char.name}的身份简短评论这首歌。`); setFriendChat([{ sender: 'friend', text: reply }]); }
    catch { setFriendChat([{ sender: 'friend', text: '这首歌不错。' }]); }
    finally { setIsFriendTyping(false); }
    saveInteractionMemory(charId, `和${characters[charId]?.name}一起听《${currentSong?.title}》`, currentSong?.artist, 'event', 3);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !selectedFriend) return; const text = chatInput; setChatInput('');
    setFriendChat(prev => [...prev, { sender: 'user', text }]); setIsFriendTyping(true);
    try { const char = characters[selectedFriend]; const reply = await generateAIResponse(`我们正在一起听《${currentSong?.title}》。你回复：${text}`); setFriendChat(prev => [...prev, { sender: 'friend', text: reply }]); }
    catch { setFriendChat(prev => [...prev, { sender: 'friend', text: '嗯。' }]); }
    finally { setIsFriendTyping(false); }
    saveInteractionMemory(selectedFriend, `一起听歌时聊了${text}`, `歌：${currentSong?.title}`, 'event', 2);
  };

  const [isImporting, setIsImporting] = useState(false);

  const handleLocalImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; const dbKey = `audio_${Date.now()}`;
    await saveVideoFile(dbKey, file); setCurrentDbKey(dbKey);
    const objectUrl = URL.createObjectURL(file); await openSongEditor({ url: objectUrl, blob: file, fallbackName: file.name, dbKey }); e.target.value = '';
  };

  const [searchUrl, setSearchUrl] = useState('');

  const handleSearch = async () => {
    const value = searchUrl.trim(); if (!value) return;
    if (isLikelyAudioUrl(value)) { await openSongEditor({ url: value, fallbackName: getFileNameFromUrl(value) }); return; }
    await openSongEditor({ url: value, fallbackName: getFileNameFromUrl(value) });
  };

  const openExistingSongEditor = (song: Song) => {
    setEditingSongId(song.id); setEditSongData(song); setRecognitionHint('可修改信息或重新识别。'); setShowEditSong(true);
  };

  const handleNeteaseImport = async () => {
    const input = neteaseInput.trim(); if (!input) { setNeteaseInput('请输入网易云链接或 ID'); return; }
    const songId = extractSongId(input);
    const playlistId = extractPlaylistId(input);
    setNeteaseLoading(true);
    try {
      // 先试单曲，失败了自动切歌单
      if (songId) {
        try {
          const song = await importSingleSong(songId);
          const { id: _songId, ...songData } = song;
          addSong(songData); setNeteaseInput(''); setShowNetease(false);
          return;
        } catch {
          if (playlistId) {
            const { playlist, songs } = await importPlaylist(playlistId);
            setNeteasePlaylist({ name: playlist.name, coverImgUrl: playlist.coverImgUrl, songs, selected: new Set(songs.map(s => s.id)) }); setNeteaseInput('');
            return;
          }
          throw new Error('无法识别该 ID 是歌曲还是歌单');
        }
      }
      if (playlistId) {
        const { playlist, songs } = await importPlaylist(playlistId);
        setNeteasePlaylist({ name: playlist.name, coverImgUrl: playlist.coverImgUrl, songs, selected: new Set(songs.map(s => s.id)) }); setNeteaseInput('');
        return;
      }
      setNeteaseInput('无法识别，请输入网易云歌单/歌曲链接或 ID');
    } catch (err: any) {
      setNeteaseInput(err.message || '导入失败');
    } finally {
      setNeteaseLoading(false);
    }
  };

  const toggleNeteaseSong = (songId: string) => {
    if (!neteasePlaylist) return; const next = new Set(neteasePlaylist.selected);
    if (next.has(songId)) next.delete(songId); else next.add(songId); setNeteasePlaylist({ ...neteasePlaylist, selected: next });
  };

  const importSelectedSongs = () => {
    if (!neteasePlaylist) return; const songsToAdd = neteasePlaylist.songs.filter(s => neteasePlaylist.selected.has(s.id));
    for (const song of songsToAdd) addSong({ ...song, id: undefined as any }); setShowNetease(false); setNeteasePlaylist(null);
  };

  // ── Lyric scroll ref ──
  const lyricContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (lyricContainerRef.current && currentLyricIndex >= 0) {
      const container = lyricContainerRef.current;
      const activeItem = container.children[currentLyricIndex] as HTMLElement;
      if (activeItem) activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [currentLyricIndex]);

  // ── Edit Song Screen ──
  if (showEditSong) {
    return (
      <div className={`h-full flex flex-col ${INS_BG} absolute inset-0 z-50`}>
        <div className="px-4 pt-7 pb-3 flex items-center justify-between bg-white/50 dark:bg-[#1a1a1a]/50 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/10">
          <button onClick={() => { setShowEditSong(false); setRecognitionHint(''); setEditingSongId(null); setEditSongData({}); }} className={`${INS_MUTED} font-medium ${INS_BTN}`}>取消</button>
          <h1 className={`text-lg font-bold ${INS_TEXT}`}>{editingSongId ? '编辑歌曲' : '添加歌曲'}</h1>
          <button onClick={handleSaveSong} className="bg-slate-800 text-white px-5 py-1.5 rounded-full text-sm font-semibold shadow-lg ${INS_BTN}">保存</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className={`${INS_CARD} p-5 flex items-center gap-5`}>
            <div className="relative group">
              <img src={editSongData.coverUrl || DEFAULT_COVER} alt="cover" className="w-24 h-24 rounded-2xl object-cover shadow-md" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER; }} />
              <label className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (event) => { setEditSongData({...editSongData, coverUrl: event.target?.result as string}); }; reader.readAsDataURL(file); } }} />
                <span className="text-white text-xs font-medium">更换封面</span>
              </label>
            </div>
            <div className="flex-1"><p className={`text-sm ${INS_MUTED}`}>{recognitionHint || '可手动修改信息'}</p></div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleRetryRecognition} disabled={isImporting} className={`flex-1 bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-xl py-3 text-sm font-semibold ${INS_MUTED} flex items-center justify-center gap-2 ${isImporting ? 'opacity-50' : ''} ${INS_BTN}`}>
              <RefreshCw size={16} className={isImporting ? 'animate-spin' : ''} />重新识别
            </button>
            {editingSongId && (
              <button onClick={handleDeleteSong} className="flex-1 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl py-3 text-sm font-semibold text-red-500 flex items-center justify-center gap-2 ${INS_BTN}">
                <Trash2 size={16} />删除
              </button>
            )}
          </div>
          <div className="space-y-4">
            <div><label className={`text-xs font-semibold ${INS_MUTED} mb-2 block`}>歌曲名</label><input type="text" value={editSongData.title || ''} onChange={e => setEditSongData({...editSongData, title: e.target.value})} className={`w-full ${INS_INPUT} p-4 ${INS_TEXT} text-base`} placeholder="输入歌曲名" /></div>
            <div><label className={`text-xs font-semibold ${INS_MUTED} mb-2 block`}>歌手</label><input type="text" value={editSongData.artist || ''} onChange={e => setEditSongData({...editSongData, artist: e.target.value})} className={`w-full ${INS_INPUT} p-4 ${INS_TEXT} text-base`} placeholder="输入歌手名" /></div>
            <div><label className={`text-xs font-semibold ${INS_MUTED} mb-2 block`}>音频链接</label><input type="text" value={editSongData.url || ''} onChange={e => setEditSongData({...editSongData, url: e.target.value})} className={`w-full ${INS_INPUT} p-4 ${INS_TEXT} text-base`} placeholder="粘贴音频直链或填写URL" /></div>
          </div>
        </div>
      </div>
    );
  }

  // ── Full Player Screen ──
  if (currentSong && showPlayer) {
    return (
      <div className="h-full flex flex-col absolute inset-0 z-50 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgUrl})` }} />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Top bar - extra padding to avoid notch */}
          <div className="px-6 pt-14 pb-4 flex items-center justify-between flex-none">
            <button onClick={() => setShowPlayer(false)} className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center text-white hover:bg-white/30 transition-colors"><ChevronLeft size={22} /></button>
            <div className="text-center flex-1 px-3">
              <div className="font-bold text-lg text-white truncate">{currentSong.title}</div>
              <div className="text-sm text-white/60 truncate">{currentSong.artist}</div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowFriends(true)} className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center text-white hover:bg-white/30 transition-colors"><Users size={18} /></button>
              <button onClick={() => { setShowPlayer(false); setMusicPlayerMode('bar'); }} className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md border border-white/25 flex items-center justify-center text-white hover:bg-white/30 transition-colors"><ChevronDown size={22} /></button>
            </div>
          </div>

          {/* Vinyl + lyrics - scrollable, takes remaining space */}
          <div className={`flex-1 flex flex-col items-center justify-center px-6 min-h-0 overflow-y-auto ${selectedFriend ? 'opacity-20' : ''}`}>
            {/* Vinyl */}
            <div className="relative flex-none">
              <div className={`w-48 h-48 rounded-full overflow-hidden shadow-2xl ${musicPlayback.isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`} style={{ boxShadow: '0 0 60px rgba(0,0,0,0.4)' }}>
                <img src={currentSong.coverUrl || DEFAULT_COVER} alt="cover" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER; }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border-2 border-white/10">
                  <div className="w-3.5 h-3.5 rounded-full bg-white/80" />
                </div>
              </div>
            </div>

            {/* Lyrics */}
            <div className="mt-6 w-full max-w-sm mx-auto flex-1 min-h-0 overflow-hidden relative">
              <div ref={lyricContainerRef} className="h-full overflow-y-auto scrollbar-hide px-4" style={{ scrollBehavior: 'smooth' }}>
                {lyricLines.length > 0 ? (
                  <div className="text-center space-y-3 py-6">
                    {lyricLines.map((line, i) => (
                      <div key={i} className={`transition-all duration-300 ${
                        i === currentLyricIndex ? 'text-white text-base font-bold scale-105' : i === currentLyricIndex - 1 || i === currentLyricIndex + 1 ? 'text-white/60 text-sm' : 'text-white/30 text-xs'
                      }`}>{line.text}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-white/50 pt-6 text-sm">暂无歌词</div>
                )}
              </div>
            </div>
            {playError && <div className="mt-4 text-red-300 text-sm bg-red-500/20 px-4 py-2 rounded-full flex-none">{playError}</div>}
          </div>

          {/* Bottom controls - ALWAYS at bottom using absolute positioning */}
          <div className="flex-none px-6 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 bg-gradient-to-t from-black/60 to-transparent">
            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-white/50 w-10 text-right">{formatTime(musicPlayback.currentTime)}</span>
              <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${musicPlayback.duration ? (musicPlayback.currentTime / musicPlayback.duration) * 100 : 0}%` }} />
              </div>
              <span className="text-xs text-white/50 w-10">{formatTime(musicPlayback.duration)}</span>
            </div>
            {/* Buttons */}
            <div className="flex items-center justify-center gap-6 bg-white/25 backdrop-blur-xl rounded-2xl py-3 px-5 border border-white/20 shadow-lg">
              <button onClick={() => toggleSongFavorite(currentSong.id)} className="flex flex-col items-center gap-0.5 text-white/90 hover:text-white transition-colors min-w-[44px]">
                <Heart size={22} className={currentSong.isFavorite ? 'fill-white text-white' : ''} />
                <span className="text-[8px]">收藏</span>
              </button>
              <button onClick={() => { const idx = orderedSongs.findIndex(s => s.id === currentSong.id); const prev = idx <= 0 ? orderedSongs[orderedSongs.length - 1] : orderedSongs[idx - 1]; if (prev) playSong(prev); }} className="flex flex-col items-center gap-0.5 text-white/90 hover:text-white transition-colors min-w-[44px]">
                <SkipBack size={22} />
                <span className="text-[8px]">上一首</span>
              </button>
              <button onClick={togglePlay} className="w-14 h-14 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform border border-white/30">
                {musicPlayback.isPlaying ? <Pause size={26} className="text-white ml-0.5" /> : <Play size={26} className="text-white ml-1" />}
              </button>
              <button onClick={() => { const idx = orderedSongs.findIndex(s => s.id === currentSong.id); const next = orderedSongs[(idx + 1) % orderedSongs.length]; if (next) playSong(next); }} className="flex flex-col items-center gap-0.5 text-white/90 hover:text-white transition-colors min-w-[44px]">
                <SkipForward size={22} />
                <span className="text-[8px]">下一首</span>
              </button>
            </div>
          </div>

          {/* Friend chat overlay */}
          {selectedFriend && (
            <div className="absolute inset-0 z-20 flex flex-col bg-black/50 backdrop-blur-sm" onClick={() => setSelectedFriend('')}>
              <div className="flex-1" />
              <div className="mx-4 mb-4 bg-black/60 backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/10">
                  <span className="text-sm text-white/80 font-medium">和 {characters[selectedFriend]?.name} 一起听</span>
                  <button onClick={() => setSelectedFriend('')} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20"><X size={13} /></button>
                </div>
                {/* Messages */}
                <div className="h-48 overflow-y-auto space-y-2 p-3">
                  {friendChat.map((msg, i) => (<div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-2.5 rounded-2xl text-sm ${msg.sender === 'user' ? 'bg-white/25 text-white' : 'bg-white/10 text-white/80'}`}>{msg.text}</div></div>))}
                  {isFriendTyping && <div className="flex justify-start"><div className="p-2.5 rounded-2xl bg-white/10 text-white/50">...</div></div>}
                </div>
                {/* Input */}
                <div className="flex gap-2 p-3 border-t border-white/10">
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChat()} className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-2 text-sm text-white outline-none placeholder-white/40" placeholder="聊这首歌..." />
                  <button onClick={handleSendChat} className="bg-white/20 text-white rounded-full px-4 py-2 text-sm font-medium hover:bg-white/30">发送</button>
                </div>
              </div>
            </div>
          )}

          {/* Friends overlay */}
          {showFriends && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col">
              <div className="px-4 pt-7 pb-3 flex items-center justify-between border-b border-white/10">
                <span className="text-lg text-white font-semibold">邀请好友一起听</span>
                <button onClick={() => setShowFriends(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {Object.values(characters).filter(c => !(c as any).isDisabled).map(char => (
                  <div key={char.id} className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-xl cursor-pointer hover:bg-white/20 transition-colors" onClick={() => handleListenWithFriend(char.id)}>
                    <div className="w-12 h-12 rounded-full" style={{ background: char.avatar.startsWith('#') ? char.avatar : `url(${char.avatar}) center/cover` }} />
                    <span className="text-white font-medium">{char.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Song List View ──
  return (
    <div className={`h-full flex flex-col ${INS_BG} absolute inset-0 z-50`}>
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center opacity-[0.06] dark:opacity-[0.03]" style={{ backgroundImage: `url(${bgUrl})` }} />

      {/* Header - spacious layout */}
      <div className="relative z-10 bg-white/50 dark:bg-[#1a1a1a]/50 backdrop-blur-xl px-4 pt-14 pb-4 flex items-center gap-2 border-b border-slate-200/50 dark:border-white/10">
        <button className={`w-9 h-9 rounded-xl bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-slate-200/50 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm shrink-0 ${INS_BTN}`} onClick={() => localAudioInputRef.current?.click()}>
          <Upload size={16} />
        </button>
        <button className={`w-9 h-9 rounded-xl bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-slate-200/50 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm shrink-0 ${INS_BTN}`} onClick={() => setShowNetease(true)}>
          <Cloud size={16} />
        </button>
        <div className={`flex-1 bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-slate-200/50 dark:border-white/10 rounded-xl h-10 flex items-center px-3 shadow-sm min-w-0`}>
          <Search size={16} className="text-slate-400 shrink-0" />
          <input type="text" value={searchUrl} onChange={e => setSearchUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className={`bg-transparent flex-1 text-sm outline-none ${INS_TEXT} ml-2 min-w-0`} placeholder="粘贴音频链接或搜索..." />
          <button onClick={handleSearch} className={`text-slate-400 font-medium text-xs shrink-0 bg-white/60 dark:bg-white/10 px-2.5 py-1 rounded-lg ml-1 ${INS_BTN}`}><LinkIcon size={11} />导入</button>
        </div>
        <button onClick={() => setShowBgPicker(!showBgPicker)} className={`w-9 h-9 rounded-xl bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-slate-200/50 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm shrink-0 ${INS_BTN}`}>
          <ImageIcon size={16} />
        </button>
      </div>

      <input ref={localAudioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleLocalImport} />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImportBg} />

      {/* Background picker */}
      {showBgPicker && (
        <div className="relative z-10 bg-white/60 dark:bg-[#1a1a1a]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-semibold ${INS_MUTED} uppercase tracking-wider`}>背景图</span>
            <button onClick={() => fileInputRef.current?.click()} className={`text-xs text-slate-500 font-medium ${INS_BTN}`}>从相册导入</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {BG_PRESETS.map((url, i) => (
              <button key={i} onClick={() => { setBgUrl(url); localStorage.setItem(MUSIC_STORAGE_KEY, url); setShowBgPicker(false); }} className={`w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${bgUrl === url ? 'border-slate-500 ring-2 ring-slate-300' : 'border-transparent'} ${INS_BTN}`}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Song list */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4 relative z-10">
        <h2 className={`font-bold text-xl mb-4 ${INS_TEXT}`}>我的音乐</h2>
        <div className="space-y-3">
          {orderedSongs.length === 0 ? (
            <div className="text-center py-20">
              <Music size={56} className={`mx-auto mb-4 ${INS_MUTED} opacity-30`} />
              <p className={`font-medium ${INS_TEXT}`}>还没有音乐</p>
              <p className={`text-sm mt-1 ${INS_MUTED}`}>点击上方按钮添加歌曲</p>
            </div>
          ) : (
            orderedSongs.map(song => (
              <div key={song.id} className={`flex items-center gap-3 cursor-pointer ${INS_CARD} p-3 ${INS_BTN}`} onClick={() => playSong(song)}>
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                  <img src={song.coverUrl || DEFAULT_COVER} alt="cover" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER; }} />
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className={`font-medium text-sm truncate ${INS_TEXT}`}>{song.title}</div>
                  <div className={`text-xs ${INS_MUTED} truncate`}>{song.artist}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); openExistingSongEditor(song); }} className={`p-2 rounded-xl bg-white/50 dark:bg-white/5 text-slate-400 hover:text-slate-600 ${INS_BTN}`}><Pencil size={15} /></button>
                  <button onClick={(e) => { e.stopPropagation(); toggleSongFavorite(song.id); }} className={`p-2 rounded-xl bg-white/50 dark:bg-white/5 ${song.isFavorite ? 'text-red-400' : 'text-slate-400'} ${INS_BTN}`}><Heart size={16} className={song.isFavorite ? 'fill-current' : ''} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* NetEase import bottom sheet */}
      {showNetease && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black/80" onClick={() => { setShowNetease(false); setNeteasePlaylist(null); }}>
          <div className="mt-auto max-h-[85%] flex flex-col rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-white/60 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl px-5 pt-5 pb-2 flex items-center justify-between border-b border-slate-200 dark:border-white/10">
              <h2 className={`text-lg font-bold ${INS_TEXT}`}>导入网易云歌单</h2>
              <button onClick={() => { setShowNetease(false); setNeteasePlaylist(null); }} className={`p-2 rounded-full ${INS_MUTED} hover:text-slate-700 ${INS_BTN}`}><X size={20} /></button>
            </div>
            {!neteasePlaylist ? (
              <div className="bg-white/60 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl p-5">
                <div className={`flex items-center gap-3 ${INS_INPUT} p-2`}>
                  <input type="text" value={neteaseInput} onChange={e => setNeteaseInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNeteaseImport()} className={`flex-1 bg-transparent ${INS_TEXT} text-sm outline-none px-2`} placeholder="粘贴歌单链接或歌单 ID..." />
                  <button onClick={handleNeteaseImport} disabled={neteaseLoading} className={`bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 ${neteaseLoading ? 'opacity-50' : ''} ${INS_BTN}`}>
                    {neteaseLoading ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}获取
                  </button>
                </div>
                <p className={`text-xs ${INS_MUTED} mt-3 text-center`}>支持 music.163.com 链接或纯数字歌单 ID</p>
              </div>
            ) : (
              <div className="bg-white/60 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl flex-1 overflow-y-auto p-4 space-y-2">
                <div className="flex items-center gap-4 mb-4 pb-3 border-b border-slate-200 dark:border-white/10">
                  <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-slate-100 dark:bg-white/5">
                    {neteasePlaylist.coverImgUrl && <img src={neteasePlaylist.coverImgUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1"><div className={`font-semibold ${INS_TEXT}`}>{neteasePlaylist.name}</div><div className={`text-sm ${INS_MUTED}`}>{neteasePlaylist.songs.length} 首歌曲</div></div>
                  <button onClick={importSelectedSongs} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-semibold ${INS_BTN}">导入 ({neteasePlaylist.selected.size})</button>
                </div>
                {neteasePlaylist.songs.map(song => (
                  <div key={song.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${neteasePlaylist.selected.has(song.id) ? 'bg-white/60 dark:bg-white/10' : 'opacity-50'} ${INS_BTN}`} onClick={() => toggleNeteaseSong(song.id)}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${neteasePlaylist.selected.has(song.id) ? 'bg-slate-600 border-slate-600' : 'border-slate-300 dark:border-white/30'}`}>
                      {neteasePlaylist.selected.has(song.id) && <Check size={12} className="text-white" />}
                    </div>
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-white/5">
                      {song.coverUrl && <img src={song.coverUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                    </div>
                    <div className="flex-1 overflow-hidden"><div className={`text-sm font-medium truncate ${INS_TEXT}`}>{song.title}</div><div className={`text-xs ${INS_MUTED} truncate`}>{song.artist}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mini player - floating at bottom when song is playing and player isn't shown */}
      {currentSong && !showPlayer && (
        <div className="relative z-10 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2">
          <div className={`${INS_CARD} p-3 shadow-lg`} onClick={() => setShowPlayer(true)}>
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                <img src={currentSong.coverUrl || DEFAULT_COVER} alt="cover" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER; }} />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className={`font-medium text-sm truncate ${INS_TEXT}`}>{currentSong.title}</div>
                <div className={`text-xs ${INS_MUTED} truncate`}>{currentSong.artist}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-10 h-10 rounded-xl bg-slate-800 dark:bg-white text-white dark:text-slate-800 flex items-center justify-center shadow-md ${INS_BTN}">
                {musicPlayback.isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); setMusicPlayerMode('bar'); }} className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 ${INS_BTN}">
                <ChevronDown size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
