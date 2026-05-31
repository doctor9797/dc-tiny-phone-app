import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Users, Compass, User } from 'lucide-react';
import { useAppStore } from '../../store';
import ChatList from './ChatList';
import Contacts from './Contacts';
import Moments from './Moments';
import Me from './Me';
import ChatRoom from './ChatRoom';
import GroupChatRoom from './GroupChatRoom';
import { generateAIResponse, extractImageData } from '../../lib/ai';
import PhoneCheck from '../PhoneCheck';
import { decidePhoneCheck } from '../PhoneCheck/data';
import type { CharPhoneCheckMode } from '../../types';

export default function WeChatApp() {
  const { settings, updateSettings, characters, addMoment, addCharacterMemory, sendMessage, receiveMessage } = useAppStore();
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'moments' | 'me'>('chats');
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeGroupChat, setActiveGroupChat] = useState<string | null>(null);
  const momentsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [phoneCheckSession, setPhoneCheckSession] = useState<{ characterId: string; userMessage: string; grab?: boolean } | null>(null);
  const [phoneCheckRefusal, setPhoneCheckRefusal] = useState<{ characterId: string; userMessage: string; reply: string } | null>(null);
  // ── Character Phone Check (角色查我手机) ──
  const [charPhoneCheckPrompt, setCharPhoneCheckPrompt] = useState<{ characterId: string; userMessage: string } | null>(null);
  const charPhoneCheckTimerRef = useRef<number | null>(null);

  const isDark = settings.wechatTheme === 'dark';

  // Handle opening chat from notification
  React.useEffect(() => {
    if ((settings as any).activeWeChatCharId) {
      setActiveChat((settings as any).activeWeChatCharId);
      setActiveTab('chats');
      updateSettings({ activeWeChatCharId: null } as any);
    }
    if ((settings as any).activeWeChatTab) {
      setActiveTab((settings as any).activeWeChatTab);
      setActiveChat(null);
      updateSettings({ activeWeChatTab: null } as any);
    }
  }, [(settings as any).activeWeChatCharId, (settings as any).activeWeChatTab, updateSettings]);

  // Track last moment author to prevent same person posting twice in a row
  const lastMomentAuthorRef = useRef<string | null>(null);

  // Moment scheduling: each character posts momentsFrequency times per day, spread across 24h
  useEffect(() => {
    if (momentsTimerRef.current) return;

    const generateOneMoment = async (charId: string, char: any, timestamp?: number) => {
      try {
        const poster = { id: charId, name: char.name, personality: char.personality, relationship: char.relationship, biography: char.biography };
        const content = await generateAIResponse(`你正在扮演${poster.name}。性格：${poster.personality || '普通'}，关系：${poster.relationship || '朋友'}。${poster.biography ? '背景：' + poster.biography : ''}
请以${poster.name}的身份发一条朋友圈（公开状态，不是私信）。内容适合所有人看，不要用"你"直接对话。1-2句话，日常向。只输出内容，不要加引号。`);
        if (content?.trim()) {
          const ts = timestamp ?? Date.now();
          useAppStore.getState().addMoment({ authorId: charId, content: content.trim(), timestamp: ts });
          const summary = content.trim().length > 60 ? content.trim().slice(0, 60) + '…' : content.trim();
          useAppStore.getState().addCharacterMemory(charId, {
            type: 'event',
            content: `发了朋友圈：${summary}`,
            summary: `发了朋友圈：${summary}`,
            tags: ['朋友圈', 'moments'],
            valence: 0.6,
            arousal: 0.3,
            importance: 2,
          });
        }
      } catch {}
    };

    const getNeeded = () => {
      const state = useAppStore.getState();
      const now = Date.now();
      const dayAgo = now - 86400000;
      const result: { id: string; char: any; needed: number }[] = [];

      for (const [id, c] of Object.entries(state.characters)) {
        if (!c.momentsEnabled || c.isDisabled || c.isWeChatFriend === false) continue;
        const freq = c.momentsFrequency || 2;
        const todayCount = state.moments.filter(
          (m: any) => m.authorId === id && m.timestamp > dayAgo
        ).length;
        if (todayCount < freq) result.push({ id, char: c as any, needed: freq - todayCount });
      }
      return result;
    };

    // Schedule next moment spaced across the day (no immediate burst)
    const scheduleNext = () => {
      const state = useAppStore.getState();
      const now = Date.now();
      const dayEnd = new Date();
      dayEnd.setHours(24, 0, 0, 0);
      const msLeft = dayEnd.getTime() - now;
      if (msLeft <= 0) return;

      let totalNeeded = 0;
      for (const [id, c] of Object.entries(state.characters)) {
        if (!c.momentsEnabled || c.isDisabled || c.isWeChatFriend === false) continue;
        const freq = c.momentsFrequency || 2;
        const todayCount = state.moments.filter(
          (m: any) => m.authorId === id && m.timestamp > now - 86400000
        ).length;
        if (todayCount < freq) totalNeeded += freq - todayCount;
      }
      if (totalNeeded === 0) return;

      const delay = Math.max(600000, Math.min(msLeft / totalNeeded, 14400000)) * (0.5 + Math.random() * 0.5);

      momentsTimerRef.current = window.setTimeout(async () => {
        const needed = getNeeded();
        if (needed.length > 0) {
          const pick = needed[Math.floor(Math.random() * needed.length)];
          await generateOneMoment(pick.id, pick.char);
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();

    return () => {
      if (momentsTimerRef.current) {
        clearTimeout(momentsTimerRef.current);
        momentsTimerRef.current = null;
      }
    };
  }, [addMoment]);

  // Phone check: wait 3s after character agrees, then show phone overlay
  const phoneCheckTimerRef = useRef<number | null>(null);

  // Clean up timer when leaving chat
  useEffect(() => {
    if (!activeChat) {
      if (phoneCheckTimerRef.current) {
        clearTimeout(phoneCheckTimerRef.current);
        phoneCheckTimerRef.current = null;
      }
      setPhoneCheckSession(null);
      setPhoneCheckRefusal(null);
      setCharPhoneCheckPrompt(null);
      if (charPhoneCheckTimerRef.current) {
        clearTimeout(charPhoneCheckTimerRef.current);
        charPhoneCheckTimerRef.current = null;
      }
    }
  }, [activeChat]);

  const handlePhoneCheckRequest = async (charId: string, msg: string) => {
    try {
      const char = characters[charId];
      if (!char || char.isDisabled) return;

      const store = useAppStore.getState();
      const history = store.chats[charId] || [];
      const recent = history.slice(-4).map((m: any) =>
        `${m.senderId === 'user' ? '我' : char.name}: ${(m.text || '').slice(0, 50)}`
      ).join('\n');

      // Check how many times phone check has been requested before
      const phoneCheckCount = history.filter((m: any) =>
        m.senderId === 'user' && (m.text || '').includes('查看')
      ).length;

      let passcodeValue = '';
      try {
        const raw = localStorage.getItem('phone_data_' + charId);
        if (raw) {
          const ps = JSON.parse(raw);
          passcodeValue = ps.passcode || '';
        }
      } catch {}
      const charBirthday = (char as any).birthDate || '';
      const userBirthday = store.settings.persona?.birthDate || '';

      const dec = await decidePhoneCheck(charId, char, msg, recent, passcodeValue, charBirthday, userBirthday, phoneCheckCount);

      if (!dec) {
        console.warn('decidePhoneCheck returned null for', charId);
        return;
      }

      if (dec.reply) {
        receiveMessage(charId, dec.reply);
      }

      try { store.addCharacterMemory(charId, {
        type: 'event',
        content: `用户想查我的手机，我${dec.agreed ? '同意' : '拒绝了'}`,
        summary: dec.agreed ? '用户查了手机（同意）' : '用户想查手机（被拒绝）',
        tags: ['phone_check', 'privacy'],
        valence: dec.agreed ? 0.3 : 0.1,
        arousal: dec.agreed ? 0.5 : 0.4,
        importance: 6,
        layer: 'daily',
        resolved: 0,
      }); } catch {}

      if (!dec.agreed) {
        setPhoneCheckRefusal({ characterId: charId, userMessage: msg, reply: dec.reply });
        return;
      }

      phoneCheckTimerRef.current = window.setTimeout(() => {
        setPhoneCheckSession({ characterId: charId, userMessage: msg });
        phoneCheckTimerRef.current = null;
      }, 3000);
    } catch (e) {
      console.error('phone check error', e);
    }
  };

  const handleGrabPhone = useCallback(() => {
    if (!phoneCheckRefusal) return;
    const { characterId: charId, userMessage: msg } = phoneCheckRefusal;
    setPhoneCheckRefusal(null);

    const charName = useAppStore.getState().characters[charId]?.name || '对方';
    useAppStore.getState().sendMessage(charId, `[系统] 你强行抢走了${charName}的手机。`);

    useAppStore.getState().addCharacterMemory(charId, {
      type: 'event',
      content: '用户强行抢了我的手机查看',
      summary: '用户强行抢了我的手机',
      tags: ['phone_check', 'grab'],
      valence: -0.2,
      arousal: 0.7,
      importance: 7,
      layer: 'daily',
      resolved: 0,
    });

    setPhoneCheckSession({ characterId: charId, userMessage: msg, grab: true });
  }, [phoneCheckRefusal]);

  const handleSkipGrab = useCallback(() => {
    if (!phoneCheckRefusal) return;
    const { characterId: charId } = phoneCheckRefusal;
    setPhoneCheckRefusal(null);

    const charName = useAppStore.getState().characters[charId]?.name || '对方';
    useAppStore.getState().sendMessage(charId, `[系统] 你放弃了查看${charName}的手机。`);

    const char = characters[charId];
    if (char) {
      generateAIResponse(
        `你正在扮演${char.name}（性格：${char.personality || '普通'}）。对方刚才想查你的手机被你拒绝了，现在对方放弃了。根据你的性格，用1-2句话回应。严禁动作描写、神态描写、心理描写。不加括号、引号、星号。直接以文字开头。`
      ).then(reply => {
        if (reply?.trim()) useAppStore.getState().receiveMessage(charId, reply.trim());
      }).catch(() => {});
    }
  }, [phoneCheckRefusal, characters]);

  // ── Character Phone Check (角色查我手机) ──

  /** AI 判断角色是否会抢手机 */
  const decideCharacterGrab = async (charId: string): Promise<boolean> => {
    try {
      const store = useAppStore.getState();
      const char = store.characters[charId];
      if (!char) return false;
      const bank = store.characterMemoryBank[charId] || [];
      const recentMems = bank.slice(0, 8).map(m => m.summary || m.content).join('；');
      const moodEvents = (store.emotionEvents || []).filter(e => e.characterId === charId).slice(-6);
      const avgNA = moodEvents.length > 0
        ? moodEvents.reduce((s, e) => s + e.naDelta, 0) / moodEvents.length
        : 0;
      const moodHint = avgNA > 0.3 ? '（当前心情较差，猜疑心很重）' : avgNA < -0.2 ? '（当前心情较好）' : '（心情一般）';

      const prompt = `你正在扮演${char.name}。角色设定：性格：${char.personality}，关系：${char.relationship}，好感度：${char.affection}/100。
近期记忆：${recentMems || '无'}${moodHint}

你的伴侣拒绝了你查看手机的请求。根据你的性格、记忆和当前心情，你是否会强行抢过对方的手机来看？
请只回答一个数字：1（抢）或 0（不抢）。不要输出其他内容。`;
      const reply = await generateAIResponse(prompt);
      return reply?.trim() === '1';
    } catch { return false; }
  };

  /** 记录角色查手机的情绪事件 */
  const recordCharPhoneCheckEmotion = (charId: string, paDelta: number, naDelta: number, word: string, valence: number, arousal: number) => {
    try {
      useAppStore.getState().addEmotionEvent({
        characterId: charId,
        paDelta,
        naDelta,
        word,
        valence,
        arousal,
        matchSource: 'free_form',
        source: 'manual',
      });
    } catch {}
  };

  /** 处理角色查我手机请求 */
  const handleCharPhoneCheckRequest = async (charId: string, msg: string) => {
    try {
      const char = characters[charId];
      if (!char || char.isDisabled) return;

      const store = useAppStore.getState();
      const persona = store.settings.persona;

      // 检查是否情侣关系（用于决定是否走弹窗路径）
      const isCouple = char.relationshipStatus === 'dating' || char.relationshipStatus === 'engaged' || char.relationshipStatus === 'married';

      if (isCouple) {
        // Path B: 情侣关系 → 先弹申请弹窗，让角色用 AI 生成请求消息
        try {
          const reply = await generateAIResponse(
            `你正在扮演${char.name}（性格：${char.personality || '普通'}，关系：${char.relationship}）。${persona?.name || '对方'}主动说想让你看他的手机。根据你的性格，用1-2句话回应，表示你想看他的手机。严禁动作描写、神态描写、心理描写。不加括号、引号、星号。直接以文字开头。`
          );
          if (reply?.trim()) receiveMessage(charId, reply.trim());
        } catch {}
        // 弹出申请弹窗
        setCharPhoneCheckPrompt({ characterId: charId, userMessage: msg });
      } else {
        // Path A: 非情侣 → 直接接管
        try {
          const reply = await generateAIResponse(
            `你正在扮演${char.name}（性格：${char.personality || '普通'}，关系：${char.relationship}）。${persona?.name || '对方'}主动说想让你看他的手机。根据你的性格，用1-2句话回应。严禁动作描写、神态描写、心理描写。不加括号、引号、星号。直接以文字开头。`
          );
          if (reply?.trim()) receiveMessage(charId, reply.trim());
        } catch {
          receiveMessage(charId, '嗯？那我看看。');
        }

        // 延迟一秒再接管（让用户先看到角色消息）
        charPhoneCheckTimerRef.current = window.setTimeout(() => {
          charPhoneCheckTimerRef.current = null;
          const currentState = useAppStore.getState();
          if (currentState.charPhoneCheck.isActive) return; // 已被其他流程激活
          const currentPersona = currentState.settings.persona;
          currentState.startCharPhoneCheck(charId, 'direct');
          recordCharPhoneCheckEmotion(charId, 0.2, 0.1, '好奇', 0.3, 0.5);

          currentState.addCharacterMemory(charId, {
            type: 'event',
            content: `我查看了${currentPersona?.name || '对方'}的手机`,
            summary: '我查看了对方的手机',
            tags: ['char_phone_check', 'direct'],
            valence: 0.4,
            arousal: 0.6,
            importance: 7,
            layer: 'daily',
            resolved: 0,
          });
        }, 1000);
      }
    } catch (e) {
      console.error('char phone check error', e);
    }
  };

  /** 情侣+吃醋路径：弹出申请弹窗 */
  const handleCharPhoneCheckJealousy = async (charId: string) => {
    const char = characters[charId];
    if (!char || char.isDisabled) return;

    // 检查是否情侣关系
    const isCouple = char.relationshipStatus === 'dating' || char.relationshipStatus === 'engaged' || char.relationshipStatus === 'married';
    if (!isCouple) return;
    // 勿重复弹出
    if (charPhoneCheckPrompt || useAppStore.getState().charPhoneCheck.isActive) return;

    // 先让角色说一句想看手机的话
    try {
      const persona = useAppStore.getState().settings.persona;
      const reply = await generateAIResponse(
        `你正在扮演${char.name}（性格：${char.personality || '普通'}）。你和${persona?.name || '对方'}是${char.relationship}（情侣关系）。你现在有点吃醋/不放心，想看看${persona?.name || '对方'}的手机。用1-2句话自然地表达你想看ta的手机。严禁动作描写、神态描写、心理描写。不加括号、引号、星号。直接以文字开头。`
      );
      if (reply?.trim()) receiveMessage(charId, reply.trim());
    } catch {}

    setCharPhoneCheckPrompt({ characterId: charId, userMessage: '' });
  };

  /** 用户同意角色查看 */
  const handleCharPhoneCheckAgree = useCallback(() => {
    if (!charPhoneCheckPrompt) return;
    if (useAppStore.getState().charPhoneCheck.isActive) return;
    const { characterId: charId } = charPhoneCheckPrompt;
    setCharPhoneCheckPrompt(null);

    const store = useAppStore.getState();
    const char = store.characters[charId];
    if (!char) return;

    store.sendMessage(charId, '[系统] 你同意了对方查看你的手机。');
    store.startCharPhoneCheck(charId, 'agreed');
    recordCharPhoneCheckEmotion(charId, 0.3, -0.1, '被信任', 0.6, 0.3);

    store.addCharacterMemory(charId, {
      type: 'event',
      content: `我请求查看${store.settings.persona?.name || '对方'}的手机，对方同意了`,
      summary: '查看手机请求被同意',
      tags: ['char_phone_check', 'agreed'],
      valence: 0.6,
      arousal: 0.4,
      importance: 7,
      layer: 'daily',
      resolved: 0,
    });
  }, [charPhoneCheckPrompt]);

  /** 用户拒绝角色查看 → 角色可能抢手机 */
  const handleCharPhoneCheckRefuse = useCallback(async () => {
    if (!charPhoneCheckPrompt) return;
    if (useAppStore.getState().charPhoneCheck.isActive) return;
    const { characterId: charId } = charPhoneCheckPrompt;
    setCharPhoneCheckPrompt(null);

    const store = useAppStore.getState();
    const char = store.characters[charId];
    if (!char) return;

    // 记录拒绝
    store.sendMessage(charId, `[系统] 你拒绝了${char.name}查看你的手机。`);
    recordCharPhoneCheckEmotion(charId, -0.2, 0.4, '被拒绝', -0.3, 0.6);

    store.addCharacterMemory(charId, {
      type: 'event',
      content: `我请求查看${store.settings.persona?.name || '对方'}的手机，被拒绝了`,
      summary: '查看手机请求被拒绝',
      tags: ['char_phone_check', 'refused'],
      valence: 0.1,
      arousal: 0.6,
      importance: 7,
      layer: 'daily',
      resolved: 0,
    });

    // AI 判断是否抢手机
    const willGrab = await decideCharacterGrab(charId);
    if (willGrab) {
      store.sendMessage(charId, '[系统] 对方抢走了你的手机！');
      store.startCharPhoneCheck(charId, 'snatched');
      recordCharPhoneCheckEmotion(charId, -0.1, 0.7, '冲动', -0.1, 0.8);
    } else {
      store.sendMessage(charId, '[系统] 对方放下了你的手机。');
      recordCharPhoneCheckEmotion(charId, -0.1, -0.2, '失落', -0.2, 0.2);

      // AI 角色回应（不抢了）
      generateAIResponse(
        `你正在扮演${char.name}（性格：${char.personality || '普通'}）。你刚才想查看对方的手机但被拒绝了。现在你决定不看就不看了。根据你的性格，用1-2句话回应。严禁动作描写、神态描写、心理描写。不加括号、引号、星号。直接以文字开头。`
      ).then(reply => {
        if (reply?.trim()) useAppStore.getState().receiveMessage(charId, reply.trim());
      }).catch(() => {});
    }
  }, [charPhoneCheckPrompt]);


  const handleClosePhoneCheck = (actions?: { sentMessages: { contactName: string; text: string }[]; postedMoments: { content: string }[]; settingsChanges?: string[] }) => {
    const session = phoneCheckSession;
    const charId = session?.characterId;
    setPhoneCheckSession(null);

    if (!charId) return;

    const store = useAppStore.getState();
    const char = store.characters[charId];
    if (!char || char.isDisabled) return;
    const persona = store.settings.persona;

    let grabbedBack = (actions as any)?.grabbedBack;
    let actionSummary;
    if (grabbedBack) {
      actionSummary = '对方强行抢了我的手机去看';
    } else {
      actionSummary = '用户查看了我的手机';
    }
    if (actions) {
      if (actions.sentMessages.length > 0) {
        actionSummary += '，用我的手机冒充我给' + actions.sentMessages.map(m => m.contactName).join('、') + '发了消息';
      }
      if (actions.postedMoments.length > 0) {
        actionSummary += '，用我的账号发了' + actions.postedMoments.length + '条朋友圈';
      }
      if (actions.settingsChanges && actions.settingsChanges.length > 0) {
        actionSummary += '，还' + actions.settingsChanges.join('、');
      }
      if (grabbedBack) {
        actionSummary += '。然后我把手机抢回来了';
      }
    }

    store.addCharacterMemory(charId, {
      type: 'event',
      content: actionSummary,
      summary: actionSummary.slice(0, 150),
      tags: ['phone_check', 'privacy'],
      valence: 0.3,
      arousal: 0.6,
      importance: 6,
      layer: 'daily',
      resolved: 0,
    });

    if (actions) {
      for (const msg of actions.sentMessages) {
        store.addCharacterMemory(charId, {
          type: 'event',
          content: `用户冒充我发消息给${msg.contactName}：${msg.text}`,
          summary: `冒充我发消息给${msg.contactName}`,
          tags: ['phone_check', 'message', 'impersonation'],
          valence: -0.1,
          arousal: 0.5,
          importance: 7,
          layer: 'daily',
          resolved: 0,
        });
      }
      for (const m of actions.postedMoments) {
        const summary = m.content.length > 60 ? m.content.slice(0, 60) + '…' : m.content;
        store.addCharacterMemory(charId, {
          type: 'event',
          content: `用户用我的账号发了朋友圈：${m.content}`,
          summary: `用我账号发朋友圈：${summary}`,
          tags: ['phone_check', 'moment'],
          valence: 0.1,
          arousal: 0.4,
          importance: 6,
          layer: 'daily',
          resolved: 0,
        });
      }
    }

    if (actions?.settingsChanges) {
      for (const change of actions.settingsChanges) {
        if (change.includes('密码')) {
          store.addCharacterMemory(charId, {
            type: 'event',
            content: `用户${change}`,
            summary: `用户${change}`,
            tags: ['phone_check', 'passcode'],
            valence: -0.1,
            arousal: 0.7,
            importance: 8,
            layer: 'daily',
            resolved: 0,
          });
        } else if (change.includes('壁纸') || change.includes('更换')) {
          store.addCharacterMemory(charId, {
            type: 'event',
            content: `用户${change}`,
            summary: `用户${change}`,
            tags: ['phone_check', 'wallpaper'],
            valence: 0.2,
            arousal: 0.4,
            importance: 7,
            layer: 'daily',
            resolved: 0,
          });
        }
      }
    }

    let summaryLine = '[系统] 手机检查结束。';
    if (grabbedBack) {
      summaryLine = '[系统] 手机被抢回去了。';
    } else {
      const didThings = (actions?.sentMessages?.length || 0) + (actions?.postedMoments?.length || 0) + (actions?.settingsChanges?.length || 0);
      if (didThings > 0) {
        const parts: string[] = [];
        if (actions.sentMessages.length) parts.push('冒充角色发了消息');
        if (actions.postedMoments.length) parts.push('发了朋友圈');
        if (actions.settingsChanges.length) parts.push('改了手机设置');
        summaryLine += '你' + parts.join('，') + '。';
      }
    }
    useAppStore.getState().sendMessage(charId, summaryLine);

    const freshStore = useAppStore.getState();
    const bank = freshStore.characterMemoryBank[charId] || [];
    const recentMemories = bank.slice(0, 5).map((m: any) => m.summary || m.content).join('；');

    const events = (freshStore.emotionEvents || []).filter((e: any) => e.characterId === charId);
    const recentEvents = events.slice(-6);
    let moodDesc = '平静';
    if (recentEvents.length > 0) {
      const avgValence = recentEvents.reduce((s: number, e: any) => s + (e.valence ?? 0), 0) / recentEvents.length;
      const avgArousal = recentEvents.reduce((s: number, e: any) => s + (e.arousal ?? 0), 0) / recentEvents.length;
      if (avgValence > 0.3) moodDesc = avgArousal > 0.5 ? '愉快兴奋' : '愉悦平静';
      else if (avgValence < -0.3) moodDesc = avgArousal > 0.5 ? '愤怒焦虑' : '低落沮丧';
      else moodDesc = avgArousal > 0.5 ? '有点紧张' : '平静';
    }

    let actionsDesc = '';
    if (actions) {
      if (actions.sentMessages.length > 0) {
        actionsDesc += '\n你拿回手机后发现对方用你的手机给别人发了消息：\n';
        for (const m of actions.sentMessages) {
          actionsDesc += '- 发给' + m.contactName + '：' + m.text + '\n';
        }
      }
      if (actions.postedMoments.length > 0) {
        actionsDesc += '\n你拿回手机后发现对方用你的账号发了朋友圈：\n';
        for (const m of actions.postedMoments) {
          actionsDesc += '- ' + m.content + '\n';
        }
      }
      if (actions.settingsChanges && actions.settingsChanges.length > 0) {
        actionsDesc += '\n对方还动了你的手机设置：\n';
        for (const s of actions.settingsChanges) {
          actionsDesc += '- ' + s + '\n';
        }
      }
    }

    const wallpaperImages: { mimeType: string; data: string }[] = [];
    if (actions?.settingsChanges?.some((s: string) => s.includes('壁纸'))) {
      let phoneSettings: any = {};
      try { const raw = localStorage.getItem('phone_data_' + charId); if (raw) phoneSettings = JSON.parse(raw); } catch {}
      const lockWall = phoneSettings.lockscreenWallpaper || '';
      const homeWall = phoneSettings.homeWallpaper || '';
      if (lockWall.startsWith('data:')) { const img = extractImageData(lockWall); if (img) wallpaperImages.push(img); }
      if (homeWall.startsWith('data:')) { const img = extractImageData(homeWall); if (img) wallpaperImages.push(img); }
    }

    const textPrompt = '你正在扮演' + char.name + '。\n角色性格：' + (char.personality || '') + '\n关系：' + (char.relationship || '朋友') + '，好感度：' + (char.affection ?? 50) + '/100\n当前心情：' + moodDesc + '\n用户：' + (persona.name || '你') + '\n' + (recentMemories ? '近期记忆：' + recentMemories : '') + '\n\n用户刚刚检查了你的手机。' + actionsDesc + '\n现在手机检查结束了。根据角色的性格、当下的心情、与对方的关系和好感度，以及对方用你手机做了什么事（如果做了的话），用1-2句话对刚才的事情做个回应。严禁动作描写、神态描写、心理描写。不加括号、引号、星号。直接以文字开头。';

    const tryAI = (withImages: boolean): Promise<string | null> => {
      const p = withImages && wallpaperImages.length > 0
        ? generateAIResponse(textPrompt, undefined, wallpaperImages)
        : generateAIResponse(textPrompt);
      return p.then(r => r?.trim() || null).catch(() => null);
    };

    tryAI(wallpaperImages.length > 0).then(text => {
      if (text) {
        useAppStore.getState().receiveMessage(charId, text);
        return;
      }
      tryAI(false).then(text2 => {
        if (text2) {
          useAppStore.getState().receiveMessage(charId, text2);
          return;
        }
        const fallbackPrompt = '你正在扮演' + char.name + '。性格：' + (char.personality || '') + '。关系：' + (char.relationship || '朋友') + '，好感度：' + (char.affection ?? 50) + '/100。\n用户刚刚看了你的手机。请用一句话回应，语气符合角色性格。严禁动作描写、神态描写、心理描写。不加括号、引号、星号。直接以文字开头。';
        generateAIResponse(fallbackPrompt).then(fb => {
          if (fb?.trim()) useAppStore.getState().receiveMessage(charId, fb.trim());
        }).catch(() => {});
      });
    });
  };

  if (activeGroupChat) {
    return (
      <div className={`h-full ${isDark ? 'dark bg-black' : 'bg-gray-50'}`}>
         <GroupChatRoom groupId={activeGroupChat} onBack={() => setActiveGroupChat(null)} />
      </div>
    );
  }

  if (activeChat) {
    return (
      <div className={`relative overflow-hidden h-full ${isDark ? 'dark bg-black' : 'bg-gray-50'}`}>
         <ChatRoom characterId={activeChat} onBack={() => setActiveChat(null)} onPhoneCheckRequest={handlePhoneCheckRequest} onCharPhoneCheckRequest={handleCharPhoneCheckRequest} onCharPhoneCheckJealousy={handleCharPhoneCheckJealousy} />
         {phoneCheckSession && (
           <PhoneCheck
             characterId={phoneCheckSession.characterId}
             character={characters[phoneCheckSession.characterId] || { name: '', personality: '' }}
             userMessage={phoneCheckSession.userMessage}
             grabMode={phoneCheckSession.grab}
             onClose={handleClosePhoneCheck}
           />
         )}
         {phoneCheckRefusal && (() => {
           const char = characters[phoneCheckRefusal.characterId];
           if (!char) return null;
           return (
             <div className="absolute inset-0 z-[100] flex flex-col bg-black/70 backdrop-blur-lg pt-20 px-6">
               <div className="flex flex-col items-center gap-4 mb-10">
                 <div className="w-20 h-20 rounded-full border-2 border-white/30 shadow-lg flex items-center justify-center text-2xl font-bold text-white"
                   style={{ background: char.avatar?.startsWith('#') ? char.avatar : 'rgba(255,255,255,0.1)' }}>
                   {char.name?.[0] || '?'}
                 </div>
                 <h2 className="text-white text-xl font-medium">{char.name}</h2>
                 <p className="text-white/70 text-center text-sm leading-relaxed max-w-xs">
                   {phoneCheckRefusal.reply}
                 </p>
               </div>
               <div className="flex flex-col gap-3 mt-auto mb-16">
                 <button onClick={handleGrabPhone} className="w-full py-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 font-medium hover:bg-red-500/30 transition-all active:scale-[0.98]">抢过来看</button>
                 <button onClick={handleSkipGrab} className="w-full py-3 rounded-2xl text-white/50 hover:text-white/70 transition-colors">算了</button>
               </div>
             </div>
           );
         })()}
         {charPhoneCheckPrompt && (() => {
           const char = characters[charPhoneCheckPrompt.characterId];
           if (!char) return null;
           return (
             <div className="absolute inset-0 z-[100] flex flex-col bg-black/70 backdrop-blur-lg pt-20 px-6">
               <div className="flex flex-col items-center gap-4 mb-10">
                 <div className="w-20 h-20 rounded-full border-2 border-white/30 shadow-lg flex items-center justify-center text-2xl font-bold text-white"
                   style={{ background: char.avatar?.startsWith('#') ? char.avatar : 'rgba(255,255,255,0.1)' }}>
                   {char.name?.[0] || '?'}
                 </div>
                 <h2 className="text-white text-xl font-medium">{char.name}</h2>
                 <p className="text-white/70 text-center text-sm leading-relaxed max-w-xs">
                   {char.name}想查看你的手机……
                 </p>
               </div>
               <div className="flex flex-col gap-3 mt-auto mb-16">
                 <button onClick={handleCharPhoneCheckAgree} className="w-full py-4 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 font-medium hover:bg-blue-500/30 transition-all active:scale-[0.98]">给她/他看</button>
                 <button onClick={() => handleCharPhoneCheckRefuse()} className="w-full py-3 rounded-2xl text-white/50 hover:text-white/70 transition-colors">不给</button>
               </div>
             </div>
           );
         })()}
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col font-sans transition-colors ${isDark ? 'dark bg-black' : 'bg-gray-50'}`}>
      <div className={`flex-1 overflow-hidden relative ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {activeTab === 'chats' && <ChatList onOpenChat={setActiveChat} onOpenGroupChat={setActiveGroupChat} />}
        {activeTab === 'contacts' && <Contacts onOpenChat={setActiveChat} />}
        {activeTab === 'moments' && <Moments />}
        {activeTab === 'me' && <Me />}
      </div>

      <div className={`h-[54px] flex justify-around items-center border-t shrink-0 z-40 ${isDark ? 'bg-[#191919] border-white/5' : 'bg-gray-50 border-gray-200'}`}>
        <TabButton icon={<MessageCircle />} label="微信" active={activeTab === 'chats'} onClick={() => setActiveTab('chats')} isDark={isDark} />
        <TabButton icon={<Users />} label="通讯录" active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} isDark={isDark} />
        <TabButton icon={<Compass />} label="发现" active={activeTab === 'moments'} onClick={() => setActiveTab('moments')} isDark={isDark} />
        <TabButton icon={<User />} label="我" active={activeTab === 'me'} onClick={() => setActiveTab('me')} isDark={isDark} />
      </div>
      {phoneCheckRefusal && (() => {
        const char = characters[phoneCheckRefusal.characterId];
        if (!char) return null;
        return (
          <div className="absolute inset-0 z-[100] flex flex-col bg-black/70 backdrop-blur-lg pt-20 px-6">
            <div className="flex flex-col items-center gap-4 mb-10">
              <div className="w-20 h-20 rounded-full border-2 border-white/30 shadow-lg flex items-center justify-center text-2xl font-bold text-white"
                style={{ background: char.avatar?.startsWith('#') ? char.avatar : 'rgba(255,255,255,0.1)' }}>
                {char.name?.[0] || '?'}
              </div>
              <h2 className="text-white text-xl font-medium">{char.name}</h2>
              <p className="text-white/70 text-center text-sm leading-relaxed max-w-xs">
                {phoneCheckRefusal.reply}
              </p>
            </div>
            <div className="flex flex-col gap-3 mt-auto mb-16">
              <button onClick={handleGrabPhone} className="w-full py-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 font-medium hover:bg-red-500/30 transition-all active:scale-[0.98]">抢过来看</button>
              <button onClick={handleSkipGrab} className="w-full py-3 rounded-2xl text-white/50 hover:text-white/70 transition-colors">算了</button>
            </div>
          </div>
        );
      })()}
      {charPhoneCheckPrompt && (() => {
        const char = characters[charPhoneCheckPrompt.characterId];
        if (!char) return null;
        return (
          <div className="absolute inset-0 z-[100] flex flex-col bg-black/70 backdrop-blur-lg pt-20 px-6">
            <div className="flex flex-col items-center gap-4 mb-10">
              <div className="w-20 h-20 rounded-full border-2 border-white/30 shadow-lg flex items-center justify-center text-2xl font-bold text-white"
                style={{ background: char.avatar?.startsWith('#') ? char.avatar : 'rgba(255,255,255,0.1)' }}>
                {char.name?.[0] || '?'}
              </div>
              <h2 className="text-white text-xl font-medium">{char.name}</h2>
              <p className="text-white/70 text-center text-sm leading-relaxed max-w-xs">
                {char.name}想查看你的手机……
              </p>
            </div>
            <div className="flex flex-col gap-3 mt-auto mb-16">
              <button onClick={handleCharPhoneCheckAgree} className="w-full py-4 rounded-2xl bg-blue-500/20 border border-blue-500/40 text-blue-400 font-medium hover:bg-blue-500/30 transition-all active:scale-[0.98]">给她/他看</button>
              <button onClick={() => handleCharPhoneCheckRefuse()} className="w-full py-3 rounded-2xl text-white/50 hover:text-white/70 transition-colors">不给</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function TabButton({ icon, label, active, onClick, isDark }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, isDark: boolean }) {
  const activeColor = isDark ? '#f3f4f6' : '#374151';
  const inactiveColor = isDark ? '#9ca3af' : '#6b7280';
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center w-full h-full active:opacity-70 transition-opacity" style={{ color: active ? activeColor : inactiveColor }}>
      <div className="mb-0.5">{React.cloneElement(icon as React.ReactElement, { size: 26, strokeWidth: active ? 2.5 : 2 })}</div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
