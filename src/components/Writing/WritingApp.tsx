import React, { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, RefreshCcw, Trash2, MessageSquare } from 'lucide-react';
import { generateAIResponse, getCharacterReply } from '../../lib/ai';
import { WritingArticle } from '../../types';

const STYLE_OPTIONS = ['暧昧拉扯', '锋利冷感', '温柔治愈', '轻喜剧', '偏现实口语', '小说感浓一点', '压抑克制', '青春感', '悬疑感', '群像关系流'];
const BG_OPTIONS = ['现代都市', '校园', '同居日常', '久别重逢', '雨夜街头', '聚会后深夜', '任务搭档', '办公室', '旅行途中', '医院/照护', '末世生存', '豪门拉扯'];
const THEME_OPTIONS = ['表面冷淡实际在意', '吵架后和好', '暗恋没说出口', '重逢后重新靠近', '共同面对麻烦', '长久陪伴', '双向试探', '误会升级', '关系失衡', '救赎', '修罗场', '秘密被发现'];

const getArticleCharacterIds = (article: WritingArticle) => {
  const cfg = article.config as any;
  if (Array.isArray(cfg.characterIds)) return cfg.characterIds;
  if (cfg.characterId) return [cfg.characterId];
  return ['user'];
};

type UnderlineEntry = {
  id: string;
  quote: string;
  comment: string;
  characterId: string;
  characterName: string;
  startIndex: number;
  endIndex: number;
};

type UnderlineBubbleState = {
  id: string;
  top: number;
  left: number;
  maxWidth: number;
};

const normalizeQuote = (text: string) => (text || '').replace(/[，。！？、；：“”"'‘’（）()…—\s]/g, '');

const findQuoteRange = (content: string, quote: string, fromIndex = 0) => {
  const exactIndex = content.indexOf(quote, fromIndex);
  if (exactIndex >= 0) {
    return { startIndex: exactIndex, endIndex: exactIndex + quote.length, text: quote };
  }

  const normalizedQuote = normalizeQuote(quote);
  if (!normalizedQuote) return null;
  const sentences = content.split(/(?<=[。！？!?；;\n])/);
  let cursor = 0;
  for (const sentence of sentences) {
    const startIndex = cursor;
    const endIndex = cursor + sentence.length;
    cursor = endIndex;
    if (endIndex <= fromIndex) continue;
    const normalizedSentence = normalizeQuote(sentence);
    if (normalizedSentence.includes(normalizedQuote) || normalizedQuote.includes(normalizedSentence.slice(0, Math.min(normalizedSentence.length, 12)))) {
      return { startIndex, endIndex, text: sentence.trim() || quote };
    }
  }

  const anchor = quote.slice(0, Math.min(10, quote.length)).trim();
  if (anchor) {
    const anchorIndex = content.indexOf(anchor, fromIndex);
    if (anchorIndex >= 0) {
      const endIndex = Math.min(content.length, anchorIndex + Math.max(quote.length, 22));
      return { startIndex: anchorIndex, endIndex, text: content.slice(anchorIndex, endIndex).trim() };
    }
  }
  return null;
};

const countCjkChars = (text: string) => ((text || '').match(/[\u4e00-\u9fff]/g) || []).length;

const getParagraphIndexAt = (content: string, index: number) => {
  const before = content.slice(0, Math.max(0, index));
  return before.split(/\n{2,}/).length - 1;
};

const getWritingCommentTargetCount = (content: string) => {
  const textLength = (content || '').replace(/\s+/g, '').length;
  return Math.max(1, Math.ceil(textLength / 100));
};

const pickWritingUnderlineTargets = (content: string, count: number) => {
  const cleanContent = (content || '').trim();
  if (!cleanContent) return [];

  const separators = /[。！？!?；;\n]/;
  const picks: Array<{ quote: string; startIndex: number; endIndex: number }> = [];
  const usedRanges: Array<{ startIndex: number; endIndex: number }> = [];

  const normalizeSelection = (startIndex: number, endIndex: number) => {
    let start = Math.max(0, startIndex);
    let end = Math.min(cleanContent.length, endIndex);
    while (start < end && /[\s，。！？、；：“”"'‘’（）()…—]/.test(cleanContent[start])) start += 1;
    while (end > start && /[\s，。！？、；：“”"'‘’（）()…—]/.test(cleanContent[end - 1])) end -= 1;
    const quote = cleanContent.slice(start, end).trim();
    if (countCjkChars(quote) < 5) return null;
    if (quote.length < 8) return null;
    return { quote: quote.slice(0, 32), startIndex: start, endIndex: start + Math.min(32, quote.length) };
  };

  for (let i = 0; i < count; i += 1) {
    const anchor = Math.min(cleanContent.length - 1, Math.floor(((i + 0.5) / count) * cleanContent.length));
    let left = anchor;
    while (left > 0 && !separators.test(cleanContent[left - 1])) left -= 1;
    let right = anchor;
    while (right < cleanContent.length && !separators.test(cleanContent[right])) right += 1;

    let selection = normalizeSelection(left, right);
    if (!selection || selection.quote.length > 32) {
      const aroundStart = Math.max(0, anchor - 12);
      const aroundEnd = Math.min(cleanContent.length, anchor + 18);
      selection = normalizeSelection(aroundStart, aroundEnd);
    }

    if (!selection) continue;
    const overlaps = usedRanges.some(range => !(selection!.endIndex <= range.startIndex || selection!.startIndex >= range.endIndex));
    if (overlaps) continue;
    usedRanges.push({ startIndex: selection.startIndex, endIndex: selection.endIndex });
    picks.push(selection);
  }

  if (picks.length < count) {
    const sentences = cleanContent.split(/(?<=[。！？!?；;\n])/).map(item => item.trim()).filter(item => item.length >= 8);
    let cursor = 0;
    for (const sentence of sentences) {
      if (picks.length >= count) break;
      const startIndex = cleanContent.indexOf(sentence, cursor);
      if (startIndex < 0) continue;
      cursor = startIndex + sentence.length;
      const normalized = normalizeSelection(startIndex, startIndex + sentence.length);
      if (!normalized) continue;
      const overlaps = usedRanges.some(range => !(normalized.endIndex <= range.startIndex || normalized.startIndex >= range.endIndex));
      if (overlaps) continue;
      usedRanges.push({ startIndex: normalized.startIndex, endIndex: normalized.endIndex });
      picks.push(normalized);
    }
  }

  return picks.slice(0, count);
};

const parseUnderlineFeedbacks = (article: WritingArticle | null, characters: Record<string, any>) => {
  if (!article) return [] as UnderlineEntry[];
  const content = article.content || '';
  const usedRanges: Array<{ startIndex: number; endIndex: number }> = [];
  const usedParagraphs = new Set<number>();

  return (article.feedbacks || [])
    .filter(feedback => feedback.mode === 'underline')
    .flatMap(feedback => {
      let preferredCursor = 0;
      return feedback.text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const [rawQuote, rawComment] = line.split(/[｜|]/).map(part => part?.trim());
          const quote = (rawQuote || '').replace(/^["“”'‘’\s]+|["“”'‘’\s]+$/g, '').trim();
          const comment = (rawComment || '').trim();
          if (!quote || !comment) return null;
          if (countCjkChars(quote) < 5) return null;
          if (/^[\s，。！？、；：“”"'‘’（）()…—]+$/.test(quote)) return null;

          const primaryRange = findQuoteRange(content, quote, preferredCursor);
          const fallbackRange = findQuoteRange(content, quote, 0);
          const chosen = [primaryRange, fallbackRange]
            .filter(Boolean)
            .filter(range => (range!.endIndex - range!.startIndex) >= 6)
            .sort((a, b) => {
              const aParagraphPenalty = usedParagraphs.has(getParagraphIndexAt(content, a!.startIndex)) ? 1 : 0;
              const bParagraphPenalty = usedParagraphs.has(getParagraphIndexAt(content, b!.startIndex)) ? 1 : 0;
              const aOverlapPenalty = usedRanges.some(range => !(a!.endIndex <= range.startIndex || a!.startIndex >= range.endIndex)) ? 1 : 0;
              const bOverlapPenalty = usedRanges.some(range => !(b!.endIndex <= range.startIndex || b!.startIndex >= range.endIndex)) ? 1 : 0;
              return (aParagraphPenalty + aOverlapPenalty) - (bParagraphPenalty + bOverlapPenalty);
            })[0];

          if (!chosen) return null;

          preferredCursor = chosen.endIndex + 1;
          usedRanges.push({ startIndex: chosen.startIndex, endIndex: chosen.endIndex });
          usedParagraphs.add(getParagraphIndexAt(content, chosen.startIndex));

          return {
            id: `${feedback.id}_${index}`,
            quote: content.slice(chosen.startIndex, chosen.endIndex),
            comment,
            characterId: feedback.characterId,
            characterName: characters[feedback.characterId]?.name || '角色',
            startIndex: chosen.startIndex,
            endIndex: chosen.endIndex,
          };
        })
        .filter(Boolean) as UnderlineEntry[];
    });
};

export default function WritingApp() {
  const { closeApp, characters, saveWritingArticle, deleteWritingArticle, writingArticles, addActivityLog } = useAppStore();
  const [view, setView] = useState<'editor' | 'history' | 'article'>('editor');
  const [characterIds, setCharacterIds] = useState<(string | 'user')[]>(['user']);
  const [relation, setRelation] = useState('朋友');
  const [background, setBackground] = useState(BG_OPTIONS[0]);
  const [style, setStyle] = useState(STYLE_OPTIONS[0]);
  const [theme, setTheme] = useState(THEME_OPTIONS[0]);
  const [wordCount, setWordCount] = useState(1500);
  const [customBackground, setCustomBackground] = useState('');
  const [customStyle, setCustomStyle] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [currentArticle, setCurrentArticle] = useState<WritingArticle | null>(null);
  const [revisionPrompt, setRevisionPrompt] = useState('');
  const [feedbackCharacterId, setFeedbackCharacterId] = useState('');
  const [feedbackMode, setFeedbackMode] = useState<'underline' | 'review'>('underline');
  const [loading, setLoading] = useState(false);
  const [selectedUnderlineId, setSelectedUnderlineId] = useState<string | null>(null);
  const [underlineBubble, setUnderlineBubble] = useState<UnderlineBubbleState | null>(null);
  const articleCardRef = useRef<HTMLDivElement | null>(null);

  const availableCharacters = useMemo(() => Object.values(characters).filter(char => (char as any).isDisabled !== true), [characters]);
  const characterChips = useMemo(() => [{ id: 'user', name: 'user本人' }, ...availableCharacters.map(char => ({ id: char.id, name: char.name }))], [availableCharacters]);
  const underlineEntries = useMemo(() => parseUnderlineFeedbacks(currentArticle, characters), [currentArticle, characters]);
  const selectedUnderline = useMemo(() => underlineEntries.find(entry => entry.id === selectedUnderlineId) || null, [underlineEntries, selectedUnderlineId]);

  const toggleCharacter = (id: string | 'user') => {
    setCharacterIds(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(item => item !== id);
        return next.length > 0 ? next : ['user'];
      }
      return [...prev, id];
    });
  };

  const generateArticle = async (extraInstruction = '') => {
    setLoading(true);
    const finalBackground = customBackground.trim() || background;
    const finalStyle = customStyle.trim() || style;
    const finalTheme = customTheme.trim() || theme;
    const selectedNames = characterIds.map(id => id === 'user' ? 'user本人' : characters[id]?.name || '某角色');
    try {
      const prompt = `请根据以下设定写一篇中文文章。
出场角色：${selectedNames.join('、')}
这些角色都必须真实参与剧情，不允许只挂名。
角色关系：${relation}
剧情背景：${finalBackground}
写作风格：${finalStyle}
剧情主题：${finalTheme}
目标字数：${wordCount}
额外修改指令：${extraInstruction || '无'}
要求：
1. 人物互动要明显，不能只有一个角色独角戏
2. 如果我选了多个角色，至少让他们都出现有效互动
3. 正文自然，不要Markdown，不要标题装饰符，不要分点
4. 输出完整正文`;
      const content = (await generateAIResponse(prompt)).replace(/[#*]/g, '').trim();
      const article: WritingArticle = {
        id: currentArticle?.id || `${Date.now()}`,
        title: `${finalTheme} · ${selectedNames.join(' / ')}`,
        content,
        createdAt: currentArticle?.createdAt || Date.now(),
        updatedAt: Date.now(),
        revisionPrompt: extraInstruction || currentArticle?.revisionPrompt,
        config: {
          characterIds,
          relation,
          background: finalBackground,
          style: finalStyle,
          theme: finalTheme,
          wordCount
        },
        feedbacks: currentArticle?.feedbacks || []
      };
      setCurrentArticle(article);
      setSelectedUnderlineId(null);
      setUnderlineBubble(null);
      saveWritingArticle(article);
      setView('article');
      addActivityLog({
        id: `${Date.now()}_writing`,
        title: `写作 ${article.title}`,
        detail: `角色:${selectedNames.join('、')}；关系:${relation}；背景:${finalBackground}`,
        timestamp: Date.now(),
        relatedCharacterIds: characterIds.filter(id => id !== 'user') as string[]
      });
    } finally {
      setLoading(false);
    }
  };

  const inviteFeedback = async () => {
    if (!currentArticle || !feedbackCharacterId) return;
    setLoading(true);
    const char = characters[feedbackCharacterId];
    try {
      const feedbackCount = getWritingCommentTargetCount(currentArticle.content);
      let text = '';
      if (feedbackMode === 'underline') {
        const targets = pickWritingUnderlineTargets(currentArticle.content, feedbackCount);
        const prompt = `你是${char.name}，性格${char.personality}，与你和我的关系是${char.relationship}。下面是文章中已经选好的${targets.length}段原文，请你分别写成像书页边上的画线批注。
要求：
1. 按原顺序输出，必须正好${targets.length}行，一行对应一段。
2. 每行格式必须是“编号｜批注”，例如“1｜这里太疼了”。
3. 只写批注，不要复述原文，不要额外解释。
4. 批注要像真会写在书页边上的评论，短、准、带角色态度。
5. 禁止动作描写，禁止括号动作，禁止“他笑了”“我愣住了”这种表演感描述。
6. 不要Markdown。

原文片段：
${targets.map((item, index) => `${index + 1}. ${item.quote}`).join('\n')}`;
        const rawText = (await generateAIResponse(prompt)).replace(/[#*]/g, '').trim();
        const parsedComments = rawText
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const match = line.match(/^\s*(\d+)\s*[｜|]\s*(.+)$/);
            return match ? { index: Number(match[1]) - 1, comment: match[2].trim() } : null;
          })
          .filter(Boolean) as Array<{ index: number; comment: string }>;
        const fallbackComments = ['这里太扎心了。', '这一句真会留痕。', '看到这里会停一下。', '这句有后劲。', '这里一下就立住了。'];
        text = targets.map((item, index) => {
          const matched = parsedComments.find(comment => comment.index === index);
          const comment = matched?.comment || fallbackComments[index % fallbackComments.length];
          return `${item.quote}｜${comment}`;
        }).join('\n');
      } else {
        const prompt = `你是${char.name}，性格${char.personality}，与你和我的关系是${char.relationship}。请读完下面文章后写一段像真实写在书页边上的短评。
要求：
1. 不超过120字。
2. 禁止动作描写、括号描写、舞台说明。
3. 要像这个角色本人留下的书页批注，不要像正式读后感作文。
4. 不要Markdown。
文章：${currentArticle.content.slice(0, 2600)}`;
        text = (await generateAIResponse(prompt)).replace(/[#*]/g, '').trim();
      }
      const next = {
        ...currentArticle,
        feedbacks: [
          ...(currentArticle.feedbacks || []),
          { id: `${Date.now()}`, characterId: feedbackCharacterId, mode: feedbackMode, text, createdAt: Date.now() }
        ]
      };
      setCurrentArticle(next);
      saveWritingArticle(next);
      addActivityLog({
        id: `${Date.now()}_writing_feedback`,
        title: `邀请${char.name}看文章`,
        detail: `${char.name}刚刚看了《${currentArticle.title}》并留下了${feedbackMode === 'underline' ? '画线批注' : '短评'}`,
        timestamp: Date.now(),
        relatedCharacterIds: [feedbackCharacterId]
      });
      try {
        const shortWechat = (await getCharacterReply(
          feedbackCharacterId,
          `我刚邀请你评论我写的《${currentArticle.title}》了。你已经给出了${feedbackMode === 'underline' ? '画线评论' : '短评'}，现在只用2到4条很短的微信消息，像真人一样和我说几句你看完后的感觉。不要发长文，不要分点。`
        )).trim();
        if (shortWechat) {
          useAppStore.getState().receiveMessage(feedbackCharacterId, shortWechat);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  if (view === 'history') {
    return (
      <div className="h-full flex flex-col bg-[#faf7f2] text-slate-800">
        <div className="px-4 pt-12 pb-4 flex items-center justify-between border-b">
          <button onClick={() => setView('editor')}><ChevronLeft size={28} /></button>
          <div className="font-black">写作记录</div>
          <div className="w-7" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {writingArticles.length === 0 ? (
            <div className="text-center text-slate-400 mt-20">还没有写作记录</div>
          ) : writingArticles.map(article => (
            <div key={article.id} className="rounded-3xl bg-white border border-stone-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-black mb-1">{article.title}</div>
                  <div className="text-xs text-slate-400 mb-2">{new Date(article.updatedAt).toLocaleString()}</div>
                  <div className="text-sm text-slate-600 line-clamp-4 whitespace-pre-wrap">{article.content}</div>
                </div>
                <button onClick={() => { if (confirm('确定删除这篇写作记录吗？')) deleteWritingArticle(article.id); }} className="text-rose-500"><Trash2 size={18} /></button>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setCurrentArticle(article);
                    setCharacterIds(getArticleCharacterIds(article));
                    setRelation(article.config.relation);
                    setBackground(article.config.background);
                    setStyle(article.config.style);
                    setTheme(article.config.theme);
                    setWordCount(article.config.wordCount);
                    setSelectedUnderlineId(null);
                    setUnderlineBubble(null);
                    setView('article');
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold"
                >
                  打开
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'article' && currentArticle) {
    const articleNodes: React.ReactNode[] = [];
    let cursor = 0;
    const sortedEntries = [...underlineEntries].sort((a, b) => {
      return a.startIndex - b.startIndex;
    });

    sortedEntries.forEach(entry => {
      const startIndex = entry.startIndex;
      const endIndex = entry.endIndex;
      if (startIndex < cursor) return;
      if (startIndex > cursor) {
        articleNodes.push(<span key={`text_${cursor}`}>{currentArticle.content.slice(cursor, startIndex)}</span>);
      }
      articleNodes.push(
        <button
          key={entry.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedUnderlineId(entry.id);
            const targetRect = event.currentTarget.getBoundingClientRect();
            const bubbleWidth = Math.min(240, Math.max(188, window.innerWidth * 0.42));
            const preferRight = targetRect.left < window.innerWidth * 0.58;
            const desiredLeft = preferRight
              ? Math.min(window.innerWidth - bubbleWidth - 12, targetRect.right + 10)
              : Math.max(12, targetRect.left - bubbleWidth - 10);
            const desiredTop = Math.min(
              window.innerHeight - 120,
              Math.max(88, targetRect.top + targetRect.height / 2 - 44)
            );
            setUnderlineBubble({
              id: entry.id,
              top: desiredTop,
              left: desiredLeft,
              maxWidth: bubbleWidth
            });
          }}
          className={`inline rounded-sm px-0.5 text-left decoration-2 underline underline-offset-[0.22em] ${selectedUnderlineId === entry.id ? 'bg-amber-200/65 decoration-amber-600' : 'bg-amber-100/65 decoration-amber-500'}`}
        >
          {currentArticle.content.slice(startIndex, endIndex)}
        </button>
      );
      cursor = endIndex;
    });

    if (cursor < currentArticle.content.length) {
      articleNodes.push(<span key={`text_tail`}>{currentArticle.content.slice(cursor)}</span>);
    }

    const reviewFeedbacks = (currentArticle.feedbacks || []).filter(feedback => feedback.mode === 'review');

    return (
      <div className="h-full flex flex-col bg-[#faf7f2] text-slate-800">
        <div className="px-4 pt-12 pb-4 flex items-center justify-between border-b">
          <button onClick={() => setView('history')}><ChevronLeft size={28} /></button>
          <div className="font-black">文章</div>
          <button onClick={() => setView('editor')} className="text-sm font-bold text-slate-500">设定</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div
            ref={articleCardRef}
            className="rounded-3xl bg-white border border-stone-200 p-5 relative"
            onClick={() => {
              setSelectedUnderlineId(null);
              setUnderlineBubble(null);
            }}
          >
            <div className="font-black text-xl mb-3">{currentArticle.title}</div>
            <div className="text-sm text-slate-700 leading-8 whitespace-pre-wrap relative">
              {articleNodes.length > 0 ? articleNodes : currentArticle.content}
            </div>
            {selectedUnderline && underlineBubble?.id === selectedUnderline.id && (
              <div
                className="fixed z-[80] max-h-40 overflow-y-auto rounded-2xl border border-stone-200 bg-[#fffaf3]/98 backdrop-blur px-3 py-3 shadow-xl text-left"
                style={{ top: underlineBubble.top, left: underlineBubble.left, width: underlineBubble.maxWidth }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="text-[11px] font-bold text-amber-700 mb-1">{selectedUnderline.characterName} 的批注</div>
                <div className="text-xs text-slate-700 leading-6">{selectedUnderline.comment}</div>
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white border border-stone-200 p-4 space-y-3">
            <div className="font-bold">根据指令二次生成</div>
            <div className="flex gap-2">
              <input value={revisionPrompt} onChange={e => setRevisionPrompt(e.target.value)} placeholder="例如：更疯一点、更暧昧一点、结尾别那么轻" className="flex-1 p-3 rounded-2xl border border-stone-200" />
              <button onClick={() => generateArticle(revisionPrompt)} disabled={loading || !revisionPrompt.trim()} className="px-4 rounded-2xl bg-slate-900 text-white font-bold disabled:opacity-50">
                <RefreshCcw size={16} />
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-stone-200 p-4 space-y-3">
            <div className="font-bold">邀请角色来看</div>
            <div className="grid grid-cols-2 gap-2">
              <select value={feedbackCharacterId} onChange={e => setFeedbackCharacterId(e.target.value)} className="p-3 rounded-2xl border border-stone-200 bg-white">
                <option value="">选择角色</option>
                {availableCharacters.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
              </select>
              <select value={feedbackMode} onChange={e => setFeedbackMode(e.target.value as any)} className="p-3 rounded-2xl border border-stone-200 bg-white">
                <option value="underline">画线评论</option>
                <option value="review">观后短评</option>
              </select>
            </div>
            <button onClick={inviteFeedback} disabled={loading || !feedbackCharacterId} className="w-full py-3 rounded-2xl bg-amber-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              <MessageSquare size={18} /> 生成角色评论
            </button>
            {reviewFeedbacks.map(feedback => (
              <div key={feedback.id} className="rounded-2xl bg-stone-50 p-3 border border-stone-200">
                <div className="text-sm font-bold mb-1">{characters[feedback.characterId]?.name} · 页边短评</div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap leading-6">{feedback.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#faf7f2] text-slate-800">
      <div className="px-4 pt-12 pb-4 flex items-center justify-between border-b">
        <button onClick={closeApp}><ChevronLeft size={28} /></button>
        <div className="font-black">写作</div>
        <button onClick={() => setView('history')} className="text-sm font-bold text-slate-500">记录</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-3xl bg-white border border-stone-200 p-4 space-y-4">
          <div>
            <div className="font-bold mb-2">选择角色，可单选可多选</div>
            <div className="flex flex-wrap gap-2">
              {characterChips.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleCharacter(item.id as any)}
                  className={`px-3 py-2 rounded-full text-sm font-bold ${characterIds.includes(item.id as any) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <input value={relation} onChange={e => setRelation(e.target.value)} placeholder="关系，可自定义，例如：暧昧对象、前任、同事、室友、搭档" className="w-full p-3 rounded-2xl border border-stone-200" />
          <div className="grid grid-cols-2 gap-3">
            <select value={background} onChange={e => setBackground(e.target.value)} className="p-3 rounded-2xl border border-stone-200 bg-white">
              {BG_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <input value={customBackground} onChange={e => setCustomBackground(e.target.value)} placeholder="自定义背景" className="p-3 rounded-2xl border border-stone-200" />
            <select value={style} onChange={e => setStyle(e.target.value)} className="p-3 rounded-2xl border border-stone-200 bg-white">
              {STYLE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <input value={customStyle} onChange={e => setCustomStyle(e.target.value)} placeholder="自定义文风" className="p-3 rounded-2xl border border-stone-200" />
            <select value={theme} onChange={e => setTheme(e.target.value)} className="p-3 rounded-2xl border border-stone-200 bg-white">
              {THEME_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <input value={customTheme} onChange={e => setCustomTheme(e.target.value)} placeholder="自定义剧情主题" className="p-3 rounded-2xl border border-stone-200" />
          </div>
          <input type="number" value={wordCount} onChange={e => setWordCount(parseInt(e.target.value) || 1500)} placeholder="字数" className="w-full p-3 rounded-2xl border border-stone-200" />
          <button onClick={() => generateArticle()} disabled={loading} className="w-full p-3 rounded-2xl bg-slate-900 text-white font-bold disabled:opacity-50">
            {currentArticle ? '重新生成文章' : '生成文章'}
          </button>
        </div>

        {currentArticle && (
          <>
            <div className="rounded-3xl bg-white border border-stone-200 p-5">
              <div className="font-black text-xl mb-3">{currentArticle.title}</div>
              <div className="text-sm text-slate-700 leading-7 whitespace-pre-wrap">{currentArticle.content}</div>
            </div>

            <div className="rounded-3xl bg-white border border-stone-200 p-4 space-y-3">
              <div className="font-bold">根据指令二次生成</div>
              <div className="flex gap-2">
                <input value={revisionPrompt} onChange={e => setRevisionPrompt(e.target.value)} placeholder="例如：更疯一点、更暧昧一点、结尾别那么轻" className="flex-1 p-3 rounded-2xl border border-stone-200" />
                <button onClick={() => generateArticle(revisionPrompt)} disabled={loading || !revisionPrompt.trim()} className="px-4 rounded-2xl bg-slate-900 text-white font-bold disabled:opacity-50">
                  <RefreshCcw size={16} />
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-white border border-stone-200 p-4 space-y-3">
              <div className="font-bold">邀请角色来看</div>
              <div className="grid grid-cols-2 gap-2">
                <select value={feedbackCharacterId} onChange={e => setFeedbackCharacterId(e.target.value)} className="p-3 rounded-2xl border border-stone-200 bg-white">
                  <option value="">选择角色</option>
                  {availableCharacters.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
                </select>
                <select value={feedbackMode} onChange={e => setFeedbackMode(e.target.value as any)} className="p-3 rounded-2xl border border-stone-200 bg-white">
                  <option value="underline">画线评论</option>
                  <option value="review">观后感</option>
                </select>
              </div>
              <button onClick={inviteFeedback} disabled={loading || !feedbackCharacterId} className="w-full py-3 rounded-2xl bg-amber-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                <MessageSquare size={18} /> 生成角色评论
              </button>
              {(currentArticle.feedbacks || []).map(feedback => (
                <div key={feedback.id} className="rounded-2xl bg-stone-50 p-3 border border-stone-200">
                  <div className="text-sm font-bold mb-1">{characters[feedback.characterId]?.name} · {feedback.mode === 'underline' ? '画线评论' : '观后感'}</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-6">{feedback.text}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
