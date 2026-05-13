import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { MessageCircle, Music, Settings, Moon, MessageSquare, Book, Wine, Scroll, BookOpen, Hourglass, Calendar, Sparkles, ReceiptText, Newspaper, PenSquare, PawPrint, Bot, NotebookPen, Mail, MessagesSquare, Heart, Film, Brain } from 'lucide-react';
import { AppFolder, AppName } from '../types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  pointerWithin,
  rectIntersection,
  useDraggable
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useDroppable } from '@dnd-kit/core';
import DesktopWidgets, { DESKTOP_PAGE_SIZE, DESKTOP_ROWS, getWidgetSpan, resolveWidgetSlotIndex } from './DesktopWidgets';

const getItemId = (item: AppName | AppFolder | null) => typeof item === 'string' ? item : item?.id;

const collectApps = (item: AppName | AppFolder | null): AppName[] => {
  if (!item) return [];
  if (typeof item === 'string') return [item];
  return item.apps.filter(Boolean);
};

const normalizeAppOrder = (items: (AppName | AppFolder | null)[]) => {
  const seen = new Set<AppName>();
  const normalized: (AppName | AppFolder | null)[] = [];

  for (const item of items) {
    if (item === null) {
      normalized.push(null);
      continue;
    }

    if (typeof item === 'string') {
      if (!seen.has(item)) {
        seen.add(item);
        normalized.push(item);
      } else {
        normalized.push(null);
      }
      continue;
    }

    const uniqueApps = item.apps.filter((appId): appId is AppName => {
      if (!appId || seen.has(appId)) return false;
      seen.add(appId);
      return true;
    });

    if (uniqueApps.length === 1) {
      normalized.push(uniqueApps[0]);
      continue;
    }

    if (uniqueApps.length > 1) {
      normalized.push({
        ...item,
        apps: uniqueApps
      });
    } else {
      normalized.push(null);
    }
  }

  return normalized;
};

const collapseEmptyDesktopPages = (items: (AppName | AppFolder | null)[]) => {
  const pages: (AppName | AppFolder | null)[][] = [];
  for (let i = 0; i < items.length; i += DESKTOP_PAGE_SIZE) {
    pages.push(items.slice(i, i + DESKTOP_PAGE_SIZE));
  }

  const compacted = pages
    .filter((page, pageIndex) => {
      const hasContent = page.some(item => item !== null && item !== undefined);
      return hasContent || pageIndex === 0;
    })
    .flat();

  let lastFilledIndex = -1;
  compacted.forEach((item, index) => {
    if (item !== null && item !== undefined) lastFilledIndex = index;
  });

  const trimmed = lastFilledIndex >= 0 ? compacted.slice(0, lastFilledIndex + 1) : [];
  return trimmed;
};

const repairSparseDesktopItems = (items: (AppName | AppFolder | null)[]) => {
  const meaningfulItems = items.filter((item): item is AppName | AppFolder => item !== null);
  const currentPages = Math.max(1, Math.ceil(items.length / DESKTOP_PAGE_SIZE));
  const minimumPages = Math.max(1, Math.ceil(meaningfulItems.length / DESKTOP_PAGE_SIZE));

  if (currentPages > minimumPages + 1) {
    return meaningfulItems;
  }

  return items;
};

const buildDesktopItems = (
  savedOrder: (AppName | AppFolder | null)[],
  allApps: AppName[],
  dockApps: AppName[] = []
) => {
  const dockSet = new Set(dockApps.filter(Boolean));
  const cleanedSaved = (savedOrder || []).map((item) => {
    if (typeof item === 'string') {
      return dockSet.has(item) ? null : item;
    }

    if (item && typeof item === 'object') {
      const apps = item.apps.filter((appId): appId is AppName => Boolean(appId) && !dockSet.has(appId));
      if (apps.length === 0) return null;
      if (apps.length === 1) return apps[0];
      return { ...item, apps };
    }

    return null;
  });

  const knownAppIds = new Set(cleanedSaved.flatMap(item => collectApps(item)).filter(Boolean));
  const missingApps = allApps.filter(app => app && !dockSet.has(app) && !knownAppIds.has(app));
  const base = collapseEmptyDesktopPages(
    repairSparseDesktopItems(
      normalizeAppOrder(cleanedSaved.length > 0 ? [...cleanedSaved, ...missingApps] : missingApps)
    )
  );
  const remainder = base.length % DESKTOP_PAGE_SIZE;
  return remainder === 0 ? base : [...base, ...Array.from({ length: DESKTOP_PAGE_SIZE - remainder }, () => null)];
};

const removeAppFromDesktopItems = (sourceItems: (AppName | AppFolder | null)[], appId: AppName) => {
  const nextItems = [...sourceItems];
  const appIndex = nextItems.findIndex(item => item === appId);

  if (appIndex > -1) {
    nextItems[appIndex] = null;
    return nextItems;
  }

  const folderIndex = nextItems.findIndex(item => typeof item === 'object' && item?.apps.includes(appId));
  if (folderIndex === -1) return nextItems;

  const folder = nextItems[folderIndex] as AppFolder;
  const nextApps = folder.apps.filter(id => id !== appId);
  if (nextApps.length === 0) {
    nextItems[folderIndex] = null;
  } else if (nextApps.length === 1) {
    nextItems[folderIndex] = nextApps[0];
  } else {
    nextItems[folderIndex] = { ...folder, apps: nextApps };
  }

  return nextItems;
};

const insertAppIntoDesktopItems = (sourceItems: (AppName | AppFolder | null)[], appId: AppName) => {
  if (!appId) return sourceItems;
  const nextItems = [...sourceItems];
  const existingIndex = nextItems.findIndex(item => item === appId || (typeof item === 'object' && item?.apps.includes(appId)));
  if (existingIndex > -1) return nextItems;

  const emptyIndex = nextItems.findIndex(item => item === null);
  if (emptyIndex > -1) {
    nextItems[emptyIndex] = appId;
  } else {
    nextItems.push(appId);
  }

  return nextItems;
};

const insertDesktopItemAtIndex = (
  sourceItems: (AppName | AppFolder | null)[],
  itemToInsert: AppName | AppFolder,
  targetIndex: number
) => {
  const nextItems = [...sourceItems].map(item => (getItemId(item) === getItemId(itemToInsert) ? null : item));
  while (nextItems.length <= targetIndex) nextItems.push(null);

  if (nextItems[targetIndex] === null) {
    nextItems[targetIndex] = itemToInsert;
  } else {
    nextItems.splice(targetIndex, 0, itemToInsert);
  }

  return nextItems;
};

const findFirstEmptySlotInPage = (
  sourceItems: (AppName | AppFolder | null)[],
  targetPage: number
) => {
  const pageStart = targetPage * DESKTOP_PAGE_SIZE;
  const pageEnd = pageStart + DESKTOP_PAGE_SIZE;
  for (let index = pageStart; index < pageEnd; index += 1) {
    if (sourceItems[index] == null) return index;
  }
  return -1;
};

function PageDropZone({ pageIndex, children }: { pageIndex: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `page_${pageIndex}`
  });

  return (
    <div ref={setNodeRef} className={`w-full h-full ${isOver ? 'ring-2 ring-white/40 rounded-[2rem]' : ''}`}>
      {children}
    </div>
  );
}

function SlotDropZone({ slotId, slotIndex }: { key?: React.Key; slotId: string; slotIndex: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });
  const columnStart = (slotIndex % 4) + 1;
  const rowStart = Math.floor(slotIndex / 4) + 1;
  return (
    <div
      ref={setNodeRef}
      style={{ gridColumn: `${columnStart} / span 1`, gridRow: `${rowStart} / span 1` }}
      className={`w-full h-full rounded-2xl transition-all ${isOver ? 'bg-white/10' : 'bg-transparent'}`}
    />
  );
}

function DockDropZone({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'dock_zone' });

  return (
    <div
      ref={setNodeRef}
      className={`relative mx-auto flex min-h-[4.4rem] w-[calc(100%-0.6rem)] max-w-none items-center justify-center overflow-visible rounded-[1.6rem] border px-3 py-2 backdrop-blur-2xl shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${
        isOver
          ? 'border-white/65 bg-white/35'
          : 'border-white/30 bg-white/16'
      }`}
    >
      <div className="pointer-events-none absolute inset-[1px] rounded-[1.5rem] border border-white/20" />
      {isEmpty ? (
        <div className="h-8" />
      ) : (
        <div className="relative z-10 w-full">{children}</div>
      )}
    </div>
  );
}

function DockAppItem({
  appId,
  app,
  customIcon,
  label,
  themedColor,
  onClick,
}: {
  key?: React.Key;
  appId: AppName;
  app: { name: string; icon: React.ReactNode; color: string };
  customIcon?: string;
  label: string;
  themedColor?: string | null;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `dock_${appId}` });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`relative flex shrink-0 flex-col items-center justify-start cursor-pointer select-none touch-manipulation ${isDragging ? 'opacity-60' : ''}`}
      style={{
        transform: CSS.Translate.toString(transform),
        width: '4.35rem',
      }}
      title={label}
    >
      <div
        className={`w-16 h-16 rounded-2xl shadow-lg overflow-hidden flex items-center justify-center ${!customIcon ? (themedColor || app.color) : ''}`}
        style={customIcon ? { background: `url(${customIcon}) center/cover` } : {}}
      >
        {!customIcon && app.icon}
      </div>
    </div>
  );
}

function SortableAppItem(props: { key?: React.Key, id: string, app: any, customIcon?: string, onClick: () => void, slotIndex: number }) {
  const { id, app, customIcon, onClick, slotIndex } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const { setNodeRef: setMergeRef, isOver: isMergeOver } = useDroppable({
    id: `merge_${id}`,
    disabled: isDragging,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : 20,
    gridColumn: `${(slotIndex % 4) + 1} / span 1`,
    gridRow: `${Math.floor(slotIndex / 4) + 1} / span 1`,
  };

  const { settings } = useAppStore();
  const isLightBackground = settings.osTheme && ['white', 'cyan', 'pink', 'green', 'purple', 'gray'].includes(settings.osTheme) && settings.wallpaper === '#1e293b';

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`flex flex-col items-center gap-2 cursor-pointer select-none touch-manipulation relative ${isDragging ? 'opacity-50 scale-105' : ''}`}
      onClick={onClick}
    >
      <div ref={setMergeRef} className="absolute inset-0 top-1/4 bottom-1/4 left-1/4 right-1/4 z-10 pointer-events-none" />
      <div 
        className={`w-16 h-16 min-w-[4rem] min-h-[4rem] max-w-[4rem] max-h-[4rem] aspect-square shrink-0 rounded-2xl flex items-center justify-center shadow-lg ${!customIcon ? app.color : ''} overflow-hidden pointer-events-none transition-all ${isDragging ? 'ring-2 ring-white/40 shadow-xl scale-105' : ''} ${isMergeOver ? 'ring-2 ring-white/70 shadow-xl scale-105' : ''}`}
        style={customIcon ? { background: `url(${customIcon}) center/cover` } : {}}
      >
        {!customIcon && app.icon}
      </div>
      <span className={`${isLightBackground ? 'text-slate-800 drop-shadow-none' : 'text-white drop-shadow-md'} text-xs font-medium pointer-events-none`}>{app.name}</span>
    </div>
  );
}

function SortableFolderItem(props: { key?: React.Key, id: string, folder: AppFolder, defaultApps: any, onClick: () => void, backgroundClass: string, slotIndex: number }) {
  const { id, folder, defaultApps, onClick, backgroundClass, slotIndex } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const { setNodeRef: setMergeRef, isOver: isMergeOver } = useDroppable({
    id: `merge_${id}`,
    disabled: isDragging,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : 20,
    gridColumn: `${(slotIndex % 4) + 1} / span 1`,
    gridRow: `${Math.floor(slotIndex / 4) + 1} / span 1`,
  };

  const { settings } = useAppStore();
  const isLightBackground = settings.osTheme && ['white', 'cyan', 'pink', 'green', 'purple', 'gray'].includes(settings.osTheme) && settings.wallpaper === '#1e293b';

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={`flex flex-col items-center gap-2 cursor-pointer select-none touch-manipulation relative ${isDragging ? 'opacity-50 scale-105' : ''}`}
      onClick={onClick}
    >
      <div ref={setMergeRef} className="absolute inset-0 top-1/4 bottom-1/4 left-1/4 right-1/4 z-10 pointer-events-none" />
      <div 
        className={`w-16 h-16 min-w-[4rem] min-h-[4rem] max-w-[4rem] max-h-[4rem] aspect-square shrink-0 rounded-2xl flex flex-wrap content-start p-1.5 gap-1 shadow-lg overflow-hidden pointer-events-none transition-all ${backgroundClass} ${isDragging ? 'ring-2 ring-white/40 shadow-xl scale-105' : ''} ${isMergeOver ? 'ring-2 ring-white/70 shadow-xl scale-105' : ''}`}
        style={folder.customIcon ? { background: `url(${folder.customIcon}) center/cover` } : {}}
      >
        {!folder.customIcon && folder.apps.slice(0, 9).map((appId) => {
           const app = defaultApps[appId];
           if (!app) return null;
           const customIcon = settings.appIcons?.[appId];
           return (
             <div key={appId} className={`w-[14px] h-[14px] rounded-[4px] flex items-center justify-center overflow-hidden border border-white/40 ${!customIcon ? 'bg-white/70 text-slate-700' : ''}`}>
               {customIcon ? <img src={customIcon} className="w-full h-full object-cover" /> : React.cloneElement(app.icon, { size: 10 })}
             </div>
           );
        })}
      </div>
      <span className={`${isLightBackground ? 'text-slate-800 drop-shadow-none' : 'text-white drop-shadow-md'} text-xs font-medium pointer-events-none`}>{folder.name}</span>
    </div>
  );
}

export default function HomeScreen() {
  const { openApp, settings, updateSettings, widgets, updateWidget, reorderWidgets } = useAppStore();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollSnapTimeoutRef = useRef<number | null>(null);
  const isTouchLike = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches,
    []
  );

  const defaultApps: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
    wechat: { name: '微信', icon: <MessageCircle size={32} color="white" />, color: 'bg-emerald-500' },
    music: { name: '音乐', icon: <Music size={32} color="white" />, color: 'bg-rose-500' },
    settings: { name: '设置', icon: <Settings size={32} color="white" />, color: 'bg-slate-500' },
    tarot: { name: '占星', icon: <Moon size={32} color="white" />, color: 'bg-indigo-600' },
    bottle: { name: '漂流瓶', icon: <MessageSquare size={32} color="white" />, color: 'bg-sky-400' },
    worldbook: { name: '世界书', icon: <Book size={32} color="white" />, color: 'bg-amber-600' },
    liarsbar: { name: '骗子酒馆', icon: <Wine size={32} color="white" />, color: 'bg-fuchsia-800' },
    jubensha: { name: '剧本杀', icon: <Book size={32} color="white" />, color: 'bg-slate-700' },
    ifapp: { name: 'IF', icon: <span className="text-white text-[21px] font-black tracking-[-0.08em]">IF</span>, color: 'bg-gradient-to-br from-violet-600 to-fuchsia-600' },
    vocab: { name: '单词', icon: <BookOpen size={32} color="white" />, color: 'bg-teal-500' },
    copet: { name: '共养', icon: <PawPrint size={32} color="white" />, color: 'bg-orange-500' },
    focus: { name: '陪伴', icon: <Hourglass size={32} color="white" />, color: 'bg-yellow-500' },
    reader: { name: '阅读', icon: <Scroll size={32} color="white" />, color: 'bg-blue-600' },
    calendar: { name: '日历', icon: <Calendar size={32} color="white" />, color: 'bg-indigo-400' },
    billing: { name: '记账', icon: <ReceiptText size={32} color="white" />, color: 'bg-emerald-400' },
    beautify: { name: '美化', icon: <Sparkles size={32} color="white" />, color: 'bg-pink-400' },
    news: { name: '日报', icon: <Newspaper size={32} color="white" />, color: 'bg-amber-800' },
    desktoppet: { name: '桌宠', icon: <Bot size={32} color="white" />, color: 'bg-rose-400' },
    writing: { name: '写作', icon: <PenSquare size={32} color="white" />, color: 'bg-violet-500' },
    diary: { name: '日记', icon: <NotebookPen size={32} color="white" />, color: 'bg-orange-300' },
    couplediary: { name: '情侣日记', icon: <Heart size={32} color="white" />, color: 'bg-pink-400' },
    movie: { name: '电影', icon: <Film size={32} color="white" />, color: 'bg-indigo-600' },
    mailbox: { name: '信箱', icon: <Mail size={32} color="white" />, color: 'bg-amber-500' },
    forum: { name: '论坛', icon: <MessagesSquare size={32} color="white" />, color: 'bg-stone-600' },
    memory: { name: '记忆', icon: <Brain size={32} color="white" />, color: 'bg-purple-500' },
  };
  const allApps = useMemo(() => Object.keys(defaultApps) as AppName[], []);
  const showDock = settings.showDock !== false;
  const dockApps = useMemo(
    () => Array.from(new Set((settings.dockApps || []).filter((app): app is AppName => Boolean(app) && typeof app === 'string'))),
    [settings.dockApps]
  );

  const getThemeColorClass = (baseIndex: number) => {
    if (!settings.osTheme) return null;
    const themeStr = settings.osTheme; 
    
    // Explicit static mappings for Tailwind compilation
    const themePalettes: Record<string, string[]> = {
      'black': ['bg-neutral-900', 'bg-neutral-800', 'bg-neutral-700', 'bg-neutral-600', 'bg-neutral-950', 'bg-neutral-800', 'bg-neutral-700', 'bg-neutral-900', 'bg-neutral-800', 'bg-neutral-950', 'bg-neutral-700'],
      'white': ['bg-slate-100', 'bg-slate-200', 'bg-slate-100', 'bg-slate-50', 'bg-slate-100', 'bg-slate-200', 'bg-slate-100', 'bg-slate-50', 'bg-slate-100', 'bg-slate-200', 'bg-slate-100'],
      'gray':  ['bg-slate-200', 'bg-slate-300', 'bg-slate-200', 'bg-slate-100', 'bg-slate-300', 'bg-slate-200', 'bg-slate-300', 'bg-slate-200', 'bg-slate-300', 'bg-slate-200', 'bg-slate-100'],
      'cyan':  ['bg-sky-200', 'bg-sky-300', 'bg-sky-200', 'bg-sky-300', 'bg-sky-200', 'bg-sky-100', 'bg-sky-200', 'bg-sky-300', 'bg-sky-200', 'bg-sky-300', 'bg-sky-200'],
      'pink':  ['bg-pink-200', 'bg-pink-300', 'bg-pink-200', 'bg-pink-300', 'bg-pink-200', 'bg-pink-100', 'bg-pink-200', 'bg-pink-300', 'bg-pink-200', 'bg-pink-300', 'bg-pink-200'],
      'green': ['bg-emerald-200', 'bg-emerald-300', 'bg-emerald-200', 'bg-emerald-300', 'bg-emerald-200', 'bg-emerald-100', 'bg-emerald-200', 'bg-emerald-300', 'bg-emerald-200', 'bg-emerald-300', 'bg-emerald-200'],
      'purple':['bg-purple-200', 'bg-purple-300', 'bg-purple-200', 'bg-purple-300', 'bg-purple-200', 'bg-purple-100', 'bg-purple-200', 'bg-purple-300', 'bg-purple-200', 'bg-purple-300', 'bg-purple-200'],
    };

    const palette = themePalettes[themeStr] || themePalettes['cyan'];
    const maxIdx = palette.length;
    return palette[baseIndex % maxIdx];
  };

  const [items, setItems] = useState<(AppName | AppFolder | null)[]>(() => {
    return buildDesktopItems(settings.appOrder || [], allApps, showDock ? dockApps : []);
  });
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  useEffect(() => {
    const nextItems = buildDesktopItems(settings.appOrder || [], allApps, showDock ? dockApps : []);
    setItems(nextItems);
    const currentSerialized = JSON.stringify(settings.appOrder || []);
    const nextSerialized = JSON.stringify(nextItems);
    if (currentSerialized !== nextSerialized) {
      updateSettings({ appOrder: nextItems as any });
    }
  }, [allApps, dockApps, settings.appOrder, showDock, updateSettings]);

  const customCollision = (args: any) => {
    const pointerCollisions = pointerWithin(args);
    
    if (pointerCollisions.length > 0) {
      const mergeTarget = pointerCollisions.find(p => p.id.toString().startsWith('merge_'));
      if (mergeTarget) {
         return [mergeTarget];
      }

      const widgetTarget = pointerCollisions.find(p => p.id.toString().startsWith('widget_'));
      if (widgetTarget) {
        return [widgetTarget];
      }

      const sortableTarget = pointerCollisions.find(p => !p.id.toString().startsWith('page_'));
      if (sortableTarget) {
        return [sortableTarget];
      }

      return pointerCollisions;
    }
    
    return closestCenter(args);
  };
  
  const widgetPageCount = Math.max(0, ...widgets.map(widget => (widget.page || 0) + 1), 0);
  const widgetOccupancyByPage = useMemo(() => {
    return Array.from({ length: Math.max(widgetPageCount, 1) }).map((_, pageIndex) => {
      const occupied = new Set<number>();
      const pageWidgets = (widgets || []).filter(widget => (widget.page || 0) === pageIndex);

      pageWidgets.forEach(widget => {
        const span = getWidgetSpan(widget.type);
        const width = widget.width || span.width;
        const height = widget.height || span.height;
        const slotIndex = resolveWidgetSlotIndex(widget, widgets || []);
        const startRow = Math.floor(slotIndex / 4);
        const startCol = slotIndex % 4;

        for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
          for (let colOffset = 0; colOffset < width; colOffset += 1) {
            const row = startRow + rowOffset;
            const col = startCol + colOffset;
            if (row >= DESKTOP_ROWS || col >= 4) continue;
            occupied.add(row * 4 + col);
          }
        }
      });

      return { occupied };
    });
  }, [widgetPageCount, widgets]);
  const pageMeta: { pageIndex: number; start: number; capacity: number; items: (AppName | AppFolder | null)[] }[] = useMemo(() => {
    const pagesData: { pageIndex: number; start: number; capacity: number; items: (AppName | AppFolder | null)[] }[] = [];
    const orderedItems = items.filter((item): item is AppName | AppFolder => item !== null);
    let queueIndex = 0;
    let pageIndex = 0;

    while (queueIndex < orderedItems.length || pageIndex < Math.max(widgetPageCount, 1)) {
      const occupiedCount = widgetOccupancyByPage[pageIndex]?.occupied.size || 0;
      const capacity = Math.max(0, DESKTOP_PAGE_SIZE - occupiedCount);
      pagesData.push({
        pageIndex,
        start: pageIndex * DESKTOP_PAGE_SIZE,
        capacity,
        items: orderedItems.slice(queueIndex, queueIndex + capacity)
      });
      queueIndex += capacity;
      pageIndex += 1;
    }

    if (pagesData.length === 0) {
      pagesData.push({ pageIndex: 0, start: 0, capacity: DESKTOP_PAGE_SIZE, items: [] });
    }

    return pagesData;
  }, [items, widgetOccupancyByPage, widgetPageCount]);
  const pages = pageMeta.map(page => page.items);
  const totalPages = Math.max(1, pages.length);

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const activeFolder = useMemo(
    () => items.find((item): item is AppFolder => Boolean(item) && typeof item === 'object' && item.id === activeFolderId) || null,
    [activeFolderId, items]
  );

  const persistItems = (nextItems: (AppName | AppFolder | null)[]) => {
    const normalized = collapseEmptyDesktopPages(repairSparseDesktopItems(normalizeAppOrder(nextItems)));
    const remainder = normalized.length % DESKTOP_PAGE_SIZE;
    const padded = remainder === 0 ? normalized : [...normalized, ...Array.from({ length: DESKTOP_PAGE_SIZE - remainder }, () => null)];
    setItems(padded);
    updateSettings({ appOrder: padded as any });
  };

  const persistDockApps = (nextDockApps: AppName[]) => {
    updateSettings({
      dockApps: Array.from(new Set(nextDockApps.filter((app): app is AppName => Boolean(app) && typeof app === 'string')))
    });
  };

  const moveAppToDock = (appId: AppName) => {
    if (!appId || dockApps.includes(appId) || dockApps.length >= 4) return;
    persistItems(removeAppFromDesktopItems(items, appId));
    persistDockApps([...dockApps, appId]);
    if (activeFolderId) {
      const nextFolder = removeAppFromDesktopItems(items, appId).find(
        (item): item is AppFolder => typeof item === 'object' && item?.id === activeFolderId
      );
      if (!nextFolder) setActiveFolderId(null);
    }
  };

  const removeDockApp = (appId: AppName, targetIndex?: number) => {
    if (!appId) return;
    persistDockApps(dockApps.filter(id => id !== appId));
    persistItems(
      typeof targetIndex === 'number'
        ? insertDesktopItemAtIndex(items, appId, targetIndex)
        : insertAppIntoDesktopItems(items, appId)
    );
  };

  const updateFolderById = (folderId: string, updates: Partial<AppFolder>) => {
    persistItems(items.map(item => Boolean(item) && typeof item === 'object' && item.id === folderId ? { ...item, ...updates } : item));
  };

  const moveAppOutOfFolder = (folderId: string, appId: AppName) => {
    const folderIndex = items.findIndex(item => Boolean(item) && typeof item === 'object' && item.id === folderId);
    if (folderIndex === -1) return;
    const folder = items[folderIndex] as AppFolder;
    const nextApps = folder.apps.filter(id => id !== appId);
    const nextItems = [...items];
    if (nextApps.length <= 1) {
      nextItems.splice(folderIndex, 1, ...(nextApps[0] ? [nextApps[0], appId].filter((value, index, arr) => arr.indexOf(value) === index) : [appId]));
    } else {
      nextItems[folderIndex] = { ...folder, apps: nextApps };
      nextItems.splice(folderIndex + 1, 0, appId);
    }
    persistItems(nextItems);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: isTouchLike ? 220 : 180,
        tolerance: isTouchLike ? 10 : 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over) {
      const activeId = active.id.toString();
      const isDockDrag = activeId.startsWith('dock_');
      const dockAppId = isDockDrag ? activeId.replace('dock_', '') as AppName : null;
      const desktopActiveId = isDockDrag ? dockAppId : activeId;

      if (isDockDrag && dockAppId) {
        if (over.id.toString().startsWith('slot_')) {
          const targetIndex = Number(over.id.toString().replace('slot_', ''));
          if (!Number.isNaN(targetIndex)) {
            removeDockApp(dockAppId, targetIndex);
          }
          return;
        }

        if (over.id.toString().startsWith('page_')) {
          const targetPage = Number(over.id.toString().replace('page_', ''));
          if (!Number.isNaN(targetPage)) {
            const emptySlot = findFirstEmptySlotInPage(items, targetPage);
            removeDockApp(dockAppId, emptySlot > -1 ? emptySlot : targetPage * DESKTOP_PAGE_SIZE);
          }
          return;
        }

        const targetIndex = items.findIndex(item => getItemId(item) === over.id);
        if (targetIndex > -1) {
          removeDockApp(dockAppId, targetIndex);
        }
        return;
      }

      if (over.id.toString().startsWith('merge_')) {
          const targetAppId = over.id.toString().replace('merge_', '');
          if (desktopActiveId !== targetAppId) {
             const oldIndex = items.findIndex(i => getItemId(i) === desktopActiveId);
             const targetIndex = items.findIndex(i => getItemId(i) === targetAppId);
             
             if (oldIndex > -1 && targetIndex > -1) {
                const newOrder = [...items];
                const activeItem = newOrder[oldIndex];
                const targetItem = newOrder[targetIndex];
                const activeApps = collectApps(activeItem);
                newOrder[oldIndex] = null;

                if (typeof targetItem === 'object') {
                   // Target is already a folder
                   newOrder[targetIndex] = {
                     ...targetItem,
                     apps: [...targetItem.apps, ...activeApps]
                   };
                } else {
                   // Target is a normal app, create a new folder
                   const newFolderId = `folder_${Date.now()}`;
                   newOrder[targetIndex] = {
                     id: newFolderId,
                     name: '文件夹',
                     apps: [targetAppId as AppName, ...activeApps]
                   };
                }
                
                persistItems(newOrder);
             }
          }
      } else if (desktopActiveId !== over.id) {
        if (desktopActiveId.toString().startsWith('widget_')) {
          const widgetId = desktopActiveId.toString().replace('widget_', '');
          if (over.id.toString().startsWith('slot_')) {
            const globalSlot = Number(over.id.toString().replace('slot_', ''));
            if (!Number.isNaN(globalSlot)) {
              updateWidget(widgetId, { page: Math.floor(globalSlot / DESKTOP_PAGE_SIZE), slotIndex: globalSlot % DESKTOP_PAGE_SIZE });
            }
            return;
          }
          if (over.id.toString().startsWith('page_')) {
            const targetPage = Number(over.id.toString().replace('page_', ''));
            if (!Number.isNaN(targetPage)) {
              updateWidget(widgetId, { page: targetPage, slotIndex: 0 });
            }
            return;
          }

          if (over.id.toString().startsWith('widget_')) {
            const overWidgetId = over.id.toString().replace('widget_', '');
            const targetWidget = widgets.find(widget => widget.id === overWidgetId);
            reorderWidgets(widgetId, overWidgetId, targetWidget?.page || 0);
            updateWidget(widgetId, { page: targetWidget?.page || 0, slotIndex: targetWidget?.slotIndex || 0 });
            return;
          }

          const targetMeta = pageMeta.find(page => page.items.some(item => getItemId(item) === over.id));
          const targetPageIndex = targetMeta?.pageIndex;
          if (typeof targetPageIndex === 'number') {
            const targetSlotIndex = targetMeta?.items.findIndex(item => getItemId(item) === over.id);
            updateWidget(widgetId, { page: targetPageIndex, slotIndex: Math.max(0, targetSlotIndex ?? 0) });
          }
          return;
        }

        if (over.id.toString() === 'dock_zone') {
          const activeAppId = desktopActiveId.toString() as AppName;
          const draggedItem = items.find(item => getItemId(item) === activeAppId);
          if (typeof draggedItem === 'string') {
            moveAppToDock(activeAppId);
          }
          return;
        }

        if (over.id.toString().startsWith('slot_')) {
          const oldIndex = items.findIndex(i => getItemId(i) === desktopActiveId);
          const targetIndex = Number(over.id.toString().replace('slot_', ''));
          if (oldIndex > -1 && !Number.isNaN(targetIndex)) {
            const nextItems = [...items];
            const activeItem = nextItems[oldIndex];
            nextItems[oldIndex] = null;
            while (nextItems.length <= targetIndex) nextItems.push(null);
            nextItems[targetIndex] = activeItem;
            persistItems(nextItems);
          }
          return;
        }

        if (over.id.toString().startsWith('page_')) {
          const oldIndex = items.findIndex(i => getItemId(i) === desktopActiveId);
          const targetPage = Number(over.id.toString().replace('page_', ''));
          if (oldIndex > -1 && !Number.isNaN(targetPage)) {
            const targetIndex = findFirstEmptySlotInPage(items, targetPage);
            if (targetIndex === -1) return;
            const nextItems = [...items];
            const activeItem = nextItems[oldIndex];
            nextItems[oldIndex] = null;
            nextItems[targetIndex] = activeItem;
            persistItems(nextItems);
          }
          return;
        }

        const oldIndex = items.findIndex(i => getItemId(i) === desktopActiveId);
        const newIndex = items.findIndex(i => getItemId(i) === over.id);
        
        if (oldIndex > -1 && newIndex > -1) {
          const nextItems = [...items];
          [nextItems[oldIndex], nextItems[newIndex]] = [nextItems[newIndex], nextItems[oldIndex]];
          persistItems(nextItems);
        }
      }
    }
  };

  const getBackgroundStyle = () => {
    const isUsingDefault = settings.wallpaper === '#1e293b' || settings.wallpaper === '' || settings.wallpaper === '#0f172a';
    const isImage = settings.wallpaper?.startsWith('http') || settings.wallpaper?.startsWith('data:');
    if (isImage || (!isUsingDefault && !settings.osTheme)) {
      return { background: `url(${settings.wallpaper}) center/cover no-repeat` };
    }
    const themeColors: any = {
      'cyan': 'linear-gradient(to bottom, #bae6fd, #e0f2fe)',
      'pink': 'linear-gradient(to bottom, #fbcfe8, #fce7f3)',
      'white': '#f8fafc',
      'green': 'linear-gradient(to bottom, #a7f3d0, #d1fae5)',
      'purple': 'linear-gradient(to bottom, #ddd6fe, #ede9fe)',
      'black': '#0a0a0a',
      'gray': 'linear-gradient(to bottom, #e2e8f0, #f1f5f9)',
      'yellow': 'linear-gradient(to bottom, #fef3c7, #fde68a)'
    };
    return { background: settings.osTheme ? (themeColors[settings.osTheme] || themeColors['gray']) : (themeColors['gray']) };
  };

  return (
    <div 
      className="absolute inset-0 z-0 overflow-hidden"
      style={getBackgroundStyle()}
    >
      <DndContext 
        sensors={sensors}
        collisionDetection={customCollision}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={items.map(getItemId).filter(Boolean) as string[]}
          strategy={rectSortingStrategy}
        >
          <div
            ref={scrollContainerRef}
            onScroll={(event) => {
              const container = event.currentTarget;
              if (scrollSnapTimeoutRef.current) {
                window.clearTimeout(scrollSnapTimeoutRef.current);
              }
              scrollSnapTimeoutRef.current = window.setTimeout(() => {
                const width = Math.max(1, container.clientWidth);
                const rawPage = container.scrollLeft / width;
                const basePage = Math.floor(rawPage);
                const progress = rawPage - basePage;
                let nextPage = currentPage;

                if (progress > 0.72) {
                  nextPage = Math.min(totalPages - 1, basePage + 1);
                } else if (progress < 0.28) {
                  nextPage = Math.max(0, basePage);
                } else {
                  nextPage = Math.max(0, Math.min(totalPages - 1, currentPage));
                }

                container.scrollTo({ left: nextPage * width, behavior: 'smooth' });
                setCurrentPage(nextPage);
              }, 120);
            }}
            className={`w-full h-full flex overflow-x-auto overflow-y-hidden snap-x snap-proximity pt-16 no-scrollbar relative z-10 transition-colors overscroll-x-contain ${showDock ? 'pb-32' : 'pb-24'}`}
          >
            {pages.map((pageItems, pageIndex) => (
              <div key={pageIndex} className="w-full h-full flex-shrink-0 snap-start flex flex-col justify-between px-6 pb-4 min-w-[100vw]">
                <PageDropZone pageIndex={pageIndex}>
                  <div className="grid grid-cols-4 gap-y-6 gap-x-4 content-start w-full h-full relative z-10 pointer-events-auto auto-rows-fr" style={{ gridTemplateRows: `repeat(${DESKTOP_ROWS}, minmax(0, 1fr))` }}>
                    <DesktopWidgets page={pageIndex} />
                    {(() => {
                      const occupiedSlots = widgetOccupancyByPage[pageIndex]?.occupied || new Set<number>();
                      const slottedItems: (AppName | AppFolder | null)[] = Array.from({ length: DESKTOP_PAGE_SIZE }, () => null);
                      let itemIndex = 0;

                      for (let slotIndex = 0; slotIndex < DESKTOP_PAGE_SIZE; slotIndex += 1) {
                        if (occupiedSlots.has(slotIndex)) continue;
                        slottedItems[slotIndex] = pageItems[itemIndex] ?? null;
                        if (pageItems[itemIndex]) itemIndex += 1;
                      }

                      return Array.from({ length: DESKTOP_PAGE_SIZE }).map((_, slotIndex) => {
                         if (occupiedSlots.has(slotIndex)) return null;
                         const item = slottedItems[slotIndex] ?? null;
                         const globalIndex = pageMeta[pageIndex].start + slotIndex;
                         if (item === null) {
                           return <SlotDropZone key={`slot_${globalIndex}`} slotId={`slot_${globalIndex}`} slotIndex={slotIndex} />;
                         }
                         if (typeof item === 'object') {
                           return (
                             <SortableFolderItem
                               key={item.id}
                               id={item.id}
                               folder={item}
                               defaultApps={defaultApps}
                               backgroundClass={`${getThemeColorClass(items.findIndex(i => getItemId(i) === item.id)) || 'bg-slate-300'} ${settings.osTheme === 'black' ? 'border border-white/10' : 'border border-white/40'}`}
                               onClick={() => setActiveFolderId(item.id)}
                               slotIndex={slotIndex}
                             />
                           );
                         }
                         
                         const appId = item as string;
                         const app = defaultApps[appId];
                         if (!app) return null;
                         const customIcon = settings.appIcons?.[appId];
                         const overrideName = settings.appNameOverrides?.[appId];
                         
                         return (
                           <SortableAppItem 
                             key={appId}
                             id={appId}
                            app={{ ...app, name: overrideName || app.name, color: getThemeColorClass(items.findIndex(i => typeof i === 'string' ? i === appId : Boolean(i) && i.id === appId)) || app.color }}
                             customIcon={customIcon}
                             onClick={() => openApp(appId as AppName)}
                             slotIndex={slotIndex}
                           />
                         );
                      });
                    })()}
                    {pageItems.every(item => item === null) && widgets.filter(widget => (widget.page || 0) === pageIndex).length === 0 && (
                      <div className="col-span-4 flex items-center justify-center text-white/35 text-sm" style={{ gridRow: `span ${DESKTOP_ROWS} / span ${DESKTOP_ROWS}` }}>
                        拖动软件到这里
                      </div>
                    )}
                  </div>
                </PageDropZone>
              </div>
            ))}
          </div>
        </SortableContext>
        {showDock && (
          <div className="absolute inset-x-0 bottom-5 z-20 pointer-events-none">
            <div className="pointer-events-auto">
              <DockDropZone isEmpty={dockApps.length === 0}>
                <div className="flex w-full items-center justify-center gap-0 overflow-x-visible overflow-y-visible no-scrollbar px-1">
                  {dockApps.slice(0, 4).map((appId) => {
                    const app = defaultApps[appId];
                    if (!app) return null;
                    const customIcon = settings.appIcons?.[appId];
                    const overrideName = settings.appNameOverrides?.[appId];
                    const themedDockColor = customIcon ? null : getThemeColorClass(items.findIndex(i => getItemId(i) === appId) > -1 ? items.findIndex(i => getItemId(i) === appId) : dockApps.findIndex(id => id === appId));
                    return (
                      <DockAppItem
                        key={appId}
                        appId={appId}
                        app={app}
                        customIcon={customIcon}
                        label={overrideName || app.name}
                        themedColor={themedDockColor}
                        onClick={() => openApp(appId)}
                      />
                    );
                  })}
                </div>
              </DockDropZone>
            </div>
          </div>
        )}
      </DndContext>
      
      {activeFolder && (
        <div className="absolute inset-0 z-30 bg-black/55 backdrop-blur-xl px-6 py-20" onClick={() => setActiveFolderId(null)}>
          <div
            className="h-full rounded-[2rem] bg-white/18 border border-white/35 shadow-2xl p-5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5">
              <input
                value={activeFolder.name}
                onChange={(e) => updateFolderById(activeFolder.id, { name: e.target.value || '文件夹' })}
                className="w-full bg-transparent text-white text-lg font-semibold tracking-wide outline-none border-b border-white/20 pb-2 placeholder:text-white/50"
                placeholder="文件夹"
              />
            </div>

            <div className="grid grid-cols-4 gap-x-4 gap-y-6 overflow-y-auto pb-6">
              {activeFolder.apps.map((appId) => {
                const app = defaultApps[appId];
                if (!app) return null;
                const customIcon = settings.appIcons?.[appId];
                const overrideName = settings.appNameOverrides?.[appId];

                return (
                  <div key={appId} className="flex flex-col items-center gap-2">
                  <button
                    className="flex flex-col items-center gap-2"
                    onClick={() => {
                      setActiveFolderId(null);
                      openApp(appId);
                    }}
                  >
                    <div
                      className={`w-16 h-16 min-w-[4rem] min-h-[4rem] max-w-[4rem] max-h-[4rem] aspect-square shrink-0 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden ${!customIcon ? getThemeColorClass(items.findIndex(i => Boolean(i) && getItemId(i) === activeFolder.id)) || app.color : ''}`}
                      style={customIcon ? { background: `url(${customIcon}) center/cover` } : {}}
                    >
                      {!customIcon && app.icon}
                    </div>
                    <span className="text-xs text-white font-medium text-center line-clamp-2">{overrideName || app.name}</span>
                  </button>
                  <button
                    onClick={() => moveAppOutOfFolder(activeFolder.id, appId)}
                    className="text-[10px] text-white/80 bg-white/10 border border-white/15 rounded-full px-2 py-1"
                  >
                    移出
                  </button>
                  {showDock && (
                    <button
                      onClick={() => moveAppToDock(appId)}
                      className="text-[10px] text-white/85 bg-white/12 border border-white/15 rounded-full px-2 py-1"
                    >
                      进 Dock
                    </button>
                  )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
