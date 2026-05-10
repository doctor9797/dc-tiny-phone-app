import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, MoreHorizontal, Plus, Image as ImageIcon, Play, Smile, Volume2, Send } from 'lucide-react';
import { generateAIResponse, getCharacterReply, textToSpeech, speechToText, translateText } from '../../lib/ai';
import CharacterSettings from './CharacterSettings';
import CharacterMoments from './CharacterMoments';
import ImageUploader from '../ImageUploader';
import { Character, Message } from '../../types';
import VoiceRecorderButton from './VoiceRecorderButton';

const getT = (theme: string) => {
  const t: Record<string, any> = {
    cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950', text: 'text-cyan-900 dark:text-cyan-50', header: 'bg-cyan-100/50 dark:bg-cyan-900/50', border: 'border-cyan-200 dark:border-cyan-800', prim: 'text-cyan-700 dark:text-cyan-400', inputBorder: 'border-cyan-300 dark:border-cyan-700', panel: 'bg-cyan-100 dark:bg-cyan-900', active: 'active:bg-cyan-200 dark:active:bg-cyan-800', light: 'bg-cyan-100 text-cyan-600', dark: 'bg-cyan-500/20 text-cyan-400', gift: 'bg-cyan-100 border-cyan-200 text-cyan-700', transfer: 'bg-cyan-100 border-cyan-200 text-cyan-700', gradient: 'from-cyan-900/70 to-cyan-800/50', borderLight: 'border-cyan-200', borderDark: 'border-cyan-500/30', textLight: 'text-cyan-600', textDark: 'text-cyan-300/70', bottomBg: 'bg-cyan-200/60', bottomBgDark: 'bg-black/20', bottomBorder: 'border-cyan-200', bottomBorderDark: 'border-cyan-500/20', bottomText: 'text-cyan-600', bottomTextDark: 'text-cyan-200/60' },
    pink: { bg: 'bg-pink-50 dark:bg-pink-950', text: 'text-pink-900 dark:text-pink-50', header: 'bg-pink-100/50 dark:bg-pink-900/50', border: 'border-pink-200 dark:border-pink-800', prim: 'text-pink-700 dark:text-pink-400', inputBorder: 'border-pink-300 dark:border-pink-700', panel: 'bg-pink-100 dark:bg-pink-900', active: 'active:bg-pink-200 dark:active:bg-pink-800', light: 'bg-pink-100 text-pink-600', dark: 'bg-pink-500/20 text-pink-400', gift: 'bg-pink-100 border-pink-200 text-pink-700', transfer: 'bg-pink-100 border-pink-200 text-pink-700', gradient: 'from-pink-900/70 to-pink-800/50', borderLight: 'border-pink-200', borderDark: 'border-pink-500/30', textLight: 'text-pink-600', textDark: 'text-pink-300/70', bottomBg: 'bg-pink-200/60', bottomBgDark: 'bg-black/20', bottomBorder: 'border-pink-200', bottomBorderDark: 'border-pink-500/20', bottomText: 'text-pink-600', bottomTextDark: 'text-pink-200/60' },
    white: { bg: 'bg-slate-50 dark:bg-[#121212]', text: 'text-slate-900 dark:text-slate-50', header: 'bg-white dark:bg-[#191919]', border: 'border-slate-200 dark:border-white/10', prim: 'text-slate-700 dark:text-slate-300', inputBorder: 'border-slate-300 dark:border-white/10', panel: 'bg-white dark:bg-[#2c2c2c]', active: 'active:bg-slate-200 dark:active:bg-[#2c2c2c]', light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/20 text-slate-400', gift: 'bg-slate-100 border-slate-200 text-slate-700', transfer: 'bg-slate-100 border-slate-200 text-slate-700', gradient: 'from-slate-900/70 to-slate-800/50', borderLight: 'border-slate-200', borderDark: 'border-slate-500/30', textLight: 'text-slate-600', textDark: 'text-slate-300/70', bottomBg: 'bg-white/60', bottomBgDark: 'bg-black/20', bottomBorder: 'border-slate-200', bottomBorderDark: 'border-slate-500/20', bottomText: 'text-slate-600', bottomTextDark: 'text-slate-200/60' },
    green: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-900 dark:text-emerald-50', header: 'bg-emerald-100/50 dark:bg-emerald-900/50', border: 'border-emerald-200 dark:border-emerald-800', prim: 'text-emerald-700 dark:text-emerald-400', inputBorder: 'border-emerald-300 dark:border-emerald-700', panel: 'bg-emerald-100 dark:bg-emerald-900', active: 'active:bg-emerald-200 dark:active:bg-emerald-800', light: 'bg-emerald-100 text-emerald-600', dark: 'bg-emerald-500/20 text-emerald-400', gift: 'bg-emerald-100 border-emerald-200 text-emerald-700', transfer: 'bg-emerald-100 border-emerald-200 text-emerald-700', gradient: 'from-emerald-900/70 to-green-900/50', borderLight: 'border-emerald-200', borderDark: 'border-emerald-500/30', textLight: 'text-emerald-600', textDark: 'text-emerald-300/70', bottomBg: 'bg-white/60', bottomBgDark: 'bg-black/20', bottomBorder: 'border-emerald-200', bottomBorderDark: 'border-emerald-500/20', bottomText: 'text-emerald-600', bottomTextDark: 'text-emerald-200/60' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950', text: 'text-purple-900 dark:text-purple-50', header: 'bg-purple-100/50 dark:bg-purple-900/50', border: 'border-purple-200 dark:border-purple-800', prim: 'text-purple-700 dark:text-purple-400', inputBorder: 'border-purple-300 dark:border-purple-700', panel: 'bg-purple-100 dark:bg-purple-900', active: 'active:bg-purple-200 dark:active:bg-purple-800', light: 'bg-purple-100 text-purple-600', dark: 'bg-purple-500/20 text-purple-400', gift: 'bg-purple-100 border-purple-200 text-purple-700', transfer: 'bg-purple-100 border-purple-200 text-purple-700', gradient: 'from-purple-900/70 to-purple-800/50', borderLight: 'border-purple-200', borderDark: 'border-purple-500/30', textLight: 'text-purple-600', textDark: 'text-purple-300/70', bottomBg: 'bg-purple-200/60', bottomBgDark: 'bg-black/20', bottomBorder: 'border-purple-200', bottomBorderDark: 'border-purple-500/20', bottomText: 'text-purple-600', bottomTextDark: 'text-purple-200/60' },
    black: { bg: 'bg-zinc-100 dark:bg-black', text: 'text-zinc-900 dark:text-zinc-50', header: 'bg-zinc-200/50 dark:bg-zinc-900/50', border: 'border-zinc-300 dark:border-white/10', prim: 'text-zinc-700 dark:text-zinc-300', inputBorder: 'border-zinc-400 dark:border-white/20', panel: 'bg-zinc-200 dark:bg-[#191919]', active: 'active:bg-zinc-300 dark:active:bg-[#2c2c2c]', light: 'bg-zinc-100 text-zinc-600', dark: 'bg-zinc-500/20 text-zinc-400', gift: 'bg-zinc-100 border-zinc-200 text-zinc-700', transfer: 'bg-zinc-100 border-zinc-200 text-zinc-700', gradient: 'from-zinc-900/70 to-zinc-800/50', borderLight: 'border-zinc-200', borderDark: 'border-zinc-500/30', textLight: 'text-zinc-600', textDark: 'text-zinc-300/70', bottomBg: 'bg-white/60', bottomBgDark: 'bg/black/20', bottomBorder: 'border-zinc-200', bottomBorderDark: 'border-zinc-500/20', bottomText: 'text-zinc-600', bottomTextDark: 'text-zinc-200/60' },
    gray: { bg: 'bg-gray-50 dark:bg-gray-900', text: 'text-gray-900 dark:text-gray-50', header: 'bg-gray-200/50 dark:bg-gray-800/50', border: 'border-gray-200 dark:border-gray-700', prim: 'text-gray-700 dark:text-gray-300', inputBorder: 'border-gray-300 dark:border-gray-600', panel: 'bg-gray-200 dark:bg-gray-800', active: 'active:bg-gray-300 dark:active:bg-gray-700', light: 'bg-gray-100 text-gray-600', dark: 'bg-gray-500/20 text-gray-400', gift: 'bg-gray-100 border-gray-200 text-gray-700', transfer: 'bg-gray-100 border-gray-200 text-gray-700', gradient: 'from-gray-900/70 to-gray-800/50', borderLight: 'border-gray-200', borderDark: 'border-gray-500/30', textLight: 'text-gray-600', textDark: 'text-gray-300/70', bottomBg: 'bg-white/60', bottomBgDark: 'bg-black/20', bottomBorder: 'border-gray-200', bottomBorderDark: 'border-gray-500/20', bottomText: 'text-gray-600', bottomTextDark: 'text-gray-200/60' },
    yellow: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-900 dark:text-amber-50', header: 'bg-amber-100/50 dark:bg-amber-900/50', border: 'border-amber-200 dark:border-amber-800', prim: 'text-amber-700 dark:text-amber-400', inputBorder: 'border-amber-300 dark:border-amber-700', panel: 'bg-amber-100 dark:bg-amber-900', active: 'active:bg-amber-200 dark:active:bg-amber-800', light: 'bg-amber-100 text-amber-600', dark: 'bg-amber-500/20 text-amber-400', gift: 'bg-amber-100 border-amber-200 text-amber-700', transfer: 'bg-amber-100 border-amber-200 text-amber-700', gradient: 'from-amber-900/70 to-amber-800/50', borderLight: 'border-amber-200', borderDark: 'border-amber-500/30', textLight: 'text-amber-600', textDark: 'text-amber-300/70', bottomBg: 'bg-amber-200/60', bottomBgDark: 'bg-black/20', bottomBorder: 'border-amber-200', bottomBorderDark: 'border-amber-500/20', bottomText: 'text-amber-600', bottomTextDark: 'text-amber-200/60' },
  }
  return t[theme] || t.green;
};

const splitWechatReply = (text: string) => {
  const normalized = (text || '').replace(/\r/g, '').trim();
  if (!normalized) return [];
  const flattenPart = (part: string) => part.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  const rawLines = normalized.split('\n').map(line => line.trim()).filter(Boolean);
  const isChineseLine = (line: string) => /[\u4e00-\u9fff]/.test(line);
  const isLikelyBilingualPairs =
    rawLines.length >= 2 &&
    rawLines.length % 2 === 0 &&
    rawLines.every((line, index) => index % 2 === 0 ? isChineseLine(line) : !isChineseLine(line));

  if (isLikelyBilingualPairs) {
    const paired: string[] = [];
    for (let index = 0; index < rawLines.length; index += 2) {
      paired.push(`${rawLines[index]}\n${rawLines[index + 1]}`);
    }
    return paired.slice(0, 4);
  }

  if (rawLines.length > 1) {
    return rawLines.map(line => flattenPart(line)).filter(Boolean).slice(0, 4);
  }

  const workingText = flattenPart(normalized);

  const explicitParts = normalized
    .split(/\n\s*\n+/)
    .map(part => flattenPart(part))
    .filter(Boolean);

  if (explicitParts.length > 1) return explicitParts;

  const sentenceParts = workingText
    .split(/(?<=[。！？!?~～…]|💔|😭|🥺|😢|😡|😠|😂|🥲)\s*/)
    .map(part => part.trim())
    .filter(Boolean);

  if (sentenceParts.length <= 1) return explicitParts.length ? explicitParts : [workingText];

  const merged: string[] = [];
  let current = '';

  for (const sentence of sentenceParts) {
    const next = current ? `${current}${sentence}` : sentence;
    if (next.length <= 18) {
      current = next;
    } else {
      if (current) merged.push(current);
      current = sentence;
    }
  }

  if (current) merged.push(current);

  return merged.slice(0, 4);
};

const randomGiftFallback = (character: Character) => {
  const fallbackMap: Record<string, string[]> = {
    alfred: ['手工果酱司康', '伯爵红茶礼盒', '银边书签'],
    bruce: ['限量黑胶唱片', '深蓝丝巾', '皮质笔记本'],
    dick: ['夜跑耳机', '便携拍立得', '星空小夜灯'],
    jason: ['机车挂饰', '皮革手套', '辣味零食礼袋'],
    tim: ['手冲咖啡套装', '机械键帽', '数据线收纳盒'],
    damian: ['限定钢笔', '手工徽章', '小型艺术摆件'],
    barbara: ['电子阅读灯', '复古胶片相机', '紫色便签礼盒'],
    stephanie: ['彩虹糖礼盒', '毛绒钥匙扣', '香氛蜡烛'],
    cassandra: ['手工护腕', '静音八音盒', '黑色发绳礼盒'],
  };
  const pool = fallbackMap[character.id] || ['小礼物', '小礼盒', '定制礼物'];
  return pool[Math.floor(Math.random() * pool.length)];
};

const cleanGiftName = (text: string) =>
  (text || '')
    .replace(/```|[#*`_]/g, '')
    .replace(/^\[礼物\]\s*/g, '')
    .replace(/^礼物[:：]?\s*/g, '')
    .replace(/[。！？!?,，]+$/g, '')
    .trim();

const generateCharacterGiftName = async (character: Character, userMessage: string) => {
  try {
    const reply = cleanGiftName(await generateAIResponse(`你在扮演${character.name}（性格：${character.personality}）。
现在你想送我一个微信礼物。请根据这段聊天内容，临时想一个具体礼物名称：
${userMessage}

要求：
1. 只输出礼物名称本身，不要解释，不要句子，不要Markdown，不要前缀。
2. 礼物名称控制在4到12个字。
3. 要像真人会送的东西，允许自由发挥，不要总是同一种。`));
    if (reply && reply.length >= 2) return reply;
  } catch {}
  return randomGiftFallback(character);
};

const maybeCharacterGiftMessage = async (character: Character, userMessage: string, replyParts: string[]) => {
  if (replyParts.some(part => part.startsWith('[礼物]'))) return null;
  const text = userMessage.trim();
  if (!text) return null;

  const explicitGiftContext = /生日|诞辰|礼物|送我|纪念日|节日|圣诞|新年|跨年|毕业|考试|上岸|生病|不舒服|谢谢|辛苦|安慰/.test(text);
  const canGiftByRelation = (character.affection || 0) >= 65;
  const randomGiftChance = (character.affection || 0) >= 80 ? 0.18 : 0.08;

  if (!explicitGiftContext && Math.random() > randomGiftChance) return null;
  if (!explicitGiftContext && !canGiftByRelation) return null;

  return `[礼物] ${await generateCharacterGiftName(character, text)}`;
};

const resolveOpenedGiftName = (character: Character, giftName?: string) => {
  const raw = (giftName || '').trim();
  if (raw && !/神秘|礼盒|小礼盒|节日礼盒/.test(raw)) return raw;
  return randomGiftFallback(character);
};

const getGiftOpenNote = (giftName: string) => {
  if (/红茶|司康/.test(giftName)) return '看起来是认真挑过的，包装也很体面。';
  if (/黑胶|唱片/.test(giftName)) return '唱片封套很新，像是特地为你准备的。';
  if (/耳机|夜跑/.test(giftName)) return '很适合夜里一个人走路时用。';
  if (/咖啡/.test(giftName)) return '拆开就有很淡的香味。';
  if (/书签|钢笔|阅读灯/.test(giftName)) return '是会被长期留下来的那种礼物。';
  if (/糖|甜点|蛋糕/.test(giftName)) return '看着就让人心情变好一点。';
  return '礼物被你收下了。';
};

export default function ChatRoom({ characterId, onBack }: { characterId: string, onBack: () => void }) {
  const { characters, chats, sendMessage, receiveMessage, settings, updateWeChatBalance, updateChatMessage, sendAdvancedMessage, updateCharacter } = useAppStore();
  const character = characters[characterId];
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCharacterMoments, setShowCharacterMoments] = useState(false);
  const [pendingUserMessages, setPendingUserMessages] = useState(0);
  const [pendingUserMsgTimestamps, setPendingUserMsgTimestamps] = useState<number[]>([]);
  
  const [showAttach, setShowAttach] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [attachType, setAttachType] = useState<'transfer' | 'gift' | null>(null);
  const [activeGiftMessage, setActiveGiftMessage] = useState<Message | null>(null);
  const [activeTransferMessage, setActiveTransferMessage] = useState<Message | null>(null);
  const [voiceStatusText, setVoiceStatusText] = useState('');

  const allMessages = chats[characterId] || [];
  const messages = useMemo(() => {
    return [...allMessages].sort((a, b) => a.timestamp - b.timestamp);
  }, [allMessages]);
  
  if (!character) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-gray-500">
         <div>该角色已被删除</div>
         <button onClick={onBack} className="mt-4 px-6 py-2 bg-[#07c160] text-white font-medium rounded-lg">返回</button>
      </div>
    );
  }

  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [giftName, setGiftName] = useState('');
  const [payPass, setPayPass] = useState('');
  const [showPayPass, setShowPayPass] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  const [activeAudioMenu, setActiveAudioMenu] = useState<{ message: Message; x: number; y: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const recordingStartTimeRef = useRef(0);
  const [showTopMenu, setShowTopMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const followUpTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const pendingStopRef = useRef(false);
  const isDark = settings.wechatTheme === 'dark';
  const t = getT(settings.osTheme || 'green');

  const grayBubbleStyle = (isUserMessage: boolean) => ({
    backgroundColor: isDark
      ? (isUserMessage ? '#3a3a3a' : '#2b2b2b')
      : (isUserMessage ? '#e5e7eb' : '#f3f4f6'),
    color: isDark ? '#f5f5f5' : '#111827'
  });

  const cardClass = `mx-2 rounded-[18px] overflow-hidden flex flex-col w-[220px] border shadow-sm ${
    isDark ? 'bg-[#2b2b2b] border-white/10' : 'bg-[#f3f4f6] border-gray-300/80'
  }`;
  
  const transferCardClass = `mx-2 rounded-[18px] overflow-hidden flex flex-col w-[220px] border shadow-sm ${t.gift}`;
  const giftCardClass = `mx-2 rounded-[18px] overflow-hidden flex flex-col w-[220px] border shadow-sm ${t.gift}`;

  // 清理定时器
  const clearFollowUpTimer = () => {
    if (followUpTimerRef.current) {
      clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
  };

  // 发送跟进消息
  const sendFollowUpMessage = async () => {
    try {
      setIsTyping(true);
      const state = useAppStore.getState();
      const currentChar = state.characters[characterId];
      
      const history = state.chats[characterId] || [];
      const lastUserMessage = [...history].reverse().find(m => m.senderId === 'user');
      const pendingTimestamps = pendingUserMsgTimestamps;
      const lastPendingTs = pendingTimestamps.length > 0 ? Math.max(...pendingTimestamps) : 0;
      const minCharTimestamp = lastUserMessage ? Math.max(lastUserMessage.timestamp, lastPendingTs) + 1 : undefined;
      
      if (lastUserMessage) {
        const prompt = `刚刚我们在聊天，你发了最后一条消息后我没有回复。请你以${currentChar.name}的身份主动给我发消息，询问我在忙什么，或者关心我一下，或者继续刚才的话题。语气要自然，像真人一样，不要太刻意。`;
        const reply = (await getCharacterReply(characterId, prompt)).trim();
        if (reply) {
          receiveMessage(characterId, reply, minCharTimestamp);
          updateCharacter(characterId, { followUpSent: true });
        }
      }
    } catch (e) {
      console.error('跟进消息发送失败:', e);
    } finally {
      setIsTyping(false);
    }
  };

  useLayoutEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [characterId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: messages.length <= 1 ? 'auto' : 'smooth' });
  }, [messages, isTyping]);

  // 监听用户消息，设置跟进定时器
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.senderId === 'user') {
      // 用户发送了消息，更新时间并重置跟进状态
      updateCharacter(characterId, {
        lastUserMessageAt: Date.now(),
        followUpSent: false
      });
      
      // 清理旧定时器
      clearFollowUpTimer();
      
      // 设置新的跟进定时器（3-8分钟随机）
      const delayMinutes = 3 + Math.floor(Math.random() * 6);
      const delayMs = delayMinutes * 60 * 1000;
      
      followUpTimerRef.current = setTimeout(() => {
        const currentState = useAppStore.getState();
        const latestChar = currentState.characters[characterId];
        const latestHistory = currentState.chats[characterId] || [];
        const latestLastMessage = latestHistory[latestHistory.length - 1];
        
        // 检查是否还需要发送跟进消息
        if (latestLastMessage && latestLastMessage.senderId === 'user' && !latestChar.followUpSent) {
          sendFollowUpMessage();
        }
      }, delayMs);
    } else if (lastMessage && lastMessage.senderId !== 'user') {
      // 角色回复了，清理定时器
      clearFollowUpTimer();
    }
    
    return () => clearFollowUpTimer();
  }, [messages, characterId, updateCharacter]);

  const sendActionFollowup = async (prompt: string) => {
    try {
      const reply = (await getCharacterReply(characterId, prompt)).trim();
      if (reply) receiveMessage(characterId, reply);
    } catch {}
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.start();
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);

      // If user released before recorder was ready, stop immediately
      if (pendingStopRef.current) {
        pendingStopRef.current = false;
        setTimeout(() => handleStopRecording(), 50);
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      setIsRecording(false);
      setAudioBlob(null);
      setVoiceStatusText('麦克风不可用');
      setTimeout(() => setVoiceStatusText(''), 2000);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      const recordedType = mediaRecorderRef.current.mimeType || 'audio/webm';
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recordedType });
        setAudioBlob(blob);

        const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
        const audioUrl = URL.createObjectURL(blob);

        setVoiceStatusText('正在识别...');

        // 先发语音消息占位
        sendAdvancedMessage(characterId, {
          id: `${Date.now()}_user_voice`,
          senderId: 'user',
          text: '[语音]',
          type: 'audio',
          audioUrl,
          audioLabel: duration < 60 ? `${Math.floor(duration)}"`: `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}`,
          audioDuration: duration,
          timestamp: Date.now(),
        });

        // 异步转写 + 翻译（用户说英文 → 转英文 → 翻译中文）
        try {
          const voiceConfig = settings.voiceApiConfigs?.[0];
          if (voiceConfig?.apiKey && voiceConfig?.baseUrl) {
            const transcript = await speechToText(blob, 'en');
            if (transcript) {
              const translation = await translateText(transcript, '中文');
              setVoiceStatusText(`识别: ${transcript}`);
              // 查找刚发的语音消息，更新转录和翻译
              const msgs = useAppStore.getState().chats[characterId] || [];
              const lastAudio = [...msgs].reverse().find(m => m.type === 'audio' && m.senderId === 'user');
              if (lastAudio) {
                updateChatMessage(characterId, lastAudio.id, {
                  audioTranscription: transcript,
                  audioTranslation: translation,
                  audioLabel: transcript.length > 30 ? transcript.slice(0, 30) + '…' : transcript,
                });
              }
              // 把翻译后的中文作为文字消息发给角色触发回复
              if (translation) {
                handleSend(translation);
              }
            } else {
              setVoiceStatusText('');
            }
          } else {
            setVoiceStatusText('');
          }
        } catch {
          setVoiceStatusText('');
        }

        streamRef.current?.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };
      mediaRecorderRef.current.stop();
    } else {
      // Recorder not ready yet — will stop once it starts
      pendingStopRef.current = true;
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setAudioBlob(null);
      };
      mediaRecorderRef.current.stop();
    } else {
      streamRef.current?.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setAudioBlob(null);
    }
  };

  const pendingVoiceMsgRef = useRef<Map<string, string>>(new Map());

  const appendUserVoiceMessage = (payload: { audioUrl: string; transcript?: string; duration?: number }) => {
    const { audioUrl, transcript, duration } = payload;

    if (transcript) {
      const existingId = pendingVoiceMsgRef.current.get(audioUrl);
      if (existingId) {
        updateChatMessage(characterId, existingId, {
          audioTranscription: transcript,
          audioLabel: transcript.length > 30 ? transcript.slice(0, 30) + '…' : transcript,
        });
        pendingVoiceMsgRef.current.delete(audioUrl);
      }
      return;
    }

    const formatDuration = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const id = `${Date.now()}_user_voice`;
    pendingVoiceMsgRef.current.set(audioUrl, id);
    sendAdvancedMessage(characterId, {
      id,
      senderId: 'user',
      text: '[语音]',
      type: 'audio',
      audioUrl,
      audioLabel: duration ? formatDuration(duration) : '语音消息',
      audioDuration: duration,
      timestamp: Date.now(),
    });
  };

  const appendCharacterVoiceMessage = (payload: { audioUrl: string; replyText?: string; translation?: string }) => {
    sendAdvancedMessage(characterId, {
      id: `${Date.now()}_char_voice`,
      senderId: characterId,
      text: payload.replyText || '[语音回复]',
      type: 'audio',
      audioUrl: payload.audioUrl,
      audioLabel: payload.replyText ? `语音回复：${payload.replyText}` : '语音回复',
      audioTranscription: payload.replyText,
      audioTranslation: payload.translation,
      timestamp: Date.now(),
    });
  };

  const handleSend = async (textOverride?: string, imgUrl?: string, stickerUrl?: string) => {
    const textToSend = textOverride !== undefined ? textOverride : inputText;
    if (!textToSend.trim() && !imgUrl && !stickerUrl) return;
    
    setInputText('');
    setShowAttach(false);
    setAttachType(null);
    
    const userTimestamp = Date.now();
    setPendingUserMsgTimestamps(prev => [...prev, userTimestamp]);
    
    sendMessage(characterId, textToSend, imgUrl, stickerUrl, userTimestamp);
    
    setIsTyping(true);
    try {
      let promptText = textToSend;
      let images: { mimeType: string; data: string }[] | undefined;
      if (imgUrl) {
        promptText += ` [发送了一张图片]`;
        const mimeMatch = imgUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (mimeMatch) {
          images = [{ mimeType: mimeMatch[1], data: mimeMatch[2] }];
        }
      }
      if (stickerUrl) promptText += ` [发送了一个表情包]`;

      const reply = await getCharacterReply(characterId, promptText, { images });
      const parts = splitWechatReply(reply);
      const existingGiftPart = parts.find(part => part.startsWith('[礼物]'));
      const shouldAddGift = !existingGiftPart && Math.random() < 0.1 && (character.affection || 0) >= 65;
      let giftPart: string | null = null;
      if (shouldAddGift) {
        giftPart = `[礼物] ${await generateCharacterGiftName(character, textToSend)}`;
      }
      const finalParts = giftPart ? [...parts, giftPart] : parts;
      
      const currentPendingTimestamps = [...pendingUserMsgTimestamps];
      const minCharTimestamp = currentPendingTimestamps.length > 0 ? Math.max(...currentPendingTimestamps) : undefined;
      
      for (let i = 0; i < finalParts.length; i++) {
        const part = finalParts[i].trim();
        if (part.startsWith('[礼物]') && !part.includes('已添加')) {
           useAppStore.getState().addWeChatGift({
             id: Date.now().toString() + Math.random(),
             name: part.replace('[礼物]', '').trim(),
             senderId: characterId,
             timestamp: Date.now()
           });
        }
        
        receiveMessage(characterId, part, minCharTimestamp);
        
        if (i < finalParts.length - 1) {
          setIsTyping(true);
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      
      setPendingUserMsgTimestamps([]);

      // 如果角色启用了语音回复，为每条回复生成英文语音 + 中文翻译
      if (character?.voiceReplyEnabled && !textOverride) {
        try {
          const voiceConfig = settings.voiceApiConfigs?.find(c => c.characterId === characterId) || settings.voiceApiConfigs?.[0];
          if (voiceConfig?.apiKey && voiceConfig?.baseUrl) {
            for (const part of finalParts) {
              const cleanText = part.replace(/\[.*?\]/g, '').trim();
              if (!cleanText) continue;
              const audioUrl = await textToSpeech(cleanText, voiceConfig.voiceId);
              const translation = await translateText(cleanText, '中文');
              appendCharacterVoiceMessage({ audioUrl, replyText: cleanText, translation });
            }
          }
        } catch {}
      }
    } catch (error: any) {
      receiveMessage(characterId, `[系统提示: ${error.message}]`);
    } finally {
      setIsTyping(false);
      setPendingUserMsgTimestamps([]);
    }
  };

  const handleAudioLongPress = (message: Message, x: number, y: number) => {
    setActiveAudioMenu({ message, x, y });
  };

  const handleCopyTranscription = () => {
    if (activeAudioMenu?.message.audioTranscription) {
      navigator.clipboard.writeText(activeAudioMenu.message.audioTranscription);
      setActiveAudioMenu(null);
    }
  };

  const handleDeleteAudio = () => {
    if (activeAudioMenu?.message) {
      updateChatMessage(characterId, activeAudioMenu.message.id, {
        type: 'system',
        text: '[系统] 语音消息已删除',
      });
      setActiveAudioMenu(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeAudioMenu) {
        setActiveAudioMenu(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeAudioMenu]);

  if (showSettings) {
    return <CharacterSettings characterId={characterId} onBack={() => setShowSettings(false)} />;
  }

  if (showCharacterMoments) {
    return <CharacterMoments characterId={characterId} onBack={() => setShowCharacterMoments(false)} />;
  }

  return (
    <div 
      className="h-full flex flex-col dark:bg-black dark:text-gray-100 absolute inset-0 z-50"
      style={{ background: character.background.startsWith('#') && character.background !== '#ffffff' && character.background !== '#f3f4f6' ? character.background : undefined, backgroundImage: !character.background.startsWith('#') ? `url(${character.background})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="bg-gray-100/90 dark:bg-black/90 backdrop-blur px-4 pt-14 pb-3 flex items-center justify-between border-b dark:border-white/5 shrink-0 z-10">
        <button onClick={onBack} className="p-1 -ml-1 text-gray-800 dark:text-gray-100"><ChevronLeft size={24} /></button>
        <h1 className="text-lg font-medium dark:text-gray-100">{character.remark || character.name}</h1>
        <div className="relative">
          <button onClick={() => setShowTopMenu(!showTopMenu)} className="p-1 -mr-1 text-gray-800 dark:text-gray-100"><MoreHorizontal size={24} /></button>
          {showTopMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#2c2c2c] rounded-lg shadow-lg border dark:border-white/10 py-1 min-w-[120px] z-50">
              <button
                onClick={() => { setShowTopMenu(false); setShowCharacterMoments(true); }}
                className="w-full px-4 py-2.5 text-left text-sm dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#333]"
              >
                朋友圈
              </button>
              <button
                onClick={() => { setShowTopMenu(false); setShowSettings(true); }}
                className="w-full px-4 py-2.5 text-left text-sm dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#333]"
              >
                设置
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={messageListRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {messages.map((msg, index) => {
           const isUser = msg.senderId === 'user';
           const isTransfer = msg.text?.startsWith('[转账]');
           const isGift = msg.text?.startsWith('[礼物]');
           const isSystem = msg.type === 'system' || msg.text?.startsWith('[系统]');
           const isAudio = msg.type === 'audio' && !!msg.audioUrl;
           
           let showTime = false;
           if (index === 0) {
             showTime = true;
           } else {
             const prevMsg = messages[index - 1];
             if (msg.timestamp - prevMsg.timestamp > 5 * 60 * 1000) {
               showTime = true;
             }
           }
           
           const renderMessageText = (text: string, isUserMessage: boolean) => {
             if (settings.bilingual && !isUserMessage) {
               const lines = text.split('\n').filter(l => l.trim() !== '');
               if (lines.length === 2) {
                 return (
                   <div className="flex flex-col gap-0">
                     <div className="text-[15px] leading-8 text-inherit">{lines[0]}</div>
                     <div className="my-3 border-t border-white/12 dark:border-white/12" />
                     <div className="text-[14px] leading-8 text-white/72 dark:text-white/72">{lines[1]}</div>
                   </div>
                 );
               }
             }
             return text;
           };
           
           return (
             <React.Fragment key={msg.id}>
               {showTime && (
                 <div className="text-center text-[11px] text-gray-400 dark:text-gray-500 my-2">
                   {new Date(msg.timestamp).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                 </div>
               )}
               {isSystem ? (
                 <div className="flex justify-center">
                   <div className="max-w-[82%] rounded-full bg-black/8 dark:bg-white/10 px-4 py-2 text-[12px] text-gray-500 dark:text-gray-300 text-center">
                     {msg.text.replace('[系统]', '').trim()}
                   </div>
                 </div>
               ) : (
               <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div 
                  className="w-10 h-10 rounded-md flex-shrink-0"
                  style={{ 
                    background: isUser 
                      ? (settings.wechatAvatar.startsWith('#') ? settings.wechatAvatar : `url(${settings.wechatAvatar}) center/cover`)
                      : (character.avatar.startsWith('#') ? character.avatar : `url(${character.avatar}) center/cover`) 
                  }}
                />
                
                {isTransfer ? (
                  <button
                    type="button"
                    onClick={() => setActiveTransferMessage(msg)}
                    className={`${transferCardClass} text-left cursor-pointer active:scale-[0.99]`}
                  >
                    <div className="flex items-center gap-3 p-3.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold shrink-0 ${t.gift}`}>¥</div>
                      <div className="flex-1 overflow-hidden text-inherit">
                        <div className="text-[15px] font-semibold leading-tight mb-0.5 truncate">{msg.text?.replace('[转账] ', '').split(' - ')[0]}</div>
                        <div className={`text-[11px] truncate ${t.prim}`}>{msg.text?.includes(' - ') ? msg.text.split(' - ')[1] : '微信转账'}</div>
                      </div>
                    </div>
                    <div className={`px-3.5 py-2 flex justify-between items-center text-[10px] border-t border-inherit ${t.prim}`}>
                      <span>
                        {isUser
                          ? msg.transferStatus === 'returned' ? '已退回' : msg.transferStatus === 'received' ? '对方已收款' : '待对方收款'
                          : msg.transferStatus === 'received' ? '已收款'
                          : msg.transferStatus === 'returned' ? '已退还'
                          : '点击查看转账'}
                      </span>
                    </div>
                  </button>
                ) : isGift ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isUser && msg.giftStatus !== 'opened') {
                        const revealedGiftName = resolveOpenedGiftName(character, msg.giftName || msg.text.replace('[礼物]', '').trim());
                        updateChatMessage(characterId, msg.id, { giftStatus: 'opened', giftName: revealedGiftName });
                        sendMessage(characterId, `[系统] 你领取了礼物：${revealedGiftName}`);
                        void sendActionFollowup(`我刚刚收下并拆开了你送的礼物，发现里面是“${revealedGiftName}”。请你只用2到4条很短的微信消息，像真人一样回复我，内容要和我刚刚拆礼物这件事直接相关。`);
                        setActiveGiftMessage({ ...msg, giftStatus: 'opened', giftName: revealedGiftName });
                        return;
                      }
                      setActiveGiftMessage(msg);
                    }}
                    className={`${giftCardClass} text-left cursor-pointer active:scale-[0.99]`}
                  >
                    <div className="flex items-center gap-3 p-3.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 ${t.gift}`}>🎁</div>
                      <div className="flex-1 overflow-hidden text-inherit">
                        <div className="text-[15px] font-semibold leading-tight mb-0.5 truncate">{msg.giftStatus === 'opened' ? '已拆开的礼物' : '微信礼物'}</div>
                        <div className={`text-[11px] truncate ${t.prim}`}>{msg.giftStatus === 'opened' ? (msg.giftName || msg.text?.replace('[礼物] ', '')) : msg.text?.replace('[礼物] ', '')}</div>
                      </div>
                    </div>
                    <div className={`px-3.5 py-2 flex justify-between items-center text-[10px] border-t border-inherit ${t.prim}`}>
                      <span>
                        {isUser
                          ? msg.giftStatus === 'opened' ? '礼物已送出' : '待对方领取'
                          : msg.giftStatus === 'opened' ? '礼物已拆开' : '点击拆开礼物'}
                      </span>
                    </div>
                  </button>
                ) : isAudio ? (
                  <div className={`mx-2 flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <div
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleAudioLongPress(msg, e.clientX, e.clientY);
                      }}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        const timer = window.setTimeout(() => {
                          handleAudioLongPress(msg, touch.clientX, touch.clientY);
                        }, 500);
                        setLongPressTimer(timer);
                      }}
                      onTouchEnd={() => {
                        if (longPressTimer) {
                          clearTimeout(longPressTimer);
                          setLongPressTimer(null);
                        }
                      }}
                      onTouchCancel={() => {
                        if (longPressTimer) {
                          clearTimeout(longPressTimer);
                          setLongPressTimer(null);
                        }
                      }}
                      onClick={() => {
                        if (msg.audioUrl) {
                          const audio = new Audio(msg.audioUrl);
                          void audio.play().catch(() => {});
                        }
                      }}
                      className={`min-w-[132px] max-w-[220px] rounded-[18px] px-4 py-3 flex items-center gap-3 text-left cursor-pointer active:scale-[0.98] transition-transform select-none ${
                        isUser ? (isDark ? 'bg-[#3a3a3a] text-white' : 'bg-[#e5e7eb] text-slate-800') : 'bg-white dark:bg-[#2b2b2b] text-slate-800 dark:text-white'
                      }`}
                    >
                      {isUser ? (
                        <>
                          <div className={`text-[11px] font-medium ${isUser ? 'text-slate-600 dark:text-white/80' : 'text-slate-500 dark:text-white/60'}`}>
                            {msg.audioLabel || '1:00'}
                          </div>
                          <div className="flex-1 flex items-center gap-1 justify-end">
                            {[...Array(8)].map((_, i) => (
                              <div
                                key={i}
                                className={`w-1 rounded-full transition-all duration-150 ${
                                  isUser ? 'bg-slate-700 dark:bg-white' : 'bg-gray-400 dark:bg-gray-500'
                                }`}
                                style={{
                                  height: `${4 + Math.random() * 12}px`,
                                  animationDelay: `${i * 0.1}s`,
                                }}
                              />
                            ))}
                          </div>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isUser ? 'bg-slate-200 dark:bg-slate-700' : 'bg-slate-100 dark:bg-white/10'
                          }`}>
                            <Volume2 size={15} className="text-slate-700 dark:text-white" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isUser ? 'bg-slate-200 dark:bg-slate-700' : 'bg-slate-100 dark:bg-white/10'
                          }`}>
                            <Volume2 size={15} className="text-slate-700 dark:text-white" />
                          </div>
                          <div className="flex-1 flex items-center gap-1">
                            {[...Array(8)].map((_, i) => (
                              <div
                                key={i}
                                className={`w-1 rounded-full transition-all duration-150 ${
                                  isUser ? 'bg-slate-700 dark:bg-white' : 'bg-gray-400 dark:bg-gray-500'
                                }`}
                                style={{
                                  height: `${4 + Math.random() * 12}px`,
                                  animationDelay: `${i * 0.1}s`,
                                }}
                              />
                            ))}
                          </div>
                          <div className={`text-[11px] font-medium ${isUser ? 'text-slate-600 dark:text-white/80' : 'text-slate-500 dark:text-white/60'}`}>
                            {msg.audioLabel || '1:00'}
                          </div>
                        </>
                      )}
                    </div>
                    {msg.audioTranscription && isUser && (
                      <div className={`mt-1 px-3 py-1.5 text-[12px] leading-relaxed rounded-xl max-w-[260px] ${
                        isUser
                          ? (isDark ? 'bg-slate-700/60 text-white' : 'bg-slate-200/60 text-slate-700')
                          : 'bg-white/80 dark:bg-white/10 text-slate-600 dark:text-gray-300'
                      }`}>
                        {msg.audioTranscription}
                      </div>
                    )}
                    {msg.audioTranscription && !isUser && (
                      <div className={`mt-1 px-3 py-2 text-[12px] leading-relaxed rounded-xl max-w-[260px] ${
                        isUser
                          ? (isDark ? 'bg-slate-700/60 text-white' : 'bg-slate-200/60 text-slate-700')
                          : 'bg-white/80 dark:bg-white/10 text-slate-600 dark:text-gray-300'
                      }`}>
                        <div className="text-[13px] font-medium">{msg.audioTranscription}</div>
                        {msg.audioTranslation && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-200/50 dark:border-white/10 text-[11px] text-slate-500 dark:text-gray-400">
                            🌐 {msg.audioTranslation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`mx-2 p-3 rounded-lg text-[15px] leading-relaxed whitespace-pre-wrap break-words break-all overflow-hidden ${msg.imageUrl || msg.stickerUrl ? 'bg-transparent p-0' : ''}`}
                       style={(!msg.imageUrl && !msg.stickerUrl) ? grayBubbleStyle(isUser) : {}}>
                    {msg.text && (
                      <div
                        className={(msg.imageUrl || msg.stickerUrl) ? `p-3 rounded-[16px] mb-1.5 ${isDark ? 'bg-[#2b2b2b]' : 'bg-[#f3f4f6]'}` : ''}
                        style={(msg.imageUrl || msg.stickerUrl) ? grayBubbleStyle(isUser) : {}}
                      >
                        {renderMessageText(msg.text, isUser)}
                      </div>
                    )}
                    {msg.imageUrl && (
                      <div className={cardClass.replace('mx-2 ', '')}>
                        <img src={msg.imageUrl} alt="image" className="max-w-[220px] h-auto rounded-t-[18px] object-cover" />
                        <div className={`px-3.5 py-2 text-[10px] border-t ${isDark ? 'text-white/45 border-white/10 bg-black/10' : 'text-slate-500 border-slate-200 bg-white/70'}`}>图片消息</div>
                      </div>
                    )}
                    {msg.stickerUrl && <img src={msg.stickerUrl} alt="sticker" className="w-24 h-24 object-contain" />}
                  </div>
                )}
              </div>
            </div>
               )}
          </React.Fragment>
          );
        })}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex max-w-[75%] flex-row">
              <div 
                className="w-10 h-10 rounded-md flex-shrink-0"
                style={{ background: character.avatar.startsWith('#') ? character.avatar : `url(${character.avatar}) center/cover` }}
              />
              <div className="mx-2 p-3 rounded-lg text-sm bg-white dark:bg-[#2c2c2c] dark:text-gray-300 text-gray-500">
                正在输入...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-gray-50 dark:bg-[#191919] border-t dark:border-white/5 p-3 pb-safe flex flex-col shrink-0 relative z-10 transition-all">
        <div className="flex items-center gap-2 min-w-0">
          <VoiceRecorderButton
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
            onCancelRecording={handleCancelRecording}
            isEnabled={true}
          />
          <button 
            onClick={() => { setShowStickers(!showStickers); setShowAttach(false); }}
            className="text-gray-800 dark:text-gray-100 shrink-0"
          >
            <Smile size={28} />
          </button>
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 min-w-0 h-10 bg-white dark:bg-[#2c2c2c] dark:text-gray-100 rounded-lg px-3 outline-none text-[15px]"
            placeholder="发送消息..."
          />
          <button 
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isTyping}
            className="bg-slate-700 text-white w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 shrink-0"
          >
            <Send size={20} />
          </button>
          <button 
            onClick={() => { setShowAttach(!showAttach); setShowStickers(false); }}
            className="text-gray-800 dark:text-gray-100 shrink-0"
          >
            <Plus size={28} />
          </button>
        </div>
        {voiceStatusText && (
          <div className="mt-2 text-[11px] leading-4 text-gray-500 dark:text-gray-400 px-1">
            {voiceStatusText}
          </div>
        )}
        
        {showStickers && (
          <div className="mt-4 pt-4 border-t dark:border-white/5 h-48 overflow-y-auto w-full px-2 pb-2">
            <div className="grid grid-cols-4 gap-2">
              {useAppStore.getState().stickers.length === 0 ? (
                <div className="col-span-4 text-center text-gray-400 text-sm py-4">暂无表情包，请在“我”中添加</div>
              ) : (
                useAppStore.getState().stickers.map((url, i) => (
                  <img 
                    key={i} 
                    src={url} 
                    alt="sticker" 
                    className="w-full aspect-square object-cover rounded cursor-pointer border border-gray-200 dark:border-white/10"
                    onClick={() => handleSend('', undefined, url)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {showAttach && (
          <div className="mt-4 pt-4 border-t dark:border-white/5 pb-2 px-4 h-48">
            <div className="grid grid-cols-4 gap-x-6 gap-y-4">
              <ImageUploader onImageSelected={(url) => handleSend('', url, undefined)} className="flex flex-col items-center gap-1 cursor-pointer">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${t.light}`}>
                  <ImageIcon size={28} />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">照片</span>
              </ImageUploader>
              <button onClick={() => { setAttachType('transfer'); setShowAttach(false); }} className="flex flex-col items-center gap-1">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${t.transfer}`}>
                  <span className="font-bold text-2xl">¥</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">转账</span>
              </button>
              <button onClick={() => { setAttachType('gift'); setShowAttach(false); }} className="flex flex-col items-center gap-1">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${t.gift}`}>
                  <span className="font-bold text-2xl">🎁</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">礼物</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {attachType === 'transfer' && (
        <div className="absolute inset-0 z-50 bg-gray-100 dark:bg-black p-4 flex flex-col pt-14 text-slate-800 dark:text-white">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setAttachType(null)} className="p-1"><ChevronLeft size={24} /></button>
            <h2 className="text-xl font-medium">发起转账</h2>
          </div>
          <div className="bg-white dark:bg-[#191919] rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
            <div className="flex items-center gap-2 border-b dark:border-white/10 pb-2">
              <span className="text-2xl font-medium">¥</span>
              <input 
                type="number" 
                value={transferAmount}
                onChange={e => setTransferAmount(e.target.value)}
                className="flex-1 text-3xl bg-transparent outline-none"
                placeholder="0.00"
              />
            </div>
            <input 
              type="text" 
              value={transferNote}
              onChange={e => setTransferNote(e.target.value)}
              className="w-full bg-transparent outline-none text-sm text-gray-500"
              placeholder="添加转账说明"
            />
            <button 
              onClick={() => {
                 setPendingAction(() => () => {
                   useAppStore.getState().updateWeChatBalance(useAppStore.getState().wechatBalance - parseFloat(transferAmount));
                   handleSend(`[转账] ¥${transferAmount} - ${transferNote || '转账'}`);
                 });
                 setShowPayPass(true);
              }}
              disabled={!transferAmount || parseFloat(transferAmount) <= 0}
              className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg p-3 font-medium disabled:opacity-50 shadow-lg"
            >
              转账
            </button>
          </div>
        </div>
      )}

      {attachType === 'gift' && (
        <div className="absolute inset-0 z-50 bg-gray-100 dark:bg-black p-4 flex flex-col pt-14 text-slate-800 dark:text-white">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setAttachType(null)} className="p-1"><ChevronLeft size={24} /></button>
            <h2 className="text-xl font-medium">送礼物</h2>
          </div>
          <div className="bg-white dark:bg-[#191919] rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
            <input 
              type="text" 
              value={giftName}
              onChange={e => setGiftName(e.target.value)}
              className="w-full border-b dark:border-white/10 p-2 text-lg bg-transparent outline-none"
              placeholder="礼物名称 / 寄语"
            />
            <button 
              onClick={() => {
                 setPendingAction(() => () => handleSend(`[礼物] ${giftName || '神秘礼物'}`));
                 setShowPayPass(true);
              }}
              disabled={!giftName}
              className="mt-4 bg-rose-500 hover:bg-rose-600 text-white rounded-lg p-3 font-medium disabled:opacity-50 shadow-lg"
            >
              送礼物
            </button>
          </div>
        </div>
      )}

      {activeGiftMessage && (
        <div className="absolute inset-0 z-[60] bg-black/35 flex items-end" onClick={() => setActiveGiftMessage(null)}>
          <div className="w-full rounded-t-[2rem] bg-white dark:bg-[#191919] p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-4xl mb-2">🎁</div>
              <div className="font-bold text-lg">{activeGiftMessage.giftName || activeGiftMessage.text.replace('[礼物]', '').trim()}</div>
              <div className="text-sm text-gray-500 mt-1">{activeGiftMessage.senderId === 'user' ? '你送出的礼物' : `${character.remark || character.name}送给你的礼物`}</div>
              <div className="text-sm text-slate-600 mt-3 leading-6">{getGiftOpenNote(activeGiftMessage.giftName || activeGiftMessage.text.replace('[礼物]', '').trim())}</div>
            </div>
            <button onClick={() => setActiveGiftMessage(null)} className="w-full rounded-2xl bg-slate-900 text-white py-3 font-bold">收下礼物</button>
          </div>
        </div>
      )}

      {activeTransferMessage && (
        <div className="absolute inset-0 z-[60] bg-black/35 flex items-end" onClick={() => setActiveTransferMessage(null)}>
          <div className="w-full rounded-t-[2rem] bg-white dark:bg-[#191919] p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-4xl mb-2">¥</div>
              <div className="font-bold text-2xl">{activeTransferMessage.text.replace('[转账] ', '').split(' - ')[0]}</div>
              <div className="text-sm text-gray-500 mt-1">{activeTransferMessage.text.includes(' - ') ? activeTransferMessage.text.split(' - ')[1] : '微信转账'}</div>
            </div>

            {activeTransferMessage.senderId !== 'user' && activeTransferMessage.transferStatus === 'pending' ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    updateWeChatBalance(useAppStore.getState().wechatBalance + (activeTransferMessage.amount || 0));
                    updateChatMessage(characterId, activeTransferMessage.id, { transferStatus: 'received' });
                    sendMessage(characterId, `[系统] 你已收款 ${activeTransferMessage.text.replace('[转账] ', '').split(' - ')[0]}`);
                    void sendActionFollowup(`我刚刚收下了你发来的转账，金额是${activeTransferMessage.text.replace('[转账] ', '').split(' - ')[0]}。请你只用2到4条很短的微信消息，像真人一样回复我，内容要和我刚刚收款这件事直接相关。`);
                    setActiveTransferMessage(null);
                  }}
                  className="rounded-2xl bg-slate-900 text-white py-3 font-bold"
                >
                  收款
                </button>
                <button
                  onClick={() => {
                    updateChatMessage(characterId, activeTransferMessage.id, { transferStatus: 'returned' });
                    sendMessage(characterId, `[系统] 你已退还 ${activeTransferMessage.text.replace('[转账] ', '').split(' - ')[0]}`);
                    void sendActionFollowup(`我刚刚把你发来的转账退还了，金额是${activeTransferMessage.text.replace('[转账] ', '').split(' - ')[0]}。请你只用2到4条很短的微信消息，像真人一样回复我，内容要和我刚刚退款这件事直接相关。`);
                    setActiveTransferMessage(null);
                  }}
                  className="rounded-2xl bg-stone-100 text-slate-700 py-3 font-bold"
                >
                  退还
                </button>
              </div>
            ) : (
              <div className="rounded-2xl bg-stone-100 dark:bg-white/5 px-4 py-4 text-sm text-center text-gray-500">
                {activeTransferMessage.senderId === 'user'
                  ? activeTransferMessage.transferStatus === 'returned' ? '这笔转账已退回。' : '这笔转账已经发出，等待对方收款。'
                  : activeTransferMessage.transferStatus === 'received' ? '这笔转账你已经收下了。' : '这笔转账已经退还。'}
              </div>
            )}

            <button onClick={() => setActiveTransferMessage(null)} className="w-full rounded-2xl bg-stone-100 dark:bg-white/5 py-3 font-bold text-slate-700 dark:text-white">关闭</button>
          </div>
        </div>
      )}

      {/* Pay Passcode Overlay */}
      {showPayPass && (
        <div className="absolute inset-0 z-[100] bg-black/50 flex flex-col items-center justify-center p-4">
          <div className="bg-white dark:bg-[#2a2a2a] w-full max-w-[280px] rounded-xl overflow-hidden flex flex-col items-center pt-6 pb-4">
             <h3 className="text-base font-medium text-gray-800 dark:text-gray-100 mb-4">请输入支付密码</h3>
             <input
               type="password"
               maxLength={6}
               autoFocus
               value={payPass}
               onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setPayPass(val);
                  
                  if (val.length === 6) {
                     const expected = settings.wechatPaymentPasscode || settings.passcode;
                     if (!expected || val === expected) {
                        setShowPayPass(false);
                        setPayPass('');
                        if (pendingAction) {
                           pendingAction();
                           setPendingAction(null);
                        }
                     } else {
                        setPayPass('');
                        alert('密码错误');
                     }
                  }
               }}
               className="w-[200px] bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-600 rounded-lg p-3 tracking-[0.5em] font-mono text-center text-lg outline-none focus:border-slate-500 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
               placeholder="六位数字"
             />
             <button onClick={() => { setShowPayPass(false); setPayPass(''); }} className="mt-6 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">取消</button>
          </div>
        </div>
      )}

      {activeAudioMenu && (
        <div 
          className="fixed z-[100] bg-slate-800 rounded-xl shadow-xl py-2 min-w-[160px]"
          style={{ 
            left: Math.min(activeAudioMenu.x, window.innerWidth - 180), 
            top: Math.min(activeAudioMenu.y, window.innerHeight - 150) 
          }}
        >
          <button
            onClick={handleCopyTranscription}
            disabled={!activeAudioMenu.message.audioTranscription}
            className="w-full px-4 py-2 text-left text-white text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔤 转换为文字
          </button>
          <button
            onClick={() => {
              if (activeAudioMenu.message.audioTranscription) {
                navigator.clipboard.writeText(activeAudioMenu.message.audioTranscription);
                setActiveAudioMenu(null);
              }
            }}
            disabled={!activeAudioMenu.message.audioTranscription}
            className="w-full px-4 py-2 text-left text-white text-sm hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📋 复制文字
          </button>
          <button
            onClick={handleDeleteAudio}
            className="w-full px-4 py-2 text-left text-red-400 text-sm hover:bg-slate-700"
          >
            🗑️ 删除消息
          </button>
        </div>
      )}
    </div>
  );
}
