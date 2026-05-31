import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronUp } from 'lucide-react';
import { getPhotoCategories, type PhonePhoto } from './data';

interface Props {
  photos: PhonePhoto[];
  loading: boolean;
  onHome: () => void;
}

const PAGE_SIZE = 9;

export default function PhotosApp({ photos, loading, onHome }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [waiting, setWaiting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categories = getPhotoCategories(photos);

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
    setWaiting(false);
  }, [activeCategory]);

  const filteredPhotos = activeCategory && activeCategory !== '所有照片'
    ? photos.filter(p => p.category === activeCategory)
    : photos;

  const sortedPhotos = [...filteredPhotos].sort((a, b) => b.timestamp - a.timestamp);
  const visiblePhotos = sortedPhotos.slice(0, displayCount);
  const hasMore = displayCount < filteredPhotos.length;

  // Detect scroll near bottom → show prompt + start 5s timer
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !hasMore) return;

    if (el.scrollHeight <= el.clientHeight + 2) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (remaining < 150 && !waiting) {
      setWaiting(true);
    } else if (remaining >= 200 && waiting) {
      setWaiting(false);
    }
  };

  // 5-second timer: when waiting is true, auto-load after 5s
  useEffect(() => {
    if (!waiting || !hasMore) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      loadMore();
      setWaiting(false);
    }, 5000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [waiting, hasMore]);

  const loadMore = () => {
    setDisplayCount(prev => Math.min(prev + PAGE_SIZE, filteredPhotos.length));
  };

  if (loading) {
    return (
      <div className="w-full h-full bg-white flex flex-col items-center justify-center">
        <div className="text-gray-400 text-sm">加载中...</div>
      </div>
    );
  }

  // Album grid
  if (!activeCategory) {
    return (
      <div className="w-full h-full bg-white flex flex-col text-black">
        <div className="flex items-center justify-between px-4 pt-7 pb-4 shrink-0">
          <h1 className="text-3xl font-bold">相册</h1>
          <button onClick={onHome} className="text-blue-500 text-[15px] font-medium">返回</button>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setActiveCategory('所有照片')} className="text-left">
              <div className="w-full aspect-[4/3] rounded-2xl mb-2 overflow-hidden relative flex items-end p-4"
                style={{ background: 'linear-gradient(145deg, #667eea 0%, #764ba2 100%)' }}
              >
                <div className="absolute inset-0 opacity-20">
                  <div className="grid grid-cols-2 grid-rows-2 h-full">
                    {sortedPhotos.slice(0, 4).map(p => (
                      <div key={p.id} style={{ backgroundColor: p.palette }} />
                    ))}
                  </div>
                </div>
                <span className="text-white text-4xl drop-shadow-lg relative">📷</span>
              </div>
              <h3 className="font-semibold text-[16px]">所有照片</h3>
              <p className="text-gray-400 text-xs">{photos.length} 张</p>
            </button>

            {categories.map(cat => (
              <button key={cat.name} onClick={() => setActiveCategory(cat.name)} className="text-left group">
                <div className="w-full aspect-[4/3] rounded-2xl mb-2 overflow-hidden relative flex items-end p-4 transition-transform group-active:scale-95"
                  style={{
                    background: cat.palettes.length > 1
                      ? 'linear-gradient(135deg, ' + cat.palettes[0] + ' 0%, ' + cat.palettes[Math.min(1, cat.palettes.length - 1)] + ' 100%)'
                      : cat.palettes[0]
                  }}
                />
                <h3 className="font-semibold text-[16px]">{cat.name}</h3>
                <p className="text-gray-400 text-xs">{cat.count} 张</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Photo grid view
  return (
    <div className="w-full h-full bg-white flex flex-col text-black">
      <div className="flex items-center px-2 shrink-0 min-h-[52px] pt-7 pb-1 border-b border-gray-100">
        <button onClick={() => setActiveCategory(null)} className="flex items-center text-blue-500">
          <ChevronLeft size={28} className="-ml-2" />
          <span className="text-[17px]">{activeCategory}</span>
        </button>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {visiblePhotos.length === 0 && (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">暂无照片</div>
        )}
        <div className="p-2 grid grid-cols-2 gap-2">
          {visiblePhotos.map(photo => (
            <div key={photo.id}>
              <PhotoGridItem photo={photo} />
            </div>
          ))}
        </div>

        {/* Bottom loading prompt */}
        {hasMore ? (
          <div className="px-4 pb-8 pt-4 flex justify-center">
            {waiting ? (
              <button
                onClick={() => { loadMore(); setWaiting(false); }}
                className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-full px-6 py-3 text-sm text-gray-600 transition-colors"
              >
                <ChevronUp size={16} />
                停留 5 秒自动加载更多
                <span className="text-xs text-gray-400">点击立即加载</span>
              </button>
            ) : (
              <span className="text-xs text-gray-300">↓ 继续下滑加载更多照片</span>
            )}
          </div>
        ) : (
          <div className="px-4 pb-8 pt-4 flex justify-center">
            <span className="text-xs text-gray-300">已加载全部照片</span>
          </div>
        )}
      </div>
    </div>
  );
}

const PASTEL_BG = [
  '#fce4ec', '#f3e5f5', '#e8eaf6', '#e0f2f1', '#fff3e0',
  '#fbe9e7', '#f1f8e9', '#e1f5fe', '#fff8e1', '#fce4ec',
  '#f3e5f5', '#e8eaf6', '#e0f2f1', '#fbe9e7', '#f1f8e9',
];

function PhotoGridItem({ photo }: { photo: PhonePhoto }) {
  const [expanded, setExpanded] = useState(false);
  const bgIndex = photo.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % PASTEL_BG.length;

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="aspect-square flex flex-col items-stretch justify-end p-2 cursor-pointer overflow-hidden hover:shadow-md transition-all rounded-xl"
      style={{ backgroundColor: PASTEL_BG[bgIndex] }}
    >
      <p className={'text-gray-600 text-[11px] leading-tight ' + (expanded ? '' : 'line-clamp-3')}>
        {photo.description}
      </p>
      {expanded && (
        <p className="text-gray-400 text-[9px] mt-1">
          {new Date(photo.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}
