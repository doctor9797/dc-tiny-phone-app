import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Book, Plus, Settings, PaintBucket, Type, Image as ImageIcon, MessageSquare, Bookmark, List } from 'lucide-react';
import { generateAIResponse, getCharacterReply } from '../../lib/ai';
import { HighlightComment, BookChapter, ChapterReflection, BookBookmark } from '../../types';
import { saveInteractionMemory } from '../../lib/characterMemory';
import ImageUploader from '../ImageUploader';

const normalizeBookText = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/\x00/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const cleanAiText = (text: string) =>
  (text || '')
    .replace(/```markdown|```json|```/g, '')
    .replace(/^[#*\-\s]+/gm, '')
    .replace(/[*#`_]/g, '')
    .trim();

const getReadableHighlightRange = (content: string, baseIndex: number, fallbackLength = 56) => {
  const safeStart = Math.max(0, Math.min(content.length - 1, baseIndex));
  const windowStart = Math.max(0, safeStart - 120);
  const windowEnd = Math.min(content.length, safeStart + 180);
  const segment = content.slice(windowStart, windowEnd);
  const localIndex = safeStart - windowStart;
  const separators = /[。！？!?；;\n]/;

  let left = localIndex;
  while (left > 0 && !separators.test(segment[left - 1])) left -= 1;
  let right = localIndex;
  while (right < segment.length && !separators.test(segment[right])) right += 1;

  const rawSentence = segment.slice(left, right);
  const sentence = rawSentence.trim();
  const compact = sentence.replace(/\s+/g, ' ').trim();
  if (compact.length >= 8) {
    const leadingTrim = rawSentence.length - rawSentence.trimStart().length;
    const trailingTrim = rawSentence.length - rawSentence.trimEnd().length;
    return {
      startIndex: windowStart + left + leadingTrim,
      endIndex: windowStart + right - trailingTrim,
      text: compact
    };
  }

  return {
    startIndex: safeStart,
    endIndex: Math.min(content.length, safeStart + fallbackLength),
    text: content.slice(safeStart, Math.min(content.length, safeStart + fallbackLength)).trim()
  };
};

const extractChapters = (content: string): BookChapter[] => {
  const text = normalizeBookText(content);
  const regex = /(^|\n)\s*((第[一二三四五六七八九十百千0-9]+[章节回卷部篇集].{0,20})|(Chapter\s+\d+.{0,30})|([0-9]+\s*\..{0,30}))\s*(?=\n|$)/gim;
  const matches: Array<{ title: string; start: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const title = (match[2] || '').trim();
    const start = (match.index || 0) + (match[1] ? match[1].length : 0);
    if (title) matches.push({ title, start });
  }

  if (matches.length === 0) {
    const chunkSize = 3500;
    const chapters: BookChapter[] = [];
    for (let start = 0, idx = 0; start < text.length; start += chunkSize, idx += 1) {
      chapters.push({
        id: `chapter_${idx}`,
        title: `第 ${idx + 1} 章`,
        startIndex: start,
        endIndex: Math.min(text.length, start + chunkSize)
      });
    }
    return chapters;
  }

  return matches.map((item, index) => ({
    id: `chapter_${index}`,
    title: item.title,
    startIndex: item.start,
    endIndex: index < matches.length - 1 ? matches[index + 1].start : text.length
  }));
};

const getChapterAtPosition = (chapters: BookChapter[], position: number) =>
  chapters.findIndex(chapter => position >= chapter.startIndex && position < chapter.endIndex);

export default function ReaderApp() {
  const { closeApp, books, createBook, deleteBook, updateBook, characters } = useAppStore();
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  if (activeBookId) {
    return (
      <BookReader
        bookId={activeBookId}
        onBack={() => {
          setActiveBookId(null);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-mahogany">
      <div className="pt-14 pb-3 bg-oak flex items-center px-4 border-b border-dark-border shrink-0">
        <button onClick={closeApp} className="w-8 flex items-center -ml-2 text-brass">
          <ChevronLeft size={28} />
        </button>
        <span className="font-display tracking-[0.15em] text-brass flex-1 text-center truncate text-sm uppercase">阅读书架</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <label className="aspect-[3/4] bg-oak border-2 border-dashed border-brass/40 rounded-xl flex flex-col items-center justify-center text-brass cursor-pointer hover:bg-sepia transition-colors">
            <Plus size={32} className="mb-2" />
            <span className="text-xs font-display tracking-wider text-center px-2 uppercase leading-relaxed">导入书籍<br/>支持 TXT/EPUB</span>
            <input
              type="file"
              accept=".txt,.epub"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                let text = '';

                try {
                  if (file.name.toLowerCase().endsWith('.epub')) {
                    const JSZip = (await import('jszip')).default;
                    const zip = new JSZip();
                    const loaded = await zip.loadAsync(file);
                    for (const filename of Object.keys(loaded.files)) {
                      if (filename.endsWith('.html') || filename.endsWith('.htm') || filename.endsWith('.xhtml')) {
                        const htmlContent = await loaded.file(filename)?.async('string');
                        if (htmlContent) {
                          const cleanText = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                                       .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                                                       .replace(/<[^>]+>/g, '\n')
                                                       .replace(/\n\s+\n/g, '\n\n');
                          text += cleanText + '\n\n';
                        }
                      }
                    }
                  } else {
                    const buffer = await file.arrayBuffer();
                    try {
                      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
                    } catch (e) {
                      text = new TextDecoder('gb18030').decode(buffer);
                    }
                  }
                } catch (err: any) {
                  alert('解析文件失败: ' + err.message);
                  return;
                }

                const normalizedText = normalizeBookText(text);
                const chapters = extractChapters(normalizedText);
                const bookId = 'book_' + Date.now();
                createBook({
                  id: bookId,
                  title: file.name.replace('.txt', ''),
                  content: normalizedText,
                  highlights: [],
                  lastReadPosition: 0,
                  chapters,
                  bookmarks: [],
                  chapterReflections: [],
                  settings: {
                    fontSize: 16,
                    bgColor: '#1C1714',
                    bgImage: '',
                    charId: '',
                    commentFrequency: 'medium',
                    enableChapterSummary: true,
                    enableEndSummary: true
                  }
                });

                e.target.value = '';
              }}
            />
          </label>

          {Object.values(books || {}).map(book => (
            <div
              key={book.id}
              onClick={() => setActiveBookId(book.id)}
              className="aspect-[3/4] bg-oak rounded-xl border border-dark-border flex flex-col cursor-pointer hover:border-brass/50 transition-colors relative group overflow-hidden"
            >
              {book.coverImage ? (
                <div className="w-full h-full overflow-hidden">
                  <img
                    src={book.coverImage}
                    className="w-full h-full object-cover sepia-[60%] saturate-[70%] brightness-[85%] contrast-[110%] group-hover:sepia-0 group-hover:saturate-100 group-hover:brightness-100 group-hover:contrast-100 transition-all duration-500"
                    alt=""
                  />
                </div>
              ) : (
                 <div className="bg-sepia flex-1 flex items-center justify-center p-3 text-center text-sm font-heading text-parchment leading-relaxed">
                   {book.title}
                 </div>
              )}

              <div className="absolute top-1 right-1">
                 <button
                   onClick={(e) => {
                     e.stopPropagation();
                     setDeleteConfirm(book.id);
                   }}
                   className="w-5 h-5 text-parchment/40 hover:text-parchment/80 flex items-center justify-center active:scale-90 transition-all text-sm leading-none"
                 >
                   ×
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {deleteConfirm && (() => {
        const targetBook = books?.[deleteConfirm];
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setDeleteConfirm(null)}
          >
            <div
              className="bg-oak border border-dark-border rounded-xl p-6 mx-4 max-w-xs w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-parchment text-center mb-6 leading-relaxed">
                确定要删除「{targetBook?.title || '这本书'}」吗？
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 rounded-lg border border-dark-border text-parchment/60 text-sm hover:bg-sepia transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    deleteBook(deleteConfirm);
                    setDeleteConfirm(null);
                  }}
                  className="flex-1 py-2 rounded-lg bg-red/10 border border-red/30 text-red/80 text-sm hover:bg-red/20 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function BookReader({ bookId, onBack }: { bookId: string; onBack: () => void }) {
  const { books, updateBook, characters } = useAppStore();
  const book = books?.[bookId];

  const [showSettings, setShowSettings] = useState(false);
  const [showCharSelect, setShowCharSelect] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showReflections, setShowReflections] = useState(false);
  const [showBookmarkForm, setShowBookmarkForm] = useState(false);

  const [selection, setSelection] = useState<{ start: number, end: number, text: string, rect: DOMRect } | null>(null);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [highlightColor, setHighlightColor] = useState('#e0e7ff');
  const [activeHighlight, setActiveHighlight] = useState<HighlightComment | null>(null);
  const [replyText, setReplyText] = useState('');
  const [activeReflection, setActiveReflection] = useState<ChapterReflection | null>(null);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [bookmarkCategory, setBookmarkCategory] = useState('剧情');
  const [bookmarkColor, setBookmarkColor] = useState('#d4a574');

  const contentRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const chapterCommentingRef = useRef(false);

  if (!book) return null;

  const chapters = useMemo(() => book.chapters && book.chapters.length > 0 ? book.chapters : extractChapters(book.content), [book.chapters, book.content]);
  const bookmarks = book.bookmarks || [];
  const chapterReflections = book.chapterReflections || [];
  const finalReflection = useMemo(
    () => [...chapterReflections].reverse().find(item => item.kind === 'final') || null,
    [chapterReflections]
  );
  const currentChapterIndex = getChapterAtPosition(chapters, book.lastReadPosition);
  const currentChapter = currentChapterIndex > -1 ? chapters[currentChapterIndex] : chapters[0];

  const isDarkBg = (hex: string) => {
    const c = hex.replace('#', '');
    if (c.length < 6) return false;
    const r = parseInt(c.substring(0,2), 16);
    const g = parseInt(c.substring(2,4), 16);
    const b = parseInt(c.substring(4,6), 16);
    return r * 0.299 + g * 0.587 + b * 0.114 < 140;
  };
  const contentTextColor = isDarkBg(book.settings.bgColor) ? 'text-parchment' : 'text-mahogany';

  useEffect(() => {
    if (restoredRef.current || !contentRef.current) return;
    const el = contentRef.current;
    requestAnimationFrame(() => {
      if (book.settings.readMode === 'scroll') {
        const top = (book.lastReadPosition / Math.max(1, book.content.length)) * el.scrollHeight;
        el.scrollTop = top;
      } else {
        const left = (book.lastReadPosition / Math.max(1, book.content.length)) * el.scrollWidth;
        el.scrollLeft = left;
      }
      restoredRef.current = true;
    });
  }, [book.id, book.lastReadPosition, book.content.length, book.settings.readMode]);

  useEffect(() => {
    if (!book.chapters || book.chapters.length === 0) {
      updateBook(bookId, { chapters });
    }
  }, [book.chapters, chapters, bookId, updateBook]);

  const getSelectionOffset = (node: Node, offset: number, container: Node) => {
    let currentOffset = 0;
    let found = false;

    const traverse = (currentNode: Node) => {
      if (currentNode === node) {
        currentOffset += offset;
        found = true;
        return;
      }
      if (currentNode.nodeType === Node.TEXT_NODE) {
        currentOffset += currentNode.textContent?.length || 0;
      } else {
        for (let i = 0; i < currentNode.childNodes.length; i++) {
          traverse(currentNode.childNodes[i]);
          if (found) return;
        }
      }
    };
    traverse(container);
    return currentOffset;
  };

  const handleSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current) {
      setTimeout(() => {
        const checkSel = window.getSelection();
        if (!checkSel || checkSel.isCollapsed) {
          if (!showCommentInput) setSelection(null);
        }
      }, 100);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const wrapper = contentRef.current.closest('.h-full');
    const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : { x: 0, y: 0 };
    const relativeRect = {
      x: rect.x - wrapperRect.x,
      y: rect.y - wrapperRect.y,
      width: rect.width,
      height: rect.height,
    };

    const start = getSelectionOffset(range.startContainer, range.startOffset, contentRef.current);
    const end = getSelectionOffset(range.endContainer, range.endOffset, contentRef.current);

    setSelection({
       start,
       end,
       text: sel.toString(),
       rect: relativeRect as DOMRect
    });
  };

  const handleAddComment = async () => {
    if (!selection) return;

    const newHighlight: HighlightComment = {
      id: Date.now().toString(),
      bookId,
      startIndex: selection.start,
      endIndex: selection.end,
      text: selection.text,
      authorId: 'user',
      comment: commentText,
      color: highlightColor,
      timestamp: Date.now(),
      replies: []
    };

    updateBook(bookId, { highlights: [...book.highlights, newHighlight] });
    setSelection(null);
    setShowCommentInput(false);
    setCommentText('');

    // 阅读高亮记忆
    if (book.settings.charId) {
      saveInteractionMemory(book.settings.charId, `看书时标注了「${selection.text.slice(0, 30)}」`, commentText || '', 'observation', 3);
      const store = useAppStore.getState();
      store.addEmotionEvent({ characterId: book.settings.charId, paDelta: 0.1, naDelta: -0.02, word: '专注', valence: 0.4, arousal: 0.3, matchSource: 'free_form', source: 'manual' });
    }

    if (!commentText.trim()) return;

    if (book.settings.charId && book.settings.commentFrequency !== 'low') {
        const char = characters[book.settings.charId];
        if (char) {
           const prompt = `我正在看书。原文是：“${selection.text}”。我的笔记/批注是：“${commentText}”。请你作为${char.name}（关系：${char.relationship}，性格：${char.personality}），在书边给我写一条回复批注。不要太长，要符合你的角色语气。`;
           try {
             const replyText = cleanAiText(await generateAIResponse(prompt));
             const aiReply = { authorId: char.id, comment: replyText, timestamp: Date.now() + 1000 };
             updateBook(bookId, {
                highlights: useAppStore.getState().books[bookId].highlights.map(h =>
                   h.id === newHighlight.id ? { ...h, replies: [...(h.replies||[]), aiReply] } : h
                )
             });
           } catch { }
        }
    }
  };

  const renderContent = () => {
    if (!book.highlights || book.highlights.length === 0) {
      return book.content;
    }
    const sorted = [...book.highlights].sort((a,b) => a.startIndex - b.startIndex);
    let elements = [];
    let lastIdx = 0;

    sorted.forEach((hl, i) => {
       if (hl.startIndex > lastIdx) {
          elements.push(<span key={`text-${i}`}>{book.content.substring(lastIdx, hl.startIndex)}</span>);
       }
       elements.push(
          <span
            key={hl.id}
            className="cursor-pointer hover:opacity-80 transition-opacity border-b-2"
            style={{
               backgroundColor: hl.color || '#e0e7ff',
               borderBottomColor: (hl.color && hl.color !== '#e0e7ff') ? hl.color : '#a5b4fc',
               padding: '0 2px',
               margin: '0 1px',
               borderRadius: '2px'
            }}
            onClick={() => {
              if (hl.comment) {
                setActiveHighlight(hl);
              }
            }}
          >
             {book.content.substring(hl.startIndex, hl.endIndex)}
          </span>
       );
       lastIdx = hl.endIndex;
    });
    if (lastIdx < book.content.length) {
       elements.push(<span key="tail">{book.content.substring(lastIdx)}</span>);
    }
    return elements;
  };

  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const lastProactiveRangeRef = useRef<number>(-1);

  const triggerProactiveComment = (text: string, index: number) => {
    if (!book.settings.charId || book.settings.commentFrequency === 'low') return;
    const char = characters[book.settings.charId];
    if (!char) return;
    const zoneIndex = Math.floor(index / 900);
    if (lastProactiveRangeRef.current === zoneIndex) return;
    const hasNearbyHighlight = (book.highlights || []).some(hl => Math.abs(hl.startIndex - index) < 900);
    if (hasNearbyHighlight) return;

    const chance = book.settings.commentFrequency === 'high' ? 0.72 : 0.38;
    if (Math.random() > chance) return;

    const prompt = `我们正在一起看书《${book.title}》。刚才读到了这段内容：“${text.substring(0, 500)}...”。请你作为${char.name}（性格：${char.personality}），主动发表一句即兴感想。你的话会作为批注显示。不要超过50个字。如果觉得这段没什么好说的，请只回复“无”。`;
    generateAIResponse(prompt).then(res => {
       const cleaned = cleanAiText(res);
       if (cleaned && cleaned !== '无' && !cleaned.includes('NONE')) {
          const range = getReadableHighlightRange(book.content, index);
          const newHighlight: HighlightComment = {
            id: Date.now().toString(),
            bookId,
            startIndex: range.startIndex,
            endIndex: range.endIndex,
            text: range.text,
            authorId: char.id,
            comment: cleaned,
            color: '#fef08a',
            timestamp: Date.now()
          };
          useAppStore.getState().updateBook(bookId, { highlights: [...useAppStore.getState().books[bookId].highlights, newHighlight] });
          lastProactiveRangeRef.current = zoneIndex;
       }
    }).catch(()=>{});
  };

  const jumpToPosition = (position: number) => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    updateBook(bookId, { lastReadPosition: position });
    if (book.settings.readMode === 'scroll') {
      const top = (position / Math.max(1, book.content.length)) * el.scrollHeight;
      el.scrollTo({ top, behavior: 'smooth' });
    } else {
      const left = (position / Math.max(1, book.content.length)) * el.scrollWidth;
      el.scrollTo({ left, behavior: 'smooth' });
    }
  };

  const addBookmark = () => {
    const position = book.lastReadPosition;
    const chapter = chapters[getChapterAtPosition(chapters, position)] || currentChapter;
    const bookmark: BookBookmark = {
      id: `${Date.now()}`,
      label: bookmarkLabel.trim() || chapter?.title || `位置 ${position}`,
      note: bookmarkNote.trim(),
      position,
      chapterTitle: chapter?.title,
      category: bookmarkCategory,
      color: bookmarkColor,
      createdAt: Date.now()
    };
    updateBook(bookId, { bookmarks: [bookmark, ...(book.bookmarks || [])] });
    setShowBookmarkForm(false);
    setBookmarkLabel('');
    setBookmarkNote('');
    setBookmarkCategory('剧情');
    setBookmarkColor('#d4a574');
  };

  const generateChapterReflection = async (chapterIndex: number) => {
    if (!book.settings.charId) return;
    if (chapterIndex < 0 || chapterIndex >= chapters.length) return;
    if (chapterCommentingRef.current) return;
    if ((book.settings.lastChapterCommented ?? -1) >= chapterIndex) return;

    const char = characters[book.settings.charId];
    const chapter = chapters[chapterIndex];
    if (!char || !chapter) return;

    chapterCommentingRef.current = true;
    const chapterText = book.content.slice(chapter.startIndex, Math.min(chapter.endIndex, chapter.startIndex + 1600));
    try {
      const isSingleChapterBook = chapters.length <= 1;
      const isFinalChapter = chapterIndex === chapters.length - 1;
      const shouldGenerateFinal = isSingleChapterBook || isFinalChapter;
      if (!isSingleChapterBook && isFinalChapter && book.settings.enableEndSummary === false) {
        chapterCommentingRef.current = false;
        return;
      }
      if (!shouldGenerateFinal && book.settings.enableChapterSummary === false) {
        chapterCommentingRef.current = false;
        return;
      }

      const res = await generateAIResponse(`${shouldGenerateFinal ? `我们刚刚读完整本《${book.title}》，最后读完的章节是《${chapter.title}》。` : `我们刚读完《${book.title}》中的一章，章节标题是《${chapter.title}》。`}
本章内容摘要片段如下：
${chapterText}

请以${char.name}的阅读立场来写${shouldGenerateFinal ? '读完整本书后的读后感' : '这一章的简短阅读感受'}。
严格要求：
1. ${shouldGenerateFinal ? '必须写成1000字以上的完整读后感长文' : '控制在80字以内'}。
2. 这是一篇"读后感/阅读感想"，不是现场剧情，不是角色扮演对白，不是续写小说。
3. 全文口吻必须统一。优先使用第一人称"我"，如果不用第一人称，就全篇保持客观分析口吻；绝对不允许第一、第二、第三人称乱跳。
4. 禁止出现动作描写和场景描写，例如"我看着你""他看了看我""我笑了""她沉默了"这类内容一律不要。
5. 禁止直接和用户说话，禁止出现"你""我们刚刚""此刻""现在"等互动现场词。
6. 重点写：读完后的感受、对人物/主题/结构/情绪的理解、印象最深的部分、为什么会这样想。
7. 不要Markdown，不要标题，不要分点，不要小标题。
8. 语言要像真正写在书后面的读后感，而不是聊天消息。`);
      const reflection: ChapterReflection = {
        chapterId: chapter.id,
        chapterTitle: shouldGenerateFinal ? `${chapter.title} · 读后感` : chapter.title,
        characterId: char.id,
        text: cleanAiText(res),
        createdAt: Date.now(),
        kind: shouldGenerateFinal ? 'final' : 'chapter'
      };
      updateBook(bookId, {
        chapterReflections: [
          ...(useAppStore.getState().books[bookId].chapterReflections || []).filter(item => !(shouldGenerateFinal && item.kind === 'final')),
          reflection
        ],
        settings: { ...useAppStore.getState().books[bookId].settings, lastChapterCommented: chapterIndex }
      });
      setActiveReflection(reflection);
      // 读后感记忆+情绪
      if (char) {
        saveInteractionMemory(char.id, `为《${book.title}》写了读后感`, reflection.text.slice(0, 60), 'event', 4);
        const rStore = useAppStore.getState();
        rStore.addEmotionEvent({ characterId: char.id, paDelta: 0.2, naDelta: -0.1, word: '感悟', valence: 0.5, arousal: 0.4, matchSource: 'free_form', source: 'manual' });
      }
      if (shouldGenerateFinal) {
        try {
          const sysMsg = `你是${char.name}。性格：${char.personality || '普通'}。和对方的关系：${char.relationship || '朋友'}（对方=${char.userNickname || '你'}，好感度${char.affection ?? 50}/100）。严禁动作描写、神态描写、心理描写。只说你说的话，不加括号、引号、星号。直接以文字开头。`;
          const raw = await generateAIResponse(`我刚读完《${book.title}》。不用给我长文读后感，像微信聊天那样简单说几句你现在的感受就好。`, sysMsg);
          const shortWechat = cleanAiText(raw);
          if (shortWechat) {
            useAppStore.getState().receiveMessage(char.id, shortWechat);
          }
        } catch {}
      }
    } catch {}
    chapterCommentingRef.current = false;
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const ratio = book.settings.readMode === 'scroll'
      ? (el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight))
      : (el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth));
    const approximateIndex = Math.max(0, Math.min(book.content.length - 1, Math.floor(ratio * book.content.length)));
    updateBook(bookId, { lastReadPosition: approximateIndex });

    const isAtEnd = book.settings.readMode === 'scroll'
       ? el.scrollHeight - el.scrollTop <= el.clientHeight + 400
       : el.scrollWidth - el.scrollLeft <= el.clientWidth + 400;

    const chapterIndex = getChapterAtPosition(chapters, approximateIndex);
    if (chapterIndex > 0) {
      const prevChapter = chapters[chapterIndex - 1];
      if (prevChapter && approximateIndex >= prevChapter.endIndex - 80) {
        generateChapterReflection(chapterIndex - 1);
      }
    }

    if (isAtEnd) {
      generateChapterReflection(chapters.length - 1);
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
       const textChunk = book.content.substring(approximateIndex, approximateIndex + 900);
       triggerProactiveComment(textChunk, approximateIndex);
    }, 1200);
  };

  const handlePageTurn = (e: React.MouseEvent) => {
    if (!contentRef.current) return;
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;

    if (book.settings.readMode === 'scroll') {
       if (clientY > innerHeight * 0.7) {
          contentRef.current.scrollBy({ top: innerHeight * 0.8, behavior: 'smooth' });
       } else if (clientY < innerHeight * 0.3) {
          contentRef.current.scrollBy({ top: -innerHeight * 0.8, behavior: 'smooth' });
       }
    } else {
       if (clientX < innerWidth * 0.3) {
          const currentLeft = contentRef.current.scrollLeft;
          const newLeft = Math.round((currentLeft - innerWidth) / innerWidth) * innerWidth;
          contentRef.current.scrollTo({ left: Math.max(0, newLeft), behavior: 'smooth' });
       } else if (clientX > innerWidth * 0.7) {
          const currentLeft = contentRef.current.scrollLeft;
          const newLeft = Math.round((currentLeft + innerWidth) / innerWidth) * innerWidth;
          contentRef.current.scrollTo({ left: newLeft, behavior: 'smooth' });
       }
    }
  };

  return (
    <div className="h-full flex flex-col relative" style={{ backgroundColor: book.settings.bgColor || '#1C1714' }}>
      {/* Background image overlay */}
      {book.settings.bgImage && (
         <div className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none z-[1]" style={{ backgroundImage: `url(${book.settings.bgImage})` }} />
      )}
      {/* Vignette overlay */}
      <div className="absolute inset-0 pointer-events-none z-[2]" style={{ background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%)' }} />
      {/* Paper texture overlay */}
      <div className="absolute inset-0 pointer-events-none z-[3] opacity-[0.04]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat' }} />

      <div className="pt-14 pb-3 bg-oak/95 backdrop-blur-sm flex items-center px-4 shrink-0 relative z-10 border-b border-dark-border">
        <button onClick={onBack} className="w-8 flex items-center -ml-2 text-brass">
          <ChevronLeft size={28} />
        </button>
        <div className="flex-1 text-center truncate px-2">
          <div className="font-heading text-brass truncate text-lg">{book.title}</div>
          <div className="text-[11px] text-muted-gold truncate tracking-wide">{currentChapter?.title || '未分章'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBookmarkForm(true)} className="text-brass"><Bookmark size={18} /></button>
          <button onClick={() => setShowBookmarks(true)} className="text-brass"><Book size={18} /></button>
          <button onClick={() => finalReflection ? setActiveReflection(finalReflection) : setShowReflections(true)} className="text-brass"><MessageSquare size={18} /></button>
          <button onClick={() => setShowChapters(true)} className="text-brass"><List size={18} /></button>
          <button onClick={() => setShowSettings(!showSettings)} className="text-brass">
             <Settings size={22} />
          </button>
        </div>
      </div>

      <div
         className={`flex-1 relative z-10 scroll-smooth no-scrollbar pt-6 pb-12 ${book.settings.readMode === 'scroll' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}`}
         style={{ touchAction: book.settings.readMode === 'scroll' ? 'pan-y' : 'none' }}
         ref={contentRef}
         onPointerUp={(e) => {
            const sel = window.getSelection();
            if(!sel || sel.isCollapsed) handlePageTurn(e as any);
            handleSelection();
         }}
         onTouchEnd={handleSelection}
         onScroll={handleScroll}
      >
         <div
           className={`font-body ${contentTextColor} break-words whitespace-pre-wrap leading-[1.9] tracking-wide`}
           style={
             book.settings.readMode === 'scroll'
             ? {
                 fontSize: book.settings.fontSize,
                 padding: '0 24px',
                 paddingBottom: '40vh'
               }
             : {
                 fontSize: book.settings.fontSize,
                 columnWidth: 'calc(100vw - 48px)',
                 columnGap: '48px',
                 height: '100%',
                 padding: '0 24px',
                 boxSizing: 'border-box'
               }
           }
         >
           {renderContent()}
         </div>
      </div>

      {selection && !showCommentInput && (
        <div
          className="absolute z-40 border border-brass/30 text-parchment px-5 py-2.5 flex items-center gap-2 -translate-x-1/2 animate-fade-in pointer-events-auto bg-oak"
          style={{
             left: selection.rect.x + selection.rect.width / 2,
             top: Math.max(80, selection.rect.y < 120 ? (selection.rect.y + selection.rect.height + 10) : (selection.rect.y - 45))
          }}
        >
          <button onClick={() => setShowCommentInput(true)} className="flex items-center gap-1.5 text-sm font-display tracking-wider active:scale-95 text-brass uppercase">
             <MessageSquare size={16} /> 写笔记
          </button>
        </div>
      )}

      {showCommentInput && (
         <div className="absolute inset-x-0 bottom-0 bg-mahogany border-t border-dark-border z-50 p-6 flex flex-col pt-8 pb-10 shadow-[0_-10px_60px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-6">
              <span className="font-heading text-2xl text-brass">记笔记</span>
              <button onClick={() => { setShowCommentInput(false); setSelection(null); }} className="text-muted-gold font-display text-sm tracking-widest uppercase">取消</button>
            </div>

            <div className="bg-oak p-4 border border-dark-border mb-4">
               <span className="text-sm text-muted-gold line-clamp-3 italic leading-relaxed">"{selection?.text}"</span>
            </div>

            <div className="flex gap-3 mb-4">
               {['#e0e7ff', '#fef08a', '#bbf7d0', '#fbcfe8', '#fed7aa', '#e5e7eb'].map(c => (
                  <button
                    key={c}
                    onClick={() => setHighlightColor(c)}
                    className={`w-8 h-8 rounded-none border-2 ${highlightColor === c ? 'border-brass scale-110' : 'border-dark-border'}`}
                    style={{ backgroundColor: c }}
                  />
               ))}
            </div>

            <textarea
               value={commentText} onChange={e => setCommentText(e.target.value)}
               className="w-full bg-oak border border-dark-border p-4 text-parchment flex-1 min-h-[120px] outline-none focus:border-brass/50 transition-colors placeholder:text-muted-gold leading-relaxed resize-none font-body"
               placeholder="写写你的想法（可选）..." autoFocus
            />
            <button onClick={handleAddComment} className="mt-4 w-full py-4 text-mahogany font-display tracking-wider uppercase active:scale-[0.98] transition-transform" style={{ background: 'linear-gradient(135deg, #C9A962, #A8893E)' }}>
               {commentText.trim() ? '保存笔记' : '仅划线'}
            </button>
         </div>
      )}

      {activeHighlight && (
         <div className="absolute inset-x-0 bottom-0 bg-mahogany border-t border-dark-border z-50 p-6 flex flex-col pt-8 pb-10 max-h-[85vh] overflow-y-auto shadow-[0_-10px_60px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-6">
              <span className="font-heading text-2xl text-brass">读书笔记</span>
              <button onClick={() => setActiveHighlight(null)} className="text-muted-gold font-display text-sm tracking-widest uppercase">关闭</button>
            </div>

            <div className="bg-oak p-4 border-l-2 border-brass/50 mb-6 relative">
               <span className="text-sm text-parchment line-clamp-4 italic leading-relaxed opacity-80">"{activeHighlight.text}"</span>
            </div>

            <div className="space-y-4 mb-8">
               <div className="bg-oak p-4 border border-dark-border relative">
                  <div className="flex items-center gap-2 mb-2">
                     <span className="font-display text-[10px] tracking-wider uppercase text-brass bg-sepia px-2 py-1">{activeHighlight.authorId === 'user' ? '我' : characters[activeHighlight.authorId]?.name}</span>
                  </div>
                  <p className="text-parchment leading-relaxed text-sm font-body opacity-80">{activeHighlight.comment}</p>
               </div>

               {activeHighlight.replies?.map((reply, i) => (
                  <div key={i} className="flex gap-3 ml-2 relative">
                     <div className="w-8 h-8 overflow-hidden shrink-0 border border-dark-border mt-1">
                        {reply.authorId === 'user' ? (
                           <div className="w-full h-full bg-brass text-mahogany flex items-center justify-center text-xs font-display">我</div>
                        ) : (
                           characters[reply.authorId]?.avatar && !characters[reply.authorId].avatar.startsWith('#') ?
                             <img src={characters[reply.authorId].avatar} className="w-full h-full object-cover" /> :
                             <div className="w-full h-full bg-sepia text-brass flex items-center justify-center text-xs font-display">{characters[reply.authorId]?.name?.[0]}</div>
                        )}
                     </div>
                     <div className="bg-oak/80 p-4 border border-dark-border flex-1">
                        <div className="flex items-center gap-2 mb-1">
                           <span className="font-display text-[10px] tracking-wider text-brass">{reply.authorId === 'user' ? '我' : characters[reply.authorId]?.name}</span>
                        </div>
                        <p className="text-parchment text-sm leading-relaxed opacity-80 font-body">{reply.comment}</p>
                     </div>
                  </div>
               ))}
            </div>

            <div className="flex gap-3 mt-auto shrink-0 bg-oak border border-dark-border">
               <input
                 value={replyText} onChange={e=>setReplyText(e.target.value)}
                 className="flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-muted-gold font-body text-parchment"
                 placeholder="继续探讨..."
               />
               <button
                 onClick={async () => {
                    if (!replyText.trim()) return;
                    const newReply = { authorId: 'user', comment: replyText, timestamp: Date.now() };
                    const updatedHl = { ...activeHighlight, replies: [...(activeHighlight.replies||[]), newReply] };
                    updateBook(bookId, { highlights: book.highlights.map(h => h.id === activeHighlight.id ? updatedHl : h) });
                    setActiveHighlight(updatedHl);
                    setReplyText('');
                    if (book.settings.charId && book.settings.commentFrequency !== 'low') {
                        const char = characters[book.settings.charId];
                        if (char) {
                           const prompt = `我回复了你的批注。批注讨论的话题是："${activeHighlight.comment}"。我的最新回复是："${replyText}"。请你作为${char.name}继续回复我，简短一些。`;
                           setTimeout(async () => {
                              try {
                                const aiRep = cleanAiText(await generateAIResponse(prompt));
                                const charReply = { authorId: char.id, comment: aiRep, timestamp: Date.now() };
                                const freshHl = useAppStore.getState().books[bookId].highlights.find(h => h.id === updatedHl.id);
                                if (freshHl) {
                                  const hl2 = { ...freshHl, replies: [...(freshHl.replies||[]), charReply] };
                                  updateBook(bookId, { highlights: useAppStore.getState().books[bookId].highlights.map(h => h.id === freshHl.id ? hl2 : h) });
                                  setActiveHighlight(hl2);
                                }
                              } catch {}
                           }, 500);
                        }
                    }
                 }}
                 className="px-5 py-2 text-sm font-display tracking-wider uppercase active:scale-95 transition-all text-mahogany" style={{ background: 'linear-gradient(135deg, #C9A962, #A8893E)' }}
               >
                 发送
               </button>
            </div>
         </div>
      )}

      {activeReflection && (
        <div className="absolute inset-x-4 top-24 bottom-8 z-40 bg-mahogany border border-dark-border p-6 overflow-hidden shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="font-heading text-xl text-brass tracking-wide">{characters[activeReflection.characterId]?.name} · {activeReflection.kind === 'final' ? '读后感' : '读后小记'}</div>
            <button onClick={() => setActiveReflection(null)} className="text-muted-gold font-display text-xs tracking-widest uppercase">关闭</button>
          </div>
          <div className="text-xs text-muted-gold tracking-wide mb-4 font-body italic">{activeReflection.chapterTitle}</div>
          <div className="ornate-divider" />
          <div className={`text-sm leading-7 text-parchment/85 whitespace-pre-wrap overflow-y-auto h-[calc(100%-7rem)] pr-1 font-body ${activeReflection.kind === 'final' ? 'first-letter:text-5xl first-letter:float-left first-letter:pr-2 first-letter:text-brass first-letter:font-heading first-letter:leading-none' : ''}`}>{activeReflection.text}</div>
        </div>
      )}

      {showChapters && (
        <div className="absolute inset-0 z-50 bg-mahogany">
          <div className="flex items-center justify-between px-4 pt-14 pb-4 border-b border-dark-border">
            <button onClick={() => setShowChapters(false)} className="text-muted-gold font-display text-sm tracking-widest uppercase">关闭</button>
            <div className="font-heading text-xl text-brass">章节目录</div>
            <div className="w-8" />
          </div>
          <div className="overflow-y-auto h-full pb-24">
            {chapters.map((chapter, index) => {
              const reflection = chapterReflections.find(item => item.chapterId === chapter.id);
              return (
                <button
                  key={chapter.id}
                  onClick={() => {
                    jumpToPosition(chapter.startIndex);
                    setShowChapters(false);
                  }}
                  className="w-full text-left px-5 py-4 border-b border-dark-border hover:bg-oak/50 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-display text-brass text-xs tracking-widest">VOL.{String(index + 1).padStart(2, '0')}</span>
                    <div className="font-heading text-lg text-parchment">{chapter.title}</div>
                  </div>
                  {reflection && <div className="text-xs text-muted-gold mt-2 line-clamp-2 italic font-body">{characters[reflection.characterId]?.name}：{reflection.text}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showBookmarks && (
        <div className="absolute inset-0 z-50 bg-mahogany">
          <div className="flex items-center justify-between px-4 pt-14 pb-4 border-b border-dark-border">
            <button onClick={() => setShowBookmarks(false)} className="text-muted-gold font-display text-sm tracking-widest uppercase">关闭</button>
            <div className="font-heading text-xl text-brass">书签</div>
            <div className="w-8" />
          </div>
          <div className="overflow-y-auto h-full pb-24">
            {bookmarks.length === 0 ? (
              <div className="text-center text-muted-gold mt-20 font-body italic">还没有书签</div>
            ) : bookmarks.map(bookmark => (
              <div key={bookmark.id} className="px-5 py-4 border-b border-dark-border hover:bg-oak/30 transition-colors">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => {
                      jumpToPosition(bookmark.position);
                      setShowBookmarks(false);
                    }}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 shrink-0" style={{ backgroundColor: bookmark.color || '#f59e0b' }} />
                      <div className="font-heading text-parchment text-lg">{bookmark.label}</div>
                      {bookmark.category && <span className="text-[10px] px-2 py-0.5 bg-sepia text-muted-gold font-display tracking-wider uppercase">{bookmark.category}</span>}
                    </div>
                    <div className="text-xs text-muted-gold font-body">{bookmark.chapterTitle || '未命名位置'} · {new Date(bookmark.createdAt).toLocaleString()}</div>
                    {bookmark.note && <div className="text-xs text-muted-gold/70 mt-2 italic font-body">{bookmark.note}</div>}
                  </button>
                  <button
                    onClick={() => updateBook(bookId, { bookmarks: bookmarks.filter(item => item.id !== bookmark.id) })}
                    className="text-crimson text-xs px-2 py-1 border border-crimson/30 font-display tracking-wider uppercase"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showReflections && (
        <div className="absolute inset-0 z-50 bg-mahogany">
          <div className="flex items-center justify-between px-4 pt-14 pb-4 border-b border-dark-border">
            <button onClick={() => setShowReflections(false)} className="text-muted-gold font-display text-sm tracking-widest uppercase">关闭</button>
            <div className="font-heading text-xl text-brass">读书感想</div>
            <div className="w-8" />
          </div>
          <div className="overflow-y-auto h-full pb-24">
            {chapterReflections.length === 0 ? (
              <div className="text-center text-muted-gold mt-20 font-body italic">还没有生成感想</div>
            ) : (
              [...chapterReflections].sort((a, b) => b.createdAt - a.createdAt).map(reflection => (
                <button
                  key={`${reflection.chapterId}_${reflection.createdAt}`}
                  onClick={() => {
                    setActiveReflection(reflection);
                    setShowReflections(false);
                  }}
                  className="w-full text-left px-5 py-4 border-b border-dark-border hover:bg-oak/50 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <div className="font-heading text-lg text-parchment">{reflection.kind === 'final' ? '读后感' : '章末总结'}</div>
                    <div className="text-xs text-muted-gold font-body">{characters[reflection.characterId]?.name}</div>
                  </div>
                  <div className="text-xs text-muted-gold mb-2 font-body italic tracking-wide">{reflection.chapterTitle}</div>
                  <div className="text-sm text-parchment/70 line-clamp-3 leading-6 font-body">{reflection.text}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {showBookmarkForm && (
        <div className="absolute inset-x-0 bottom-0 bg-mahogany border-t border-dark-border z-50 p-6 space-y-4 shadow-[0_-10px_60px_rgba(0,0,0,0.5)]">
          <div className="flex justify-between items-center">
            <div className="font-heading text-2xl text-brass">添加书签</div>
            <button onClick={() => setShowBookmarkForm(false)} className="text-muted-gold font-display text-sm tracking-widest uppercase">关闭</button>
          </div>
          <input value={bookmarkLabel} onChange={e => setBookmarkLabel(e.target.value)} placeholder="书签标题" className="w-full p-3 bg-oak border border-dark-border outline-none text-parchment placeholder:text-muted-gold font-body focus:border-brass/50 transition-colors" />
          <input value={bookmarkCategory} onChange={e => setBookmarkCategory(e.target.value)} placeholder="分类，例如：剧情 / 金句 / 设定" className="w-full p-3 bg-oak border border-dark-border outline-none text-parchment placeholder:text-muted-gold font-body focus:border-brass/50 transition-colors" />
          <textarea value={bookmarkNote} onChange={e => setBookmarkNote(e.target.value)} placeholder="备注" className="w-full p-3 bg-oak border border-dark-border outline-none text-parchment placeholder:text-muted-gold font-body min-h-[100px] resize-none focus:border-brass/50 transition-colors" />
          <div className="flex gap-2">
            {['#d4a574', '#a8c5a0', '#b8c5d6', '#d4a0a0', '#c8b8d8', '#d4b8b0'].map(color => (
              <button key={color} onClick={() => setBookmarkColor(color)} className={`w-8 h-8 border-2 ${bookmarkColor === color ? 'border-brass' : 'border-dark-border'}`} style={{ backgroundColor: color }} />
            ))}
          </div>
          <button onClick={addBookmark} className="w-full py-4 text-mahogany font-display tracking-wider uppercase active:scale-[0.98] transition-transform" style={{ background: 'linear-gradient(135deg, #C9A962, #A8893E)' }}>保存书签</button>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-x-0 bottom-0 bg-mahogany border-t border-dark-border z-50 p-6 space-y-6 shadow-[0_-10px_60px_rgba(0,0,0,0.5)]">
           <div className="flex justify-between items-center pb-3 border-b border-dark-border">
              <h3 className="font-heading text-2xl text-brass">阅读设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-muted-gold font-display text-sm tracking-widest uppercase">完成</button>
           </div>

           <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <Type className="text-muted-gold shrink-0" size={20} />
                 <span className="text-sm text-parchment w-16 font-display tracking-wider uppercase">字号</span>
                 <input type="range" min="12" max="32" value={book.settings.fontSize} onChange={e => {
                    updateBook(bookId, { settings: { ...book.settings, fontSize: Number(e.target.value) } })
                 }} className="flex-1 accent-brass" />
                 <span className="font-body text-muted-gold text-xs w-6 text-right">{book.settings.fontSize}</span>
              </div>

              <div className="flex items-center gap-4">
                 <PaintBucket className="text-muted-gold shrink-0" size={20} />
                 <span className="text-sm text-parchment w-16 font-display tracking-wider uppercase">背景</span>
                 <div className="flex-1 flex gap-2">
                    {['#1C1714', '#2A2420', '#3D332B', '#E8DFD4', '#D4C9B8'].map(color => (
                       <button
                         key={color}
                         onClick={() => updateBook(bookId, { settings: { ...book.settings, bgColor: color, bgImage: '' } })}
                         className={`w-8 h-8 border-2 ${book.settings.bgColor === color ? 'border-brass scale-110' : 'border-dark-border'}`}
                         style={{ backgroundColor: color }}
                       />
                    ))}
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-4">
                    <ImageIcon className="text-muted-gold shrink-0" size={20} />
                    <span className="text-sm font-display tracking-wider text-parchment w-16 shrink-0 uppercase">背景图</span>
                    <ImageUploader onImageSelected={(url) => updateBook(bookId, { settings: { ...book.settings, bgImage: url } })} className="cursor-pointer">
                       <div className="px-4 py-1.5 text-sm font-display tracking-wider bg-oak text-muted-gold border border-dark-border active:scale-95 transition-transform pointer-events-none uppercase">上传图片</div>
                    </ImageUploader>
                 </div>

                 <div className="flex items-center gap-4">
                    <ImageIcon className="text-muted-gold shrink-0" size={20} />
                    <span className="text-sm font-display tracking-wider text-parchment w-16 shrink-0 uppercase">封面</span>
                    <ImageUploader onImageSelected={(url) => updateBook(bookId, { coverImage: url })} className="cursor-pointer">
                       <div className="px-4 py-1.5 text-sm font-display tracking-wider bg-oak text-muted-gold border border-dark-border active:scale-95 transition-transform pointer-events-none uppercase">上传图片</div>
                    </ImageUploader>
                 </div>
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t border-dark-border mt-2">
                 <div className="flex justify-between items-center text-sm">
                    <span className="font-display tracking-wider text-parchment uppercase text-[11px]">翻页模式</span>
                    <select
                       value={book.settings.readMode || 'page'}
                       onChange={e => updateBook(bookId, { settings: { ...book.settings, readMode: e.target.value as any } })}
                       className="bg-oak border border-dark-border px-2 py-1 outline-none text-parchment font-body text-sm"
                    >
                       <option value="page">左右翻页</option>
                       <option value="scroll">上下滑动</option>
                    </select>
                 </div>
                 <div className="flex justify-between items-center text-sm pt-2">
                    <div className="flex items-center gap-2">
                      <Book className="text-muted-gold" size={20} />
                      <span className="font-display tracking-wider text-parchment uppercase text-[11px]">共读角色</span>
                    </div>
                    <button onClick={() => setShowCharSelect(true)} className="text-brass text-sm font-display tracking-wider uppercase">
                       {book.settings.charId ? characters[book.settings.charId]?.name : '选择角色'}
                    </button>
                 </div>
                 {book.settings.charId && (
                   <div className="bg-oak border border-dark-border p-4 space-y-3 mt-2">
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-parchment font-body">互动频率</span>
                         <select
                           value={book.settings.commentFrequency}
                           onChange={e => updateBook(bookId, { settings: { ...book.settings, commentFrequency: e.target.value as any } })}
                           className="bg-transparent border-none text-right text-muted-gold outline-none font-body"
                         >
                            <option value="low">低（很少评论）</option>
                            <option value="medium">中（适度互动）</option>
                            <option value="high">高（积极讨论）</option>
                         </select>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-parchment font-body">读完章节进行总结</span>
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" checked={book.settings.enableChapterSummary} onChange={e => updateBook(bookId, { settings: { ...book.settings, enableChapterSummary: e.target.checked } })} className="sr-only peer" />
                           <div className="w-11 h-6 bg-sepia peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-brass rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-dark-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-parchment after:border-dark-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brass"></div>
                         </label>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-parchment font-body">读完整本书写感想</span>
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" checked={book.settings.enableEndSummary} onChange={e => updateBook(bookId, { settings: { ...book.settings, enableEndSummary: e.target.checked } })} className="sr-only peer" />
                           <div className="w-11 h-6 bg-sepia peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-brass rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-dark-border after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-parchment after:border-dark-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brass"></div>
                         </label>
                      </div>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {showCharSelect && (
        <div className="absolute inset-0 bg-mahogany z-50 p-4 flex flex-col pt-safe">
           <div className="flex justify-between items-center pb-4 pt-14 border-b border-dark-border">
             <button onClick={() => setShowCharSelect(false)} className="text-muted-gold font-display text-sm tracking-widest uppercase">取消</button>
             <span className="font-heading text-xl text-brass">选择共读角色</span>
             <div className="w-12"></div>
           </div>
           <div className="flex-1 overflow-y-auto space-y-3 pt-4">
              <div
                className="p-4 bg-oak border border-dark-border flex items-center justify-center font-display tracking-wider text-muted-gold cursor-pointer hover:bg-sepia transition-colors uppercase text-sm"
                onClick={() => { updateBook(bookId, { settings: { ...book.settings, charId: '' }}); setShowCharSelect(false); }}
              >
                 自己静静地看
              </div>
              {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(char => (
                 <div key={char.id} className="flex items-center gap-4 bg-oak p-3 border border-dark-border cursor-pointer hover:border-brass/50 transition-colors" onClick={() => {
                   updateBook(bookId, { settings: { ...book.settings, charId: char.id }});
                   setShowCharSelect(false);
                 }}>
                    <div className="w-12 h-12 overflow-hidden border border-dark-border">
                      {!char.avatar.startsWith('#') && <img src={char.avatar} className="w-full h-full object-cover" />}
                    </div>
                    <span className="font-heading text-lg text-parchment">{char.name}</span>
                 </div>
              ))}
           </div>
        </div>
      )}

    </div>
  );
}
