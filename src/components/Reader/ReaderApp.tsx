import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Book, Plus, Settings, PaintBucket, Type, Image as ImageIcon, MessageSquare, Bookmark, List } from 'lucide-react';
import { generateAIResponse, getCharacterReply } from '../../lib/ai';
import { HighlightComment, BookChapter, ChapterReflection, BookBookmark } from '../../types';
import ImageUploader from '../ImageUploader';

const normalizeBookText = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
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

  const sentence = segment.slice(left, right).trim();
  const compact = sentence.replace(/\s+/g, ' ').trim();
  if (compact.length >= 8) {
    const startOffset = sentence.indexOf(compact);
    return {
      startIndex: windowStart + left + Math.max(0, startOffset),
      endIndex: windowStart + left + Math.max(0, startOffset) + compact.length,
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
    <div className="h-full flex flex-col bg-stone-50 text-stone-800">
      <div className="pt-14 pb-3 bg-white flex items-center px-4 border-b shrink-0">
        <button onClick={closeApp} className="w-8 flex items-center -ml-2 text-stone-600">
          <ChevronLeft size={28} />
        </button>
        <span className="font-bold flex-1 text-center truncate">阅读书架</span>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <label className="aspect-[3/4] bg-stone-100 rounded-lg border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-400 cursor-pointer hover:bg-stone-200 transition-colors">
            <Plus size={32} className="mb-2" />
            <span className="text-xs font-bold text-center px-2">导入书籍<br/>支持 TXT/EPUB</span>
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
                          // Very basic html to text extraction
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
                    bgColor: '#fdf6e3',
                    bgImage: '',
                    charId: '',
                    commentFrequency: 'medium', // 'low' | 'medium' | 'high'
                    enableChapterSummary: true,
                    enableEndSummary: true
                  }
                });
                
                // Clear the input so same file can be uploaded again if needed
                e.target.value = '';
              }}
            />
          </label>
          
          {Object.values(books || {}).map(book => (
            <div 
              key={book.id} 
              onClick={() => setActiveBookId(book.id)}
              className="aspect-[3/4] bg-white rounded-lg shadow-sm border border-stone-200 flex flex-col cursor-pointer hover:shadow-md transition-shadow relative group overflow-hidden"
            >
              {book.coverImage ? (
                 <img src={book.coverImage} className="w-full h-full object-cover" alt="" />
              ) : (
                 <div className="bg-amber-50/80 flex-1 flex items-center justify-center p-3 text-center text-sm font-black text-stone-700 whitespace-pre-wrap break-words overflow-hidden">
                   {book.title}
                 </div>
              )}
              
              <div className="absolute top-2 right-2 opacity-100">
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     if(confirm('删除这本书？')) deleteBook(book.id);
                   }}
                   className="w-8 h-8 bg-rose-500/90 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                 >
                   ×
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>
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
  const [highlightColor, setHighlightColor] = useState('#e0e7ff'); // default indigo-100
  const [activeHighlight, setActiveHighlight] = useState<HighlightComment | null>(null);
  const [replyText, setReplyText] = useState('');
  const [activeReflection, setActiveReflection] = useState<ChapterReflection | null>(null);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [bookmarkCategory, setBookmarkCategory] = useState('剧情');
  const [bookmarkColor, setBookmarkColor] = useState('#f59e0b');

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
    
    // Convert to relative to root wrapper
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
      comment: commentText, // can be empty for just highlight
      color: highlightColor,
      timestamp: Date.now(),
      replies: []
    };
    
    updateBook(bookId, { highlights: [...book.highlights, newHighlight] });
    setSelection(null);
    setShowCommentInput(false);
    setCommentText('');

    if (!commentText.trim()) return;

    // Trigger AI response to the comment?
    if (book.settings.charId && book.settings.commentFrequency !== 'low') {
        const char = characters[book.settings.charId];
        if (char) {
           const prompt = `我正在看书。原文是：“${selection.text}”。我的笔记/批注是：“${commentText}”。请你作为${char.name}（关系：${char.relationship}，性格：${char.personality}），在书边给我写一条回复批注。不要太长，要符合你的角色语气。`;
           try {
             const replyText = cleanAiText(await generateAIResponse(prompt));
             const aiReply = { authorId: char.id, comment: replyText, timestamp: Date.now() + 1000 };
             // need to inject reply
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

    // Don't trigger too often. We use a probability depending on settings.
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
    setBookmarkColor('#f59e0b');
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
2. 这是一篇“读后感/阅读感想”，不是现场剧情，不是角色扮演对白，不是续写小说。
3. 全文口吻必须统一。优先使用第一人称“我”，如果不用第一人称，就全篇保持客观分析口吻；绝对不允许第一、第二、第三人称乱跳。
4. 禁止出现动作描写和场景描写，例如“我看着你”“他看了看我”“我笑了”“她沉默了”这类内容一律不要。
5. 禁止直接和用户说话，禁止出现“你”“我们刚刚”“此刻”“现在”等互动现场词。
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
      if (shouldGenerateFinal) {
        try {
          const shortWechat = cleanAiText(await getCharacterReply(char.id, `我刚读完《${book.title}》。不用给我长文读后感，只要像微信里那样，用2到4条短消息，简单和我说几句你现在的感受。`));
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
    <div className="h-full flex flex-col relative" style={{ backgroundColor: book.settings.bgColor }}>
      {book.settings.bgImage && (
         <div className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none" style={{ backgroundImage: `url(${book.settings.bgImage})` }} />
      )}
      
      <div className="pt-14 pb-3 bg-black/5 backdrop-blur flex items-center px-4 shrink-0 relative z-10 transition-colors">
        <button onClick={onBack} className="w-8 flex items-center -ml-2 text-stone-800">
          <ChevronLeft size={28} />
        </button>
        <div className="flex-1 text-center truncate px-2">
          <div className="font-bold truncate opacity-70">{book.title}</div>
          <div className="text-[11px] opacity-45 truncate">{currentChapter?.title || '未分章'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBookmarkForm(true)} className="text-stone-700"><Bookmark size={18} /></button>
          <button onClick={() => setShowBookmarks(true)} className="text-stone-700"><Book size={18} /></button>
          <button onClick={() => finalReflection ? setActiveReflection(finalReflection) : setShowReflections(true)} className="text-stone-700"><MessageSquare size={18} /></button>
          <button onClick={() => setShowChapters(true)} className="text-stone-700"><List size={18} /></button>
          <button onClick={() => setShowSettings(!showSettings)} className="text-stone-800">
             <Settings size={22} />
          </button>
        </div>
      </div>

      <div 
         className={`flex-1 relative z-10 scroll-smooth no-scrollbar pt-4 pb-12 ${book.settings.readMode === 'scroll' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}`}
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
           className="text-stone-800 break-words whitespace-pre-wrap leading-[1.8] tracking-wide" 
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
          className="absolute z-40 border border-stone-100 text-stone-800 px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2 -translate-x-1/2 animate-fade-in pointer-events-auto"
          style={{ 
             left: selection.rect.x + selection.rect.width / 2, 
             top: Math.max(80, selection.rect.y < 120 ? (selection.rect.y + selection.rect.height + 10) : (selection.rect.y - 45)),
             backgroundColor: book.settings.bgColor || '#fdf6e3'
          }}
        >
          <button onClick={() => setShowCommentInput(true)} className="flex items-center gap-1.5 text-sm font-bold active:scale-95 text-indigo-500">
             <MessageSquare size={16} /> 写笔记
          </button>
        </div>
      )}

      {showCommentInput && (
         <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-xl border-t border-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 p-6 flex flex-col pt-8 pb-10 animate-slide-up rounded-t-[2rem]">
            <div className="flex justify-between items-center mb-6">
              <span className="font-black text-lg text-slate-800">记笔记</span>
              <button onClick={() => { setShowCommentInput(false); setSelection(null); }} className="text-slate-400 font-bold bg-slate-100 px-4 py-1.5 rounded-full text-sm">取消</button>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-100">
               <span className="text-sm text-slate-500 line-clamp-3 italic leading-relaxed">"{selection?.text}"</span>
            </div>
            
            <div className="flex gap-3 mb-4">
               {['#e0e7ff', '#fef08a', '#bbf7d0', '#fbcfe8', '#fed7aa', '#e5e7eb'].map(c => (
                  <button 
                    key={c}
                    onClick={() => setHighlightColor(c)}
                    className={`w-8 h-8 rounded-full border-2 ${highlightColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
               ))}
            </div>

            <textarea 
               value={commentText} onChange={e => setCommentText(e.target.value)}
               className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-slate-700 flex-1 min-h-[120px] outline-none shadow-sm focus:border-indigo-300 transition-colors placeholder:text-slate-300 leading-relaxed"
               placeholder="写写你的想法（可选）..." autoFocus
            />
            <button onClick={handleAddComment} className="mt-4 py-4 bg-slate-800 text-white font-bold rounded-2xl active:scale-95 transition-transform shadow-lg shadow-slate-800/20">
               {commentText.trim() ? '保存笔记' : '仅划线'}
            </button>
         </div>
      )}

      {activeHighlight && (
         <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-xl border-t border-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 p-6 flex flex-col pt-8 pb-10 animate-slide-up max-h-[85vh] overflow-y-auto rounded-t-[2rem]">
            <div className="flex justify-between items-center mb-6">
              <span className="font-black text-lg text-slate-800">读书笔记</span>
              <button onClick={() => setActiveHighlight(null)} className="text-slate-400 font-bold bg-slate-100 px-4 py-1.5 rounded-full text-sm">关闭</button>
            </div>
            
            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50 mb-6 relative">
               <div className="absolute -left-[1px] top-4 bottom-4 w-1 bg-amber-300 rounded-r-full"></div>
               <span className="text-sm text-slate-600 line-clamp-4 italic leading-relaxed">"{activeHighlight.text}"</span>
            </div>
            
            <div className="space-y-4 mb-8">
               <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 relative">
                  <div className="flex items-center gap-2 mb-2">
                     <span className="font-bold text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{activeHighlight.authorId === 'user' ? '我' : characters[activeHighlight.authorId]?.name}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-sm font-medium">{activeHighlight.comment}</p>
               </div>
               
               {activeHighlight.replies?.map((reply, i) => (
                  <div key={i} className="flex gap-3 ml-2 relative">
                     <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-200 mt-1 shadow-sm">
                        {reply.authorId === 'user' ? (
                           <div className="w-full h-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">我</div>
                        ) : (
                           characters[reply.authorId]?.avatar && !characters[reply.authorId].avatar.startsWith('#') ? 
                             <img src={characters[reply.authorId].avatar} className="w-full h-full object-cover" /> : 
                             <div className="w-full h-full bg-indigo-100 text-indigo-500 flex items-center justify-center text-xs font-bold">{characters[reply.authorId]?.name?.[0]}</div>
                        )}
                     </div>
                     <div className="bg-slate-50/80 backdrop-blur rounded-2xl rounded-tl-sm p-4 border border-slate-100 shadow-sm flex-1">
                        <div className="flex items-center gap-2 mb-1">
                           <span className="font-bold text-xs text-indigo-600">{reply.authorId === 'user' ? '我' : characters[reply.authorId]?.name}</span>
                        </div>
                        <p className="text-slate-700 text-sm leading-relaxed">{reply.comment}</p>
                     </div>
                  </div>
               ))}
            </div>

            <div className="flex gap-3 mt-auto shrink-0 bg-white p-2 border border-slate-100 rounded-full shadow-sm">
               <input 
                 value={replyText} onChange={e=>setReplyText(e.target.value)}
                 className="flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-slate-300 font-medium"
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
                           const prompt = `我回复了你的批注。批注讨论的话题是：“${activeHighlight.comment}”。我的最新回复是：“${replyText}”。请你作为${char.name}继续回复我，简短一些。`;
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
                 className="bg-indigo-500 text-white rounded-full px-5 py-2 text-sm font-bold active:scale-95 shadow-md shadow-indigo-500/20 transition-all"
               >
                 发送
               </button>
            </div>
         </div>
      )}

      {activeReflection && (
        <div className="absolute inset-x-4 top-24 bottom-8 z-40 bg-white/95 backdrop-blur-xl rounded-[1.5rem] shadow-2xl border border-stone-200 p-5 animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold text-stone-800">{characters[activeReflection.characterId]?.name} {activeReflection.kind === 'final' ? '读后感' : '读完这章的感受'}</div>
            <button onClick={() => setActiveReflection(null)} className="text-stone-400 text-sm">关闭</button>
          </div>
          <div className="text-xs text-stone-400 mb-2">{activeReflection.chapterTitle}</div>
          <div className="text-sm leading-7 text-stone-700 whitespace-pre-wrap overflow-y-auto h-[calc(100%-3.5rem)] pr-1">{activeReflection.text}</div>
        </div>
      )}

      {showChapters && (
        <div className="absolute inset-0 z-50 bg-white">
          <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b">
            <button onClick={() => setShowChapters(false)} className="text-stone-500">关闭</button>
            <div className="font-bold">章节目录</div>
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
                  className="w-full text-left px-5 py-4 border-b border-stone-100"
                >
                  <div className="font-bold text-stone-800 mb-1">{chapter.title}</div>
                  <div className="text-xs text-stone-400">第 {index + 1} 章</div>
                  {reflection && <div className="text-xs text-indigo-500 mt-2 line-clamp-2">{characters[reflection.characterId]?.name}：{reflection.text}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showBookmarks && (
        <div className="absolute inset-0 z-50 bg-white">
          <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b">
            <button onClick={() => setShowBookmarks(false)} className="text-stone-500">关闭</button>
            <div className="font-bold">书签</div>
            <div className="w-8" />
          </div>
          <div className="overflow-y-auto h-full pb-24">
            {bookmarks.length === 0 ? (
              <div className="text-center text-stone-400 mt-20">还没有书签</div>
            ) : bookmarks.map(bookmark => (
              <div key={bookmark.id} className="px-5 py-4 border-b border-stone-100">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => {
                      jumpToPosition(bookmark.position);
                      setShowBookmarks(false);
                    }}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bookmark.color || '#f59e0b' }} />
                      <div className="font-bold text-stone-800">{bookmark.label}</div>
                      {bookmark.category && <span className="text-[10px] px-2 py-1 rounded-full bg-stone-100 text-stone-500">{bookmark.category}</span>}
                    </div>
                    <div className="text-xs text-stone-400">{bookmark.chapterTitle || '未命名位置'} · {new Date(bookmark.createdAt).toLocaleString()}</div>
                    {bookmark.note && <div className="text-xs text-stone-500 mt-2">{bookmark.note}</div>}
                  </button>
                  <button
                    onClick={() => updateBook(bookId, { bookmarks: bookmarks.filter(item => item.id !== bookmark.id) })}
                    className="text-rose-500 text-xs px-2 py-1 rounded-full bg-rose-50"
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
        <div className="absolute inset-0 z-50 bg-white">
          <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b">
            <button onClick={() => setShowReflections(false)} className="text-stone-500">关闭</button>
            <div className="font-bold">读书感想</div>
            <div className="w-8" />
          </div>
          <div className="overflow-y-auto h-full pb-24">
            {chapterReflections.length === 0 ? (
              <div className="text-center text-stone-400 mt-20">还没有生成感想</div>
            ) : (
              [...chapterReflections].sort((a, b) => b.createdAt - a.createdAt).map(reflection => (
                <button
                  key={`${reflection.chapterId}_${reflection.createdAt}`}
                  onClick={() => {
                    setActiveReflection(reflection);
                    setShowReflections(false);
                  }}
                  className="w-full text-left px-5 py-4 border-b border-stone-100"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-bold text-stone-800">{reflection.kind === 'final' ? '读后感' : '章末总结'}</div>
                    <div className="text-xs text-stone-400">{characters[reflection.characterId]?.name}</div>
                  </div>
                  <div className="text-xs text-stone-400 mb-2">{reflection.chapterTitle}</div>
                  <div className="text-sm text-stone-600 line-clamp-3 leading-6">{reflection.text}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {showBookmarkForm && (
        <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-50 p-6 space-y-4 animate-slide-up pb-10">
          <div className="flex justify-between items-center">
            <div className="font-bold text-lg">添加书签</div>
            <button onClick={() => setShowBookmarkForm(false)} className="text-stone-400">关闭</button>
          </div>
          <input value={bookmarkLabel} onChange={e => setBookmarkLabel(e.target.value)} placeholder="书签标题" className="w-full p-3 rounded-2xl border border-stone-200 outline-none" />
          <input value={bookmarkCategory} onChange={e => setBookmarkCategory(e.target.value)} placeholder="分类，例如：剧情 / 金句 / 设定" className="w-full p-3 rounded-2xl border border-stone-200 outline-none" />
          <textarea value={bookmarkNote} onChange={e => setBookmarkNote(e.target.value)} placeholder="备注" className="w-full p-3 rounded-2xl border border-stone-200 outline-none min-h-[100px] resize-none" />
          <div className="flex gap-2">
            {['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#a855f7', '#ec4899'].map(color => (
              <button key={color} onClick={() => setBookmarkColor(color)} className={`w-8 h-8 rounded-full border-2 ${bookmarkColor === color ? 'border-stone-800' : 'border-transparent'}`} style={{ backgroundColor: color }} />
            ))}
          </div>
          <button onClick={addBookmark} className="w-full py-4 bg-stone-800 text-white rounded-2xl font-bold">保存书签</button>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-50 p-6 space-y-6 animate-slide-up pb-10">
           <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-lg">阅读设置</h3>
              <button onClick={() => setShowSettings(false)}>完成</button>
           </div>
           
           <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <Type className="text-stone-400" size={20} />
                 <span className="text-sm w-16">字号</span>
                 <input type="range" min="12" max="32" value={book.settings.fontSize} onChange={e => {
                    updateBook(bookId, { settings: { ...book.settings, fontSize: Number(e.target.value) } })
                 }} className="flex-1" />
              </div>
              
              <div className="flex items-center gap-4">
                 <PaintBucket className="text-stone-400" size={20} />
                 <span className="text-sm w-16">背景色</span>
                 <div className="flex-1 flex gap-2">
                    {['#fdf6e3', '#f0f3f5', '#e9e7e2', '#cce8cf', '#1a1a1a'].map(color => (
                       <button 
                         key={color} 
                         onClick={() => updateBook(bookId, { settings: { ...book.settings, bgColor: color, bgImage: '' } })}
                         className={`w-8 h-8 rounded-full border-2 ${book.settings.bgColor === color ? 'border-blue-500 scale-110' : 'border-black/10'}`} 
                         style={{ backgroundColor: color }} 
                       />
                    ))}
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-4">
                    <ImageIcon className="text-stone-400 shrink-0" size={20} />
                    <span className="text-sm font-bold text-stone-700 w-16 shrink-0">背景图</span>
                    <ImageUploader onImageSelected={(url) => updateBook(bookId, { settings: { ...book.settings, bgImage: url } })} className="cursor-pointer">
                       <div className="px-4 py-1.5 text-sm font-bold bg-stone-100 text-stone-700 rounded-lg active:scale-95 transition-transform border border-stone-200 pointer-events-none">上传本机图片</div>
                    </ImageUploader>
                 </div>
                 
                 <div className="flex items-center gap-4">
                    <ImageIcon className="text-stone-400 shrink-0" size={20} />
                    <span className="text-sm font-bold text-stone-700 w-16 shrink-0">书籍封面</span>
                    <ImageUploader onImageSelected={(url) => updateBook(bookId, { coverImage: url })} className="cursor-pointer">
                       <div className="px-4 py-1.5 text-sm font-bold bg-stone-100 text-stone-700 rounded-lg active:scale-95 transition-transform border border-stone-200 pointer-events-none">上传本机图片</div>
                    </ImageUploader>
                 </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t mt-2">
                 <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-stone-700">翻页模式</span>
                    <select 
                       value={book.settings.readMode || 'page'} 
                       onChange={e => updateBook(bookId, { settings: { ...book.settings, readMode: e.target.value as any } })}
                       className="bg-stone-100 rounded px-2 py-1 outline-none text-stone-700 font-bold border border-stone-200"
                    >
                       <option value="page">左右翻页</option>
                       <option value="scroll">上下滑动</option>
                    </select>
                 </div>
                 <div className="flex justify-between items-center text-sm pt-2">
                    <div className="flex items-center gap-2">
                      <Book className="text-stone-400" size={20} />
                      <span className="font-bold">一起看书的角色</span>
                    </div>
                    <button onClick={() => setShowCharSelect(true)} className="text-blue-500 text-sm font-bold">
                       {book.settings.charId ? characters[book.settings.charId]?.name : '选择角色'}
                    </button>
                 </div>
                 {book.settings.charId && (
                   <div className="bg-stone-50 rounded-xl p-3 space-y-3 mt-2">
                      <div className="flex justify-between items-center text-sm">
                         <span>互动频率</span>
                         <select 
                           value={book.settings.commentFrequency} 
                           onChange={e => updateBook(bookId, { settings: { ...book.settings, commentFrequency: e.target.value as any } })}
                           className="bg-transparent border-none text-right font-medium text-stone-600 outline-none"
                         >
                            <option value="low">低 (很少评论)</option>
                            <option value="medium">中 (适度互动)</option>
                            <option value="high">高 (积极讨论)</option>
                         </select>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span>读完章节进行总结</span>
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" checked={book.settings.enableChapterSummary} onChange={e => updateBook(bookId, { settings: { ...book.settings, enableChapterSummary: e.target.checked } })} className="sr-only peer" />
                           <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                         </label>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                         <span>读完整本书写信</span>
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" checked={book.settings.enableEndSummary} onChange={e => updateBook(bookId, { settings: { ...book.settings, enableEndSummary: e.target.checked } })} className="sr-only peer" />
                           <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                         </label>
                      </div>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {showCharSelect && (
        <div className="absolute inset-0 bg-white z-50 p-4 flex flex-col pt-safe">
           <div className="flex justify-between items-center pb-4 pt-10 border-b">
             <button onClick={() => setShowCharSelect(false)} className="text-stone-500 font-bold px-2 py-1">取消</button>
             <span className="font-bold text-lg">选择共读角色</span>
             <div className="w-12"></div>
           </div>
           <div className="flex-1 overflow-y-auto space-y-3 pt-4">
              <div 
                className="p-4 bg-stone-50 rounded-xl flex items-center justify-center font-bold text-stone-500 cursor-pointer"
                onClick={() => { updateBook(bookId, { settings: { ...book.settings, charId: '' }}); setShowCharSelect(false); }}
              >
                 自己静静地看
              </div>
              {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(char => (
                 <div key={char.id} className="flex items-center gap-4 bg-stone-50 p-3 rounded-xl cursor-pointer hover:bg-stone-100" onClick={() => {
                   updateBook(bookId, { settings: { ...book.settings, charId: char.id }});
                   setShowCharSelect(false);
                 }}>
                    <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm">
                      {!char.avatar.startsWith('#') && <img src={char.avatar} className="w-full h-full object-cover" />}
                    </div>
                    <span className="font-bold">{char.name}</span>
                 </div>
              ))}
           </div>
        </div>
      )}

    </div>
  );
}
