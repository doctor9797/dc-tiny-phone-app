import React from 'react';
import { useAppStore } from '../store';
import { DesktopWidget } from '../types';
import { Music, Play, Disc, User, Heart } from 'lucide-react';
import { format } from 'date-fns';
import { useDraggable, useDroppable } from '@dnd-kit/core';

export const DESKTOP_COLUMNS = 4;
export const DESKTOP_ROWS = 4;
export const DESKTOP_PAGE_SIZE = DESKTOP_COLUMNS * DESKTOP_ROWS;

export const getWidgetSpan = (type: DesktopWidget['type']) => {
  switch (type) {
    case 'time_bar':
    case 'listen_together':
      return { width: 4, height: 1 };
    case 'photo_4x2':
    case 'quote_4x2':
      return { width: 4, height: 2 };
    default:
      return { width: 2, height: 2 };
  }
};

const getPlacementSlots = (slotIndex: number, width: number, height: number) => {
  const startRow = Math.floor(slotIndex / DESKTOP_COLUMNS);
  const startCol = slotIndex % DESKTOP_COLUMNS;
  const slots: number[] = [];
  for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
    for (let colOffset = 0; colOffset < width; colOffset += 1) {
      slots.push((startRow + rowOffset) * DESKTOP_COLUMNS + startCol + colOffset);
    }
  }
  return slots;
};

export const isWidgetPlacementValid = (slotIndex: number, width: number, height: number) => {
  const startRow = Math.floor(slotIndex / DESKTOP_COLUMNS);
  const startCol = slotIndex % DESKTOP_COLUMNS;
  return startCol + width <= DESKTOP_COLUMNS && startRow + height <= DESKTOP_ROWS;
};

export const findAvailableWidgetSlot = (
  widgets: DesktopWidget[],
  page: number,
  width: number,
  height: number,
  excludeWidgetId?: string
) => {
  const occupied = new Set<number>();
  widgets
    .filter(widget => (widget.page || 0) === page && widget.id !== excludeWidgetId)
    .forEach(widget => {
      const span = getWidgetSpan(widget.type);
      const widgetWidth = widget.width || span.width;
      const widgetHeight = widget.height || span.height;
      const resolvedSlot = resolveWidgetSlotIndex(widget, widgets);
      getPlacementSlots(resolvedSlot, widgetWidth, widgetHeight).forEach(slot => occupied.add(slot));
    });

  for (let slotIndex = 0; slotIndex < DESKTOP_PAGE_SIZE; slotIndex += 1) {
    if (!isWidgetPlacementValid(slotIndex, width, height)) continue;
    const slots = getPlacementSlots(slotIndex, width, height);
    if (slots.every(slot => slot < DESKTOP_PAGE_SIZE && !occupied.has(slot))) {
      return slotIndex;
    }
  }

  return 0;
};

export const resolveWidgetSlotIndex = (widget: DesktopWidget, allWidgets: DesktopWidget[]) => {
  const span = getWidgetSpan(widget.type);
  const width = widget.width || span.width;
  const height = widget.height || span.height;
  const desiredSlot = Math.max(0, widget.slotIndex || 0);

  const peerWidgets = allWidgets.filter(item => item.id !== widget.id && (item.page || 0) === (widget.page || 0));
  const occupied = new Set<number>();
  peerWidgets.forEach(peer => {
    const peerSpan = getWidgetSpan(peer.type);
    const peerWidth = peer.width || peerSpan.width;
    const peerHeight = peer.height || peerSpan.height;
    const peerSlot = Math.max(0, peer.slotIndex || 0);
    if (!isWidgetPlacementValid(peerSlot, peerWidth, peerHeight)) return;
    getPlacementSlots(peerSlot, peerWidth, peerHeight).forEach(slot => occupied.add(slot));
  });

  if (isWidgetPlacementValid(desiredSlot, width, height)) {
    const desiredSlots = getPlacementSlots(desiredSlot, width, height);
    if (desiredSlots.every(slot => slot < DESKTOP_PAGE_SIZE && !occupied.has(slot))) {
      return desiredSlot;
    }
  }

  return findAvailableWidgetSlot(allWidgets, widget.page || 0, width, height, widget.id);
};

export function WidgetRenderer({ widget }: { widget: DesktopWidget }) {
  const { characters, settings } = useAppStore();
  const d = widget.data;

  // Render Time Bar (4x1)
  if (widget.type === 'time_bar') {
    return (
      <div className="w-full bg-white/20 backdrop-blur-xl rounded-[1.5rem] p-4 flex items-center justify-between text-white shadow-lg border border-white/30 overflow-hidden relative group h-20">
         <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
         <div className="relative z-10 flex flex-col pointer-events-none">
            <div className={`text-2xl font-bold font-sans tracking-tight`}>
               {format(new Date(), 'HH:mm')}
            </div>
            <div className="text-[10px] uppercase font-bold tracking-widest opacity-80 mt-0.5 pointer-events-none">
               {format(new Date(), 'EEEE, MMM do')}
            </div>
         </div>
         {d.customText && (
            <div className={`relative z-10 text-xs font-medium opacity-90 max-w-[50%] text-right ${d.font || 'font-serif'} italic pointer-events-none`}>
               {d.customText}
            </div>
         )}
      </div>
    );
  }

  // 2x2 Square Image
  if (widget.type === 'photo_2x2') {
    return (
      <div className="w-full h-full relative rounded-[2rem] overflow-hidden shadow-xl group pointer-events-none">
         <img src={d.url} className="w-full h-full object-cover" alt="" />
         <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
         {d.text && (
           <div className={`absolute bottom-3 left-3 right-3 text-white text-xs font-bold leading-tight drop-shadow-md ${d.font || 'font-sans'}`}>
              {d.text}
           </div>
         )}
      </div>
    );
  }

  // 4x2 Rect Image
  if (widget.type === 'photo_4x2') {
    return (
      <div className="w-full h-full relative rounded-[2rem] overflow-hidden shadow-xl pointer-events-none">
         <img src={d.url} className="w-full h-full object-cover" alt="" />
      </div>
    );
  }

  // Sticky Note
  if (widget.type === 'sticky_note') {
    return (
      <div className="w-full h-full rounded-[2rem] shadow-xl p-4 flex items-center justify-center relative overflow-hidden pointer-events-none" style={{ backgroundColor: d.bgColor || '#fef3c7', color: d.textColor || '#92400e' }}>
         <div className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-black/10 rounded-full"></div>
         <div className={`text-sm leading-relaxed text-center font-bold ${d.font || 'font-sans'}`}>
            {d.text}
         </div>
      </div>
    );
  }

  // Music Player
  if (widget.type === 'music_player') {
    return (
      <div className="w-full h-full bg-white/30 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/40 overflow-hidden relative flex flex-col p-4 pointer-events-none">
        <div className="w-12 h-12 rounded-full overflow-hidden mb-auto shadow-md border-2 border-white/50 animate-spin-slow">
           <img src={d.cover} className="w-full h-full object-cover" alt="" />
        </div>
        <div className="absolute top-4 right-4 opacity-70">
           <Disc size={20} className="text-white" />
        </div>
        <div className="mt-auto">
           <div className="text-white font-bold text-sm truncate drop-shadow">{d.title}</div>
           <div className="text-white/70 text-[10px] font-bold uppercase tracking-widest truncate">{d.artist}</div>
        </div>
      </div>
    );
  }

  // Listen Together
  if (widget.type === 'listen_together') {
    const char = d.charId ? characters[d.charId] : null;
    const userAvatar = settings.wechatAvatar;
    return (
      <div className="w-full h-[80px] bg-white/20 backdrop-blur-xl rounded-[1.5rem] shadow-lg border border-white/30 p-3 flex items-center gap-3 relative overflow-hidden pointer-events-none">
        <div className="flex -space-x-3">
           <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white z-10 shadow-sm relative" style={{ background: userAvatar.startsWith('#') ? userAvatar : `url(${userAvatar}) center/cover` }}>
              {!userAvatar.startsWith('#') && <img src={userAvatar} className="w-full h-full object-cover" alt="" />}
           </div>
           <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white z-0 relative shadow-sm">
              {char && !char.avatar.startsWith('#') && <img src={char.avatar} className="w-full h-full object-cover" alt="" />}
           </div>
        </div>
        <div className="flex-1 min-w-0">
           <div className="flex items-center gap-1.5 text-white/90 text-[10px] uppercase tracking-widest font-bold mb-0.5">
             <Heart size={10} className="text-rose-400 fill-rose-400" /> 一起听
           </div>
           <div className="text-white font-bold text-sm truncate drop-shadow">{d.song}</div>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/20 flex justify-center items-center text-white backdrop-blur">
           <Play size={14} className="ml-0.5" />
        </div>
      </div>
    );
  }

  // Profile Intro
  if (widget.type === 'profile_intro') {
    return (
      <div className="w-full h-full rounded-[2rem] shadow-xl p-4 flex flex-col relative overflow-hidden pointer-events-none" style={{ backgroundColor: d.bgColor || '#f1f5f9' }}>
         <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/50 shadow-md mb-3 bg-white shrink-0">
            {d.avatar && <img src={d.avatar} className="w-full h-full object-cover" />}
         </div>
         <div className="text-slate-800 font-black text-base truncate shrink-0">{d.name}</div>
         <div className="text-slate-500 font-medium text-xs leading-tight mt-1 line-clamp-3">{d.desc}</div>
      </div>
    );
  }

  // Calendar Widget
  if (widget.type === 'calendar_widget') {
    return (
      <div className="w-full h-full rounded-[2rem] shadow-xl p-4 flex flex-col relative overflow-hidden pointer-events-none" style={{ backgroundColor: d.bgColor || '#ffffff', color: d.textColor || '#334155' }}>
         <div className={`text-base font-black ${d.font || 'font-sans'}`}>{format(new Date(), 'yyyy / MM')}</div>
         <div className={`text-4xl font-bold mt-1 ${d.font || 'font-sans'}`}>{format(new Date(), 'dd')}</div>
         <div className="mt-auto text-xs font-bold opacity-60">Calendar</div>
         {d.url && (
            <img src={d.url} className="absolute bottom-2 right-2 w-12 h-12 object-cover rounded-full border-2 border-white/50" alt="" />
         )}
      </div>
    );
  }

  // Quote 4x2
  if (widget.type === 'quote_4x2') {
    return (
      <div className="w-full h-full relative rounded-[2rem] overflow-hidden shadow-xl flex items-center justify-center p-6 pointer-events-none">
         <img src={d.url} className="absolute inset-0 w-full h-full object-cover" alt="" />
         <div className="absolute inset-0 bg-black/40"></div>
         <div className={`relative z-10 text-white text-center leading-relaxed drop-shadow-md text-sm font-medium ${d.font || 'font-serif'}`}>
            "{d.text}"
         </div>
      </div>
    );
  }

  // Countdown 2x2
  if (widget.type === 'countdown') {
    return (
      <div className="w-full h-full rounded-[2rem] shadow-xl p-4 flex flex-col items-center justify-center relative overflow-hidden text-white pointer-events-none">
         <img src={d.url} className="absolute inset-0 w-full h-full object-cover" alt="" />
         <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60"></div>
         <div className={`relative z-10 text-xs font-bold leading-tight drop-shadow-md opacity-80 ${d.font || 'font-sans'}`}>
            {d.text}
         </div>
         <div className={`relative z-10 text-3xl font-black mt-2 drop-shadow-lg ${d.font || 'font-sans'}`}>
            {d.days}
         </div>
         <div className="relative z-10 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">Days</div>
      </div>
    );
  }

  return null;
}

export function DraggableWidget({ widget }: { key?: React.Key; widget: DesktopWidget }) {
  const span = getWidgetSpan(widget.type);
  const { widgets } = useAppStore();
  const slotIndex = resolveWidgetSlotIndex(widget, widgets || []);
  const columnStart = (slotIndex % DESKTOP_COLUMNS) + 1;
  const rowStart = Math.floor(slotIndex / DESKTOP_COLUMNS) + 1;
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `widget_${widget.id}`
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `widget_${widget.id}`
  });

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      {...listeners}
      {...attributes}
      className={`relative z-0 min-h-[80px] select-none touch-pan-x ${isDragging ? 'opacity-70 scale-105 z-30' : ''} ${isOver ? 'ring-2 ring-white/40 rounded-[24px]' : ''}`}
      style={{
        gridColumn: `${columnStart} / span ${widget.width || span.width}`,
        gridRow: `${rowStart} / span ${widget.height || span.height}`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined
      }}
    >
      <WidgetRenderer widget={widget} />
    </div>
  );
}

export default function DesktopWidgets({ page = 0 }: { page?: number }) {
  const { widgets } = useAppStore();

  const pageWidgets = (widgets || []).filter(widget => (widget.page || 0) === page);

  if (pageWidgets.length === 0) return null;

  return (
    <div className="contents">
      {pageWidgets.map((widget) => {
        return <DraggableWidget key={widget.id} widget={widget} />;
      })}
    </div>
  );
}
