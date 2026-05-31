import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, parse, startOfDay, differenceInMinutes } from 'date-fns';
import { useAppStore } from '../../store';
import { generateAIResponse } from '../../lib/ai';

type PetAction = 'idle' | 'blink' | 'wave' | 'hop' | 'look' | 'annoyed';

function PixelPet({ characterId, action }: { characterId: string; action: PetAction }) {
  const { characters, settings } = useAppStore();
  const char = characters[characterId];
  const petColor = settings.desktopPet?.petColor;
  const bodyColor = petColor || char?.avatar || '#c53030';
  const poseClass =
    action === 'hop' ? '-translate-y-2' :
    action === 'wave' ? 'rotate-2' :
    action === 'annoyed' ? 'scale-95' :
    action === 'look' ? '-rotate-2' : '';

  return (
    <div className={`relative transition-all duration-300 ${poseClass}`}>
      <div style={{ position: 'relative', width: 64, height: 60 }}>
        <div style={{ position: 'absolute', width: 72, height: 11, left: '50%', bottom: -2, transform: 'translateX(-50%)', backgroundColor: '#E5E5E5', borderRadius: 5, opacity: 0.5 }} />
        <div style={{ position: 'absolute', width: 61, height: 45, left: '50%', top: -5, transform: 'translateX(-50%)', backgroundColor: '#ffffff', borderRadius: 21 }} />
        <div style={{ position: 'absolute', width: 48, height: 38, left: '50%', top: 14, transform: 'translateX(-50%)', backgroundColor: bodyColor, borderRadius: 16, boxShadow: '0 3px 6px rgba(0,0,0,0.1)' }} />
        <div style={{ position: 'absolute', width: 12, height: 26, left: 2, top: 26, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 6 }} />
        <div style={{ position: 'absolute', width: 12, height: 26, right: 2, top: 26, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 6 }} />
        <div style={{ position: 'absolute', width: 11, height: 6, left: 14, top: 32, backgroundColor: '#374151', borderRadius: 3 }} />
        <div style={{ position: 'absolute', width: 11, height: 6, right: 14, top: 32, backgroundColor: '#374151', borderRadius: 3 }} />
        <div style={{ position: 'absolute', width: 13, height: 4, left: '50%', top: 43, transform: 'translateX(-50%)', borderRadius: '0 0 6px 6px', borderBottom: '2px solid #374151' }} />
      </div>
    </div>
  );
}

export default function DesktopPetOverlay() {
  const { settings, updateSettings, currentApp, isLocked, characters, calendarRecords, receiveMessage } = useAppStore();
  const pet = settings.desktopPet;
  const [action, setAction] = useState<PetAction>('idle');
  const [bubble, setBubble] = useState('');
  const [visibleBubble, setVisibleBubble] = useState(false);
  const [pokeTimestamps, setPokeTimestamps] = useState<number[]>([]);
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number; dragging: boolean } | null>(null);
  const positionRef = useRef({ x: pet?.x || 0, y: pet?.y || 0 });

  const enabled = Boolean(pet?.enabled && pet.characterId && !isLocked);
  const actionPool = useMemo<PetAction[]>(() => ['idle', 'blink', 'wave', 'hop', 'look'], []);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      setAction(actionPool[Math.floor(Math.random() * actionPool.length)]);
      setTimeout(() => setAction('idle'), 1400);
    }, 7000);
    return () => clearInterval(timer);
  }, [enabled, actionPool]);

  useEffect(() => {
    if (!enabled || !pet?.remindMode || !pet.characterId) return;
    const timer = setInterval(async () => {
      const now = new Date();
      const dateStr = format(now, 'yyyy-MM-dd');
      const record = calendarRecords[dateStr];
      if (!record?.events) return;
      const today = startOfDay(now);
      for (const event of record.events) {
        if (event.type !== 'plan' || !event.isPublished) continue;
        if (pet.lastReminderEventId === event.id) continue;
        const eventTime = parse(event.time, 'HH:mm', today);
        const diff = differenceInMinutes(eventTime, now);
        if (diff <= 15 && diff >= -10) {
          const reminder = `该去做“${event.title}”了`;
          setBubble(reminder);
          setVisibleBubble(true);
          updateSettings({ desktopPet: { ...pet, lastReminderEventId: event.id } });
          setTimeout(() => setVisibleBubble(false), 4000);
          break;
        }
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [enabled, pet, calendarRecords, updateSettings]);

  if (!enabled || !pet?.characterId) return null;

  positionRef.current = { x: pet.x, y: pet.y };
  const bubbleWidth = 210;
  const preferRight = pet.x < window.innerWidth / 2;
  const preferAbove = pet.y > window.innerHeight / 2;
  const bubbleLeft = preferRight
    ? Math.min(window.innerWidth - bubbleWidth - 12, pet.x + 46)
    : Math.max(12, pet.x - bubbleWidth + 38);
  const bubbleTop = preferAbove
    ? Math.max(14, pet.y - 94)
    : Math.min(window.innerHeight - 84, pet.y + 18);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      x: pet.x,
      y: pet.y,
      dragging: false
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.dragging = true;
    const nextX = Math.max(8, Math.min(window.innerWidth - 84, dragRef.current.x + dx));
    const nextY = Math.max(60, Math.min(window.innerHeight - 120, dragRef.current.y + dy));
    positionRef.current = { x: nextX, y: nextY };
    updateSettings({
      desktopPet: {
        ...pet,
        x: nextX,
        y: nextY
      }
    });
  };

  const onPointerUp = async () => {
    const wasDragging = dragRef.current?.dragging;
    dragRef.current = null;
    if (wasDragging || !pet.characterId) return;

    setAction('annoyed');
    setTimeout(() => setAction('idle'), 1200);
    try {
      const char = useAppStore.getState().characters[pet.characterId];
      const name = char?.name || '宠物';
      const personality = char?.personality || '温柔';
      const relationship = char?.relationship || '恋人';
      const affection = char?.affection ?? 70;
      const viewOnMe = char?.viewOnMe || '';
      const nick = char?.userNickname || '你';
      const { getCurrentMood } = await import('../../lib/moodLoop');
      const mood = getCurrentMood(pet.characterId);
      const moodDesc = mood ? `（心情：${mood.overall}，${mood.summary}）` : '';
      const systemMsg = `你是${name}。性格：${personality}。和对方的关系：${relationship}（对方=${nick}，好感度${affection}/100）。${viewOnMe ? `你对${nick}的看法：${viewOnMe}` : ''}${moodDesc}你现在正在桌宠模式下陪${nick}。严禁动作描写、神态描写、心理描写。只说一句话，不加括号、引号、星号。`;
      const reply = await generateAIResponse(
        `（${nick}轻轻戳了你一下，在逗你玩）用一句话回应${nick}，只说你说的话，不要任何动作或心理描写。`,
        systemMsg
      );
      setBubble(reply.replace(/[「」【】*（）()]/g, '').trim());
      setVisibleBubble(true);
      setTimeout(() => setVisibleBubble(false), 4200);
    } catch {
      setBubble('别戳啦，我在看着你。');
      setVisibleBubble(true);
      setTimeout(() => setVisibleBubble(false), 4200);
    }

    const nextPokes = [...pokeTimestamps.filter(ts => Date.now() - ts < 30000), Date.now()];
    setPokeTimestamps(nextPokes);
    if (nextPokes.length >= 4 && (!pet.lastDisturbMessageAt || Date.now() - pet.lastDisturbMessageAt > 60000)) {
      receiveMessage(pet.characterId, '你今天戳我也太频繁了吧，我都没法好好站着了。');
      updateSettings({ desktopPet: { ...pet, lastDisturbMessageAt: Date.now() } });
    }
  };

  return (
    <div
      className="absolute z-[120] pointer-events-auto select-none touch-none cursor-grab active:cursor-grabbing"
      style={{ left: pet.x, top: pet.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {visibleBubble && (
        <div
          className="fixed rounded-2xl bg-white/97 text-slate-700 text-xs leading-5 px-3 py-2 shadow-xl border border-slate-200 whitespace-pre-wrap break-words"
          style={{ left: bubbleLeft, top: bubbleTop, width: bubbleWidth, zIndex: 130 }}
        >
          {bubble}
        </div>
      )}
      <div className="-m-3 p-3">
        <PixelPet characterId={pet.characterId} action={action} />
      </div>
    </div>
  );
}
