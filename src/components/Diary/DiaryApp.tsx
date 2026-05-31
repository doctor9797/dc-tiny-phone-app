import React, { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Images, Music2, NotebookPen, MessageCircleHeart, Trash2, Sparkles, Pencil } from 'lucide-react';
import ImageUploader from '../ImageUploader';
import { generateAIResponse } from '../../lib/ai';
import { saveInteractionMemory } from '../../lib/characterMemory';
import { DiaryEntry, DiaryStyleConfig } from '../../types';

const TEMPLATE_OPTIONS: Array<{ id: DiaryStyleConfig['template']; name: string; desc: string }> = [
  { id: 'storybook', name: '童话页', desc: '软糯、像小动物手帐' },
  { id: 'scrapbook', name: '贴贴本', desc: '拼贴感、照片友好' },
  { id: 'letter', name: '信纸风', desc: '安静、适合碎碎念' },
  { id: 'forest', name: '森系本', desc: '像小森林日记' },
  { id: 'magazine', name: '杂志卡', desc: '更利落、更排版感' },
];

const FONT_OPTIONS = [
  { value: '"PingFang SC", "Microsoft YaHei", sans-serif', label: '清爽圆润' },
  { value: '"Kaiti SC", "STKaiti", serif', label: '手写信纸' },
  { value: '"Songti SC", "STSong", serif', label: '书页正文' },
  { value: '"Trebuchet MS", "PingFang SC", sans-serif', label: '杂志标题' },
  { value: '"Comic Sans MS", "PingFang SC", cursive', label: '可爱手帐' },
];

const BACKGROUND_PRESETS = [
  '#fff8f1',
  '#fefce8',
  '#fdf2f8',
  '#eff6ff',
  '#f0fdf4',
  '#f5f3ff',
  '#ffffff',
];

const TEXT_COLORS = ['#3f3a35', '#5b4335', '#334155', '#1f2937', '#365314', '#7c3aed', '#be185d'];

const DEFAULT_STYLE: DiaryStyleConfig = {
  template: 'storybook',
  fontFamily: FONT_OPTIONS[0].value,
  fontSize: 17,
  textColor: '#3f3a35',
  background: '',
  backgroundColor: '#fff8f1',
};

const readAudioAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const formatMusicName = (name: string) =>
  name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function DiaryCard({ entry, previewOnly = false }: { entry: DiaryEntry; previewOnly?: boolean }) {
  const template = entry.style.template;
  const decorativeEmojis =
    template === 'storybook'
      ? { before: '🐰', after: '🧸' }
      : template === 'scrapbook'
        ? { before: '✿', after: '✦' }
        : template === 'letter'
          ? { before: '✉️', after: '' }
          : template === 'forest'
            ? { before: '🍃', after: '🦔' }
            : { before: '★', after: '✶' };

  const containerClass =
    template === 'storybook'
      ? 'rounded-[2rem] border border-[#f1dcc9] shadow-[0_18px_35px_rgba(133,94,66,0.12)]'
      : template === 'scrapbook'
        ? 'rounded-[1.75rem] border border-white/80 shadow-[0_18px_35px_rgba(148,163,184,0.14)] rotate-[-0.5deg]'
        : template === 'letter'
          ? 'rounded-[1.5rem] border border-[#e7dbc8] shadow-[0_18px_35px_rgba(120,98,77,0.1)]'
          : template === 'forest'
            ? 'rounded-[2rem] border border-[#dce8cf] shadow-[0_18px_35px_rgba(74,110,74,0.14)]'
            : 'rounded-[1.6rem] border border-slate-200 shadow-[0_20px_40px_rgba(15,23,42,0.14)]';

  const overlay =
    template === 'scrapbook'
      ? 'linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.14))'
      : template === 'forest'
        ? 'linear-gradient(180deg, rgba(255,255,255,0.35), rgba(236,253,245,0.08))'
        : 'linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08))';

  return (
    <div
      className={`relative overflow-hidden p-5 ${containerClass}`}
      style={{
        backgroundColor: entry.style.backgroundColor,
        backgroundImage: entry.style.background
          ? `${overlay}, url(${entry.style.background})`
          : overlay,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: entry.style.textColor,
        fontFamily: entry.style.fontFamily,
      }}
    >
      {decorativeEmojis.before && (
        <div className="absolute top-3 right-5 text-2xl opacity-30 select-none pointer-events-none">{decorativeEmojis.before}</div>
      )}
      {decorativeEmojis.after && (
        <div className="absolute bottom-3 left-5 text-2xl opacity-30 select-none pointer-events-none">{decorativeEmojis.after}</div>
      )}
      <div className="relative z-10">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] opacity-60">
              {template === 'storybook' ? 'My Tiny Story' : template === 'scrapbook' ? 'Little Moments' : template === 'letter' ? 'Private Note' : template === 'forest' ? 'Forest Diary' : 'Daily Layout'}
            </div>
            <div className="mt-1 font-black leading-tight" style={{ fontSize: Math.max(entry.style.fontSize + 6, 20) }}>
              {entry.title || '今天的碎碎念'}
            </div>
          </div>
          <div className="text-[11px] opacity-60 shrink-0">{new Date(entry.updatedAt).toLocaleDateString()}</div>
        </div>

        {entry.photoUrls?.length ? (
          <div className={`mb-4 grid gap-2 ${entry.photoUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {entry.photoUrls.slice(0, 4).map((url, index) => (
              <img
                key={`${url}_${index}`}
                src={url}
                alt=""
                className={`w-full object-cover rounded-[1.2rem] border border-white/60 ${entry.photoUrls && entry.photoUrls.length === 1 ? 'h-44' : 'h-28'}`}
              />
            ))}
          </div>
        ) : null}

        <div
          className={`${template === 'magazine' ? 'columns-1' : ''} whitespace-pre-wrap leading-8`}
          style={{ fontSize: entry.style.fontSize }}
        >
          {entry.content || '在这里写下今天那些想记住又不一定重要的小情绪。'}
        </div>

        {(entry.musicTitle || entry.musicUrl) && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/45 px-3 py-2 text-xs font-bold">
            <Music2 size={14} />
            {entry.musicTitle || '附带一段音乐'}
          </div>
        )}

        {!previewOnly && (entry.comments || []).length > 0 && (
          <div className="mt-5 space-y-2">
            {(entry.comments || []).map(comment => (
              <div key={comment.id} className="rounded-[1.2rem] border border-white/55 bg-white/45 px-3 py-3 text-sm leading-6">
                <div className="text-xs font-black opacity-70 mb-1">{comment.characterId}</div>
                <div>{comment.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DiaryApp() {
  const { closeApp, characters, diaryEntries, saveDiaryEntry, deleteDiaryEntry, addActivityLog } = useAppStore();
  const [view, setView] = useState<'editor' | 'history'>('history');
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [style, setStyle] = useState<DiaryStyleConfig>(DEFAULT_STYLE);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [musicUrl, setMusicUrl] = useState('');
  const [musicTitle, setMusicTitle] = useState('');
  const [commentCharacterIds, setCommentCharacterIds] = useState<string[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const availableCharacters = useMemo(
    () => Object.values(characters).filter(char => (char as any).isDisabled !== true),
    [characters]
  );

  const draftEntry = useMemo<DiaryEntry>(() => ({
    id: currentEntry?.id || 'preview',
    title,
    content,
    createdAt: currentEntry?.createdAt || Date.now(),
    updatedAt: Date.now(),
    photoUrls,
    musicUrl: musicUrl || undefined,
    musicTitle: musicTitle || undefined,
    commentCharacterIds,
    comments: currentEntry?.comments || [],
    style,
  }), [commentCharacterIds, content, currentEntry, musicTitle, musicUrl, photoUrls, style, title]);

  const toggleCommentCharacter = (charId: string) => {
    setCommentCharacterIds(prev => prev.includes(charId) ? prev.filter(id => id !== charId) : [...prev, charId]);
  };

  const resetEditor = () => {
    setCurrentEntry(null);
    setTitle('');
    setContent('');
    setStyle(DEFAULT_STYLE);
    setPhotoUrls([]);
    setMusicUrl('');
    setMusicTitle('');
    setCommentCharacterIds([]);
  };

  const handleAudioImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readAudioAsDataUrl(file);
    setMusicUrl(dataUrl);
    setMusicTitle(formatMusicName(file.name));
    event.target.value = '';
  };

  const buildCharacterComment = async (characterId: string, entry: DiaryEntry) => {
    const char = characters[characterId];
    if (!char) return null;
    const prompt = `你是${char.name}，性格是${char.personality}，和我的关系是${char.relationship}。这是我的一篇日记，请你像看完我碎碎念之后给我的一句评论或留言，要求自然、像真人，会带一点你自己的性格，不要Markdown，不超过70字。\n标题：${entry.title || '未命名日记'}\n内容：${entry.content.slice(0, 800)}`;
    try {
      const text = (await generateAIResponse(prompt)).replace(/[#*]/g, '').trim();
      saveInteractionMemory(characterId, `${characters[characterId]?.name}评论了我的日记`, text, 'event', 4);
      useAppStore.getState().addEmotionEvent({ characterId, paDelta: 0.2, naDelta: -0.05, word: '共鸣', valence: 0.5, arousal: 0.4, matchSource: 'free_form', source: 'manual' });
      return { id: `${Date.now()}_${characterId}_${Math.random()}`, characterId, text, createdAt: Date.now() };
    } catch {
      return {
        id: `${Date.now()}_${characterId}_fallback`,
        characterId,
        text: '我看完了，感觉你今天记下来的这些情绪都很真实。',
        createdAt: Date.now()
      };
    }
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setLoadingComments(true);
    const baseEntry: DiaryEntry = {
      ...draftEntry,
      id: currentEntry?.id || `${Date.now()}`,
      createdAt: currentEntry?.createdAt || Date.now(),
      updatedAt: Date.now(),
      comments: currentEntry?.comments || [],
    };

    let comments = baseEntry.comments || [];
    if (commentCharacterIds.length > 0) {
      const nextComments = await Promise.all(commentCharacterIds.map(id => buildCharacterComment(id, baseEntry)));
      comments = nextComments.filter(Boolean) as NonNullable<DiaryEntry['comments']>;
    }

    const finalEntry: DiaryEntry = {
      ...baseEntry,
      comments,
    };

    saveDiaryEntry(finalEntry);
    addActivityLog({
      id: `${Date.now()}_diary`,
      title: `写了日记 ${finalEntry.title || '今日碎碎念'}`,
      detail: `模板:${finalEntry.style.template}；评论角色:${commentCharacterIds.length > 0 ? commentCharacterIds.join('、') : '无'}`,
      timestamp: Date.now(),
      relatedCharacterIds: commentCharacterIds
    });
    setCurrentEntry(finalEntry);
    setLoadingComments(false);
    setView('history');
  };

  const openEntry = (entry: DiaryEntry) => {
    setCurrentEntry(entry);
    setTitle(entry.title);
    setContent(entry.content);
    setStyle(entry.style);
    setPhotoUrls(entry.photoUrls || []);
    setMusicUrl(entry.musicUrl || '');
    setMusicTitle(entry.musicTitle || '');
    setCommentCharacterIds(entry.commentCharacterIds || []);
    setView('editor');
  };

  if (view === 'history') {
    return (
      <div className="h-full flex flex-col bg-[#fffaf2] text-slate-800">
        <div className="px-4 pt-7 pb-4 flex items-center justify-between border-b border-stone-200">
          <button onClick={closeApp}><ChevronLeft size={28} /></button>
          <div className="font-black">日记本</div>
          <button onClick={() => { resetEditor(); setView('editor'); }} className="text-sm font-bold text-slate-500">写日记</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {diaryEntries.length === 0 ? (
            <div className="text-center text-slate-400 mt-24">还没有写过日记</div>
          ) : diaryEntries.map(entry => (
            <div key={entry.id} className="space-y-3">
              <DiaryCard entry={entry} />
              <div className="flex gap-3 justify-end -mt-1">
                <button onClick={() => openEntry(entry)} className="text-xs font-medium text-slate-500 flex items-center gap-1 hover:text-slate-700">
                  <Pencil size={13} /> 修改
                </button>
                <button onClick={() => { if (confirm('确定删除这篇日记吗？')) deleteDiaryEntry(entry.id); }} className="text-xs font-medium text-stone-400 flex items-center gap-1 hover:text-rose-500">
                  <Trash2 size={13} /> 删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#fffaf2] text-slate-800">
      <div className="px-4 pt-7 pb-4 flex items-center justify-between border-b border-stone-200">
        <button onClick={closeApp}><ChevronLeft size={28} /></button>
        <div className="font-black">日记</div>
        <button onClick={() => setView('history')} className="text-sm font-bold text-slate-500">记录</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-[2rem] bg-white border border-stone-200 p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <NotebookPen size={18} />
            写今天的碎碎念
          </div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="标题可写可不写，比如：今天有点烦 / 很喜欢今天的风"
            className="w-full rounded-2xl border border-stone-200 p-3 bg-[#fffdf9]"
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="把今天那些乱七八糟的小情绪、小事情、小想法都丢进来。"
            className="w-full min-h-[160px] rounded-[1.6rem] border border-stone-200 p-4 bg-[#fffdf9] resize-none leading-7"
          />

          <div className="grid grid-cols-2 gap-3">
            <ImageUploader onImageSelected={(url) => setPhotoUrls(prev => [...prev, url].slice(0, 4))}>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-slate-700 flex items-center justify-center gap-2">
                <Images size={16} /> 加本机照片
              </div>
            </ImageUploader>
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-slate-700 flex items-center justify-center gap-2"
            >
              <Music2 size={16} /> 导入音乐
            </button>
          </div>
          <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioImport} />

          {photoUrls.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {photoUrls.map((url, index) => (
                <div key={`${url}_${index}`} className="relative">
                  <img src={url} alt="" className="h-20 w-full rounded-2xl object-cover border border-stone-200" />
                  <button
                    onClick={() => setPhotoUrls(prev => prev.filter((_, i) => i !== index))}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/65 text-white text-[10px]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {(musicUrl || musicTitle) && (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-bold text-slate-700">{musicTitle || '已附带音乐'}</div>
                <div className="text-xs text-slate-400">这不是必须项，只是会一起保存到这篇日记里</div>
              </div>
              <button onClick={() => { setMusicUrl(''); setMusicTitle(''); }} className="text-xs font-bold text-rose-500">移除</button>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] bg-white border border-stone-200 p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Sparkles size={18} />
            选排版
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATE_OPTIONS.map(option => (
              <button
                key={option.id}
                onClick={() => setStyle(prev => ({ ...prev, template: option.id }))}
                className={`rounded-[1.25rem] border p-3 text-left ${style.template === option.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-stone-200 bg-[#fffdf9] text-slate-700'}`}
              >
                <div className="font-black text-sm">{option.name}</div>
                <div className={`text-xs mt-1 ${style.template === option.id ? 'text-white/75' : 'text-slate-400'}`}>{option.desc}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <select
              value={style.fontFamily}
              onChange={e => setStyle(prev => ({ ...prev, fontFamily: e.target.value }))}
              className="p-3 rounded-2xl border border-stone-200 bg-white"
            >
              {FONT_OPTIONS.map(font => <option key={font.label} value={font.value}>{font.label}</option>)}
            </select>
            <input
              type="number"
              min={12}
              max={30}
              value={style.fontSize}
              onChange={e => setStyle(prev => ({ ...prev, fontSize: Math.min(30, Math.max(12, parseInt(e.target.value) || 17)) }))}
              className="p-3 rounded-2xl border border-stone-200 bg-white"
              placeholder="字号"
            />
          </div>

          <div>
            <div className="text-sm font-bold mb-2">字体颜色</div>
            <div className="flex flex-wrap gap-2">
              {TEXT_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setStyle(prev => ({ ...prev, textColor: color }))}
                  className={`w-8 h-8 rounded-full border-2 ${style.textColor === color ? 'border-slate-900 scale-110' : 'border-white'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-bold mb-2">背景颜色</div>
            <div className="flex flex-wrap gap-2">
              {BACKGROUND_PRESETS.map(color => (
                <button
                  key={color}
                  onClick={() => setStyle(prev => ({ ...prev, backgroundColor: color }))}
                  className={`w-9 h-9 rounded-full border-2 ${style.backgroundColor === color ? 'border-slate-900 scale-110' : 'border-stone-200'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-bold mb-2">背景图</div>
            <ImageUploader onImageSelected={(url) => setStyle(prev => ({ ...prev, background: url }))}>
              <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-slate-600 text-center">
                选择本机图片作为背景
              </div>
            </ImageUploader>
            {style.background && (
              <button onClick={() => setStyle(prev => ({ ...prev, background: '' }))} className="mt-2 text-xs font-bold text-rose-500">
                清除背景图
              </button>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white border border-stone-200 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <MessageCircleHeart size={18} />
            选角色要不要评论
          </div>
          <div className="flex flex-wrap gap-2">
            {availableCharacters.map(char => (
              <button
                key={char.id}
                onClick={() => toggleCommentCharacter(char.id)}
                className={`px-3 py-2 rounded-full text-sm font-bold ${commentCharacterIds.includes(char.id) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {char.name}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-400">
            不选也可以，日记照样保存。选了的话，保存时会顺手给你生成角色评论。
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-bold text-slate-700 px-1">预览</div>
          <DiaryCard entry={draftEntry} previewOnly />
        </div>

        <button
          onClick={handleSave}
          disabled={!content.trim() || loadingComments}
          className="w-full rounded-[1.8rem] bg-slate-900 text-white font-black py-4 disabled:opacity-50"
        >
          {loadingComments ? '正在保存并生成评论...' : currentEntry ? '保存这篇日记' : '写进日记本'}
        </button>
      </div>
    </div>
  );
}
