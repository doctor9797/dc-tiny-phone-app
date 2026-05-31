import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store';
import LockScreen from './LockScreen';
import HomeScreen from './HomeScreen';
import WeChatApp from './WeChat/WeChatApp';
import MusicApp from './Music/MusicApp';
import SettingsApp from './Settings/SettingsApp';
import TarotApp from './Tarot/TarotApp';
import BottleApp from './Bottle/BottleApp';
import WorldBookApp from './WorldBook/WorldBookApp';
import LiarsBarApp from './LiarsBar/LiarsBarApp';
import JubenshaApp from './Jubensha/JubenshaApp';
import VocabApp from './Vocab/VocabApp';
import CoPetApp from './CoPet/CoPetApp';
import FocusApp from './Focus/FocusApp';
import ReaderApp from './Reader/ReaderApp';
import CalendarApp from './Calendar/CalendarApp';
import BillingApp from './Billing/BillingApp';
import BeautifyApp from './Beautify/BeautifyApp';
import NewsApp from './News/NewsApp';
import DesktopPetApp from './DesktopPet/DesktopPetApp';
import DesktopPetOverlay from './DesktopPet/DesktopPetOverlay';
import WritingApp from './Writing/WritingApp';
import DiaryApp from './Diary/DiaryApp';
import CoupleDiaryApp from './Diary/CoupleDiaryApp';
import MailboxApp from './Mailbox/MailboxApp';
import ForumApp from './Forum/ForumApp';
import IFApp from './IF/IFApp';
import MovieApp from './Movie/MovieApp';
import MemoryApp from './MemoryApp';
import HunterApp from './Hunter/HunterApp';
import MarriageBureau from './Marriage/MarriageBureau';
import WeatherApp from './Weather/WeatherApp';
import DreamApp from './Dream/DreamApp';
import CharacterPhoneCheckOverlay from './CharacterPhoneCheck';
import FloatingMusicPlayer from './Music/FloatingMusicPlayer';
import { AnimatePresence, motion } from 'framer-motion';
import { format, differenceInMinutes, parse, startOfDay, addDays } from 'date-fns';
import { getCharacterReply } from '../lib/ai';
import { loadAndInjectFont, removeInjectedFont } from '../lib/fontStorage';
import { generateAIResponse } from '../lib/ai';
import { dream } from '../lib/moodLoop';
import { generateDream, getDreamToShare, generateDreamShareMessage } from '../lib/dreamEngine';
import { FORUM_ICON, generateForumReplyBatch, generateForumSeedPosts, scheduleNextReplyAt } from './Forum/forumUtils';
import { CharacterCard } from '../types';

const iconDataUrl = (label: string, bg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="18" fill="${bg}"/>
      <text x="32" y="39" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" fill="white">${label}</text>
    </svg>
  `)}`;

const MAILBOX_ICON = iconDataUrl('✉', '#b97745');

function StatusBar() {
  const { settings } = useAppStore();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate Beijing time + offset
  const utc = time.getTime() + (time.getTimezoneOffset() * 60000);
  const beijingTime = new Date(utc + (3600000 * 8) + ((settings.timeOffsetMinutes || 0) * 60000));

  return (
    <div className="absolute top-0 inset-x-0 h-7 flex items-center px-6 z-[110] pointer-events-none text-white mix-blend-difference">
      <span className="text-[13px] font-medium">{format(beijingTime, 'HH:mm')}</span>
    </div>
  );
}

export default function MobileShell() {
  const { isLocked, currentApp, settings, calendarRecords, updateCalendarRecord, characters, sendAdvancedMessage, widgets, notification, clearNotification, openApp, activeWorldSettingId, closeApp, updateCharacter, receiveMessage, addCharacterMemory, addEmotionEvent, charPhoneCheck } = useAppStore();
  const [notifDenied, setNotifDenied] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  const APPS_REQUIRING_WORLD_BOOK = ['music', 'tarot', 'bottle', 'liarsbar', 'jubensha', 'ifapp', 'vocab', 'copet', 'focus', 'reader', 'calendar', 'billing', 'beautify', 'news', 'desktoppet', 'writing', 'diary', 'mailbox', 'forum'];
  const needsWorldBook = currentApp && currentApp !== 'worldbook' && currentApp !== 'wechat' && APPS_REQUIRING_WORLD_BOOK.includes(currentApp);
  const worldBookRequired = needsWorldBook && !activeWorldSettingId;

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // Can't request programmatically in most browsers — wait for user gesture
    }
  }, []);

  // ── Character Phone Check — 逐条导航：聊天、朋友圈、其他 App ──
  const switchTimerRef = useRef<number | null>(null);
  const navigatedAppsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!charPhoneCheck.isActive) return;

    const s = useAppStore.getState();
    navigatedAppsRef.current = [];

    // 找到有聊天记录的人
    const partners = Object.entries(s.characters)
      .filter(([id, c]) => c.isWeChatFriend !== false && (s.chats[id] || []).length > 0)
      .map(([id]) => id);

    // 声明一个 helper 产生一次性动作
    function makeOpenChat(id: string) {
      return () => {
        const st = useAppStore.getState();
        st.openApp('wechat');
        st.updateSettings({ activeWeChatCharId: id } as any);
        navigatedAppsRef.current.push('wechat');
      };
    }
    function makeOpenMoments() {
      return () => {
        const st = useAppStore.getState();
        st.openApp('wechat');
        st.updateSettings({ activeWeChatTab: 'moments' } as any);
        navigatedAppsRef.current.push('moments');
      };
    }
    function makeOpenApp(app: string) {
      return () => {
        useAppStore.getState().openApp(app as any);
        navigatedAppsRef.current.push(app);
      };
    }

    // 构建动作列表
    const actions: (() => void)[] = [];

    // 1. 先打开微信
    actions.push(() => useAppStore.getState().openApp('wechat'));

    // 2. 点进每个聊天（闭包正确捕获 id）
    const maxChats = Math.min(partners.length, 2);
    for (let i = 0; i < maxChats; i++) {
      const id = partners[i];
      actions.push(makeOpenChat(id));
      // 看完一个聊天再看另一个
      if (i < maxChats - 1) {
        actions.push(makeOpenChat(partners[i+1]));
      }
    }

    // 3. 看朋友圈
    actions.push(makeOpenMoments());

    // 4. 回聊天列表
    actions.push(() => {
      useAppStore.getState().openApp('wechat');
    });

    // 5. 所有有数据的 App 全部查一遍（优先查有数据的）
    const dataApps: { app: string }[] = [];
    if ((s.diaryEntries || []).length > 0) dataApps.push({ app:'diary' });
    if ((s.songs || []).length > 0) dataApps.push({ app:'music' });
    if (Object.keys(s.calendarRecords || {}).length > 0) dataApps.push({ app:'calendar' });
    if ((s.coupleDiaries || []).length > 0) dataApps.push({ app:'couplediary' });
    if ((s.mailboxLetters || []).length > 0) dataApps.push({ app:'mailbox' });
    if ((s.forumPosts || []).length > 0) dataApps.push({ app:'forum' });
    for (const da of dataApps.sort(() => Math.random() - 0.5)) {
      actions.push(makeOpenApp(da.app));
    }

    // 6. 最后再看一遍聊天
    if (partners.length > 0) {
      actions.push(makeOpenChat(partners[0]));
    }

    // 执行
    let idx = 0;
    const runNext = () => {
      if (idx < actions.length) {
        actions[idx]();
        idx++;
      }
    };
    runNext();
    switchTimerRef.current = window.setInterval(runNext, 4000);

    return () => {
      if (switchTimerRef.current) clearInterval(switchTimerRef.current);
    };
  }, [charPhoneCheck.isActive]);

  // ── 冒充发消息/写信：查手机中途异步触发 ──
  useEffect(() => {
    if (!charPhoneCheck.isActive || !charPhoneCheck.characterId) return;
    const charId = charPhoneCheck.characterId;
    let cancelled = false;
    const doImp = async () => {
      await new Promise(r => setTimeout(r, 10000));
      if (cancelled) return;
      const store = useAppStore.getState();
      const myChar = store.characters[charId];
      if (!myChar) return;
      const targets = Object.entries(store.characters).filter(([id, c]) => id !== charId && c.isWeChatFriend !== false && (store.chats[id] || []).length > 0).map(([id, c]) => ({ id, name: c.name })).sort((a, b) => (store.chats[b.id] || []).length - (store.chats[a.id] || []).length);
      if (targets.length === 0) return;
      const target = targets[0];
      if (cancelled) return;
      if (Math.random() < 0.6) {
        try {
          const msg = await generateAIResponse(`你正在扮演${myChar.name}（性格：${myChar.personality}）。${myChar.name}正在查看${store.settings.persona?.name || '对方'}的手机，决定冒充${store.settings.persona?.name || '对方'}给${target.name}发一条试探消息。请以${store.settings.persona?.name || '对方'}的口吻发一条微信消息，听起来自然。1-2句话。不加引号括号。只输出消息。`);
          if (msg?.trim() && !cancelled) {
            store.sendMessage(target.id, msg.trim());
            store.addImpersonatedMessage({ id: `imp_${Date.now()}`, targetCharacterId: target.id, targetName: target.name, message: msg.trim(), recognized: false, timestamp: Date.now() });
            store.addCharacterMemory(charId, { type: 'event', content: `冒充${store.settings.persona?.name || '对方'}给${target.name}发消息：「${msg.trim()}」`, summary: `冒充发消息给${target.name}`, tags: ['char_phone_check', 'impersonation'], valence: 0.1, arousal: 0.6, importance: 7, layer: 'daily', resolved: 0 });
            // 目标角色也记住这条消息
            store.addCharacterMemory(target.id, { type: 'event', content: `${store.settings.persona?.name || '对方'}发来消息：「${msg.trim()}」`, summary: `${store.settings.persona?.name || '对方'}发来消息`, tags: ['impersonated'], valence: 0.5, arousal: 0.3, importance: 5, layer: 'daily', resolved: 0 });
            await new Promise(r => setTimeout(r, 3000));
            if (cancelled) return;
            const reply = await generateAIResponse(`你正在扮演${target.name}（性格：${store.characters[target.id]?.personality || ''}）。你收到了一条来自${store.settings.persona?.name || '好友'}的微信：「${msg.trim()}」请回复。1-2句话。不加引号括号。`);
            if (reply?.trim() && !cancelled) {
              store.receiveMessage(target.id, reply.trim());
              const recognized = /你还好吗|你怎么了|怪怪的|不像你|是不是别人|谁在用|说话怪怪的/.test(reply);
              const all = useAppStore.getState().impersonatedMessages;
              const last = all[all.length - 1];
              if (last) useAppStore.setState(s => ({ impersonatedMessages: s.impersonatedMessages.map(m => m.id === last.id ? { ...m, reply: reply.trim(), recognized } : m) }));
              store.addCharacterMemory(charId, { type: 'event', content: `${target.name}回复冒充消息：「${reply.trim()}」${recognized ? '（对方好像察觉了）' : ''}`, summary: `${target.name}回复冒充消息`, tags: ['char_phone_check', 'impersonation', 'reply'], valence: 0.2, arousal: 0.4, importance: 7, layer: 'daily', resolved: 0 });
              // 目标角色也记住回复
              store.addCharacterMemory(target.id, { type: 'event', content: `回复${store.settings.persona?.name || '对方'}：「${reply.trim()}」${recognized ? '（感觉语气有点怪）' : ''}`, summary: `回复${store.settings.persona?.name || '对方'}`, tags: ['impersonated'], valence: 0.4, arousal: 0.3, importance: 5, layer: 'daily', resolved: 0 });
            }
          }
        } catch {}
      }
      if (cancelled) return;
      if (Math.random() < 0.35) {
        try {
          const mc = await generateAIResponse(`你正在扮演${myChar.name}。${myChar.name}正在查看${store.settings.persona?.name || '对方'}的手机，决定冒充${store.settings.persona?.name || '对方'}给${target.name}写信。用${store.settings.persona?.name || '对方'}的口吻写。只输出正文。1-3句话。`);
          if (mc?.trim() && !cancelled) {
            store.saveMailboxLetter({ id: `imp_mail_${Date.now()}`, direction: 'outgoing', fromId: 'user', toId: target.id, subject: '', content: mc.trim(), createdAt: Date.now(), isRead: true });
            store.addCharacterMemory(charId, { type: 'event', content: `冒充写信给${target.name}：「${mc.trim()}」`, summary: `冒充写信给${target.name}`, tags: ['char_phone_check', 'impersonation', 'mail'], valence: 0.1, arousal: 0.5, importance: 7, layer: 'daily', resolved: 0 });
            store.addCharacterMemory(target.id, { type: 'event', content: `收到${store.settings.persona?.name || '对方'}的来信：「${mc.trim()}」`, summary: `收到${store.settings.persona?.name || '对方'}的来信`, tags: ['impersonated', 'mail'], valence: 0.5, arousal: 0.3, importance: 5, layer: 'daily', resolved: 0 });
          }
        } catch {}
      }
    };
    doImp();
    return () => { cancelled = true; };
  }, [charPhoneCheck.isActive, charPhoneCheck.characterId]);

  // Browser native notification when page is hidden or unfocused
  const lastNotifRef = useRef<number>(0);
  useEffect(() => {
    if (!notification) return;
    const now = Date.now();
    if (now - lastNotifRef.current < 2000) return; // dedupe 2s
    lastNotifRef.current = now;

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const charId = notification.characterId;
        const charName = notification.title || (charId ? characters[charId]?.name : '') || '消息';
        const notif = new Notification(charName, {
          body: notification.text || '',
          icon: charId && characters[charId]?.avatar?.startsWith('#') ? undefined : (charId ? characters[charId]?.avatar : undefined),
          tag: 'dc-phone-notif',
        });
        notif.onclick = () => {
          window.focus();
          clearNotification();
          const targetApp = notification.openApp || (notification.sourceApp === 'forum' ? 'forum' : 'wechat');
          openApp(targetApp);
          if (targetApp === 'wechat') {
            const update: any = {};
            if (notification.characterId && notification.text?.includes('请求添加你为朋友')) {
              update.activeWeChatTab = 'contacts';
            } else if (notification.characterId) {
              update.activeWeChatCharId = notification.characterId;
            }
            if (Object.keys(update).length) useAppStore.getState().updateSettings(update as any);
          }
        };
        setTimeout(() => notif.close(), 10000);
      } catch {}
    }
  }, [notification]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (notification) {
      timeout = setTimeout(() => {
        clearNotification();
      }, 4000);
    }
    return () => clearTimeout(timeout);
  }, [notification, clearNotification]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const now = new Date();
      const dateStr = format(now, 'yyyy-MM-dd');
      const store = useAppStore.getState();
      const record = store.calendarRecords[dateStr];
      const today = startOfDay(now);

      // Check current day's plans
      if (record && record.events) {
        let updated = false;
        const newEvents = [...record.events];
        
        for (let i = 0; i < newEvents.length; i++) {
          const event = newEvents[i];
          if (event.type === 'plan' && event.isPublished && !event.reminded) {
             const eventTime = parse(event.time, 'HH:mm', today);
             const diffMins = differenceInMinutes(eventTime, now);
             if (diffMins <= 15 && diffMins >= -60) {
               newEvents[i] = { ...event, reminded: true };
               updated = true;
               
               for (const charId of event.visibleTo || []) {
                 const char = store.characters[charId];
                 if (char) {
                   const prompt = `我有一个计划即将开始/截止或者刚开始：【${event.title}】，时间是 ${event.time}。请你作为我的${char.relationship}（或朋友），发挥你的性格(${char.personality})，发一条微信主动提醒或关心我，简短自然，字数不要太多。`;
                   getCharacterReply(charId, prompt).then(reply => {
                      if (reply) {
                        store.sendAdvancedMessage(charId, { text: reply, senderId: charId });
                      }
                   });
                 }
               }
             }
          }
        }
        if (updated) {
          store.updateCalendarRecord(dateStr, { events: newEvents });
        }
      }

      // Check menstrual cycle next month reminder
      // Look back 28 days
      const pastDate = addDays(now, -28);
      const pastDateStr = format(pastDate, 'yyyy-MM-dd');
      const pastRecord = store.calendarRecords[pastDateStr];
      
      if (pastRecord?.menstrual && pastRecord?.menstrualVisibleTo?.length > 0) {
         // See if we have reminded in the current month
         const monthStr = format(now, 'yyyy-MM');
         if (pastRecord.menstrualRemindedMonth !== monthStr) {
            // Check if it's currently around 9am
            if (now.getHours() === 9) {
               store.updateCalendarRecord(pastDateStr, { menstrualRemindedMonth: monthStr });
               for (const charId of pastRecord.menstrualVisibleTo) {
                 const char = store.characters[charId];
                 if (char) {
                   const prompt = `28天前我记录了来月经了（可能是生理期），按照周期，现在应该是下个月生理期快到或者正在经历的时候。请你作为我的${char.relationship}，发挥你的性格(${char.personality})，发一条微信主动提醒并关心我，多喝热水或注意身体，显得非常贴心。`;
                   getCharacterReply(charId, prompt).then(reply => {
                      if (reply) {
                        store.sendAdvancedMessage(charId, { text: reply, senderId: charId });
                      }
                   });
                 }
               }
            }
         }
      }

      const mailboxConfig = store.settings.mailbox;
      if (mailboxConfig?.enabledSenderIds?.length) {
        const frequencyHours: Record<'low' | 'medium' | 'high', number> = {
          low: 72,
          medium: 24,
          high: 8,
        };

        for (const charId of mailboxConfig.enabledSenderIds) {
          const char = store.characters[charId];
          if (!char) continue;
          const charCard = store.worldSettings.flatMap(setting => setting.characters).find(item => item.id === charId);
          if ((char as any).isDisabled === true || charCard?.isEnabled === false) continue;
          const persona = store.settings.persona;
          const userName = persona.name || store.settings.wechatName || '我';
          const relationship = charCard?.relationship || char.relationship || '朋友';
          const viewOnMe = charCard?.viewOnMe || '';

          const lastReceivedAt = mailboxConfig.lastReceivedAt?.[charId] || 0;
          const freq = mailboxConfig.frequencyByCharacter?.[charId] || 'medium';
          const gapMs = frequencyHours[freq] * 60 * 60 * 1000;
          if (Date.now() - lastReceivedAt < gapMs) continue;

          try {
            const prompt = `你是${char.name}。你的性格是${charCard?.personality || char.personality}。你和用户【${userName}】的关系是${relationship}。你对用户的看法是：${viewOnMe || '你很在意对方，只是表达方式符合你自己的性格。'}。
现在请你写一封明确寄给【${userName}】的私人来信，不要写给别人，更不要写给布鲁斯或任何第三人。你写信的对象只能是【${userName}】。
要求：
1. 必须像真实手写信。
2. 要有称呼、正文、结尾。
3. 不要Markdown，不要标题党。
4. 字数120到220字。
5. 内容要符合你和【${userName}】的关系，可以是想念、关心、分享近况、提醒天气、主动惦记。`;
            const content = (await generateAIResponse(prompt)).trim();
            const subject = (await generateAIResponse(`你是${char.name}。这是一封寄给【${userName}】的私人来信。请只给这封信起一个8字以内的中文标题，不要引号，不要序号。`)).replace(/[\n\r#*]/g, '').trim() || '想给你写信';

            store.saveMailboxLetter({
              id: `${Date.now()}_mailbox_${charId}`,
              direction: 'incoming',
              fromId: charId,
              toId: 'user',
              subject,
              content,
              createdAt: Date.now(),
              isRead: false,
            });
            store.addActivityLog({
              id: `${Date.now()}_mailbox_auto`,
              title: `${char.name}寄来信件`,
              detail: `主题：${subject}`,
              timestamp: Date.now(),
              relatedCharacterIds: [charId]
            });
            store.setNotification({
              id: Date.now(),
              title: char.name,
              text: `${char.name}给您寄来了一封信`,
              sourceApp: 'mailbox',
              openApp: 'mailbox',
              avatar: MAILBOX_ICON,
              characterId: charId,
            });
            store.updateSettings({
              mailbox: {
                ...mailboxConfig,
                lastReceivedAt: {
                  ...(mailboxConfig.lastReceivedAt || {}),
                  [charId]: Date.now()
                }
              }
            });
            break;
          } catch {
            // ignore letter generation failures
          }
        }
      }

      // ── Pending re-add check ──
      for (const [charId, char] of Object.entries(store.characters)) {
        if (char.pendingReAddAt && char.pendingReAddAt <= Date.now() && char.isWeChatFriend !== true) {
          try {
            const context = char.pendingReAddContext || '';
            const reasonPrompt = context
              ? `以下是我们之前的对话：\n${context}\n\n你发现对方删除了你的微信好友。分析对话内容判断你们是否发生过争吵。如果是在争吵，生成一句道歉/挽留的消息。如果没有争吵（看起来很正常），生成一句困惑/询问的消息（例如"怎么把我删了？"）。直接输出消息内容，不要任何前缀，不要括号动作描写。`
              : `你发现对方删除了你的微信好友。你感到困惑，想知道为什么。生成一句询问的消息（例如"你怎么把我删了？"）。直接输出消息内容，不要任何前缀，不要括号动作描写。`;

            const reason = (await generateAIResponse(
              `你正在扮演${char.name}。性格：${char.personality}。\n${reasonPrompt}`
            )).trim();

            const card: CharacterCard = {
              id: charId,
              name: char.name,
              avatar: char.avatar,
              personality: char.personality || '',
              experience: char.experience || '',
              relationship: char.relationship || '朋友',
              viewOnMe: char.viewOnMe || '',
            };

            store.addFriendRequest(card, reason || `${char.name}请求添加你为朋友`);

            store.setNotification({
              id: Date.now(),
              title: char.name,
              text: reason || `${char.name}请求添加你为朋友`,
              sourceApp: 'wechat',
              openApp: 'wechat',
              characterId: charId,
            });
          } catch {
            // Silent fail
          }

          // Clear pending flags regardless
          store.updateCharacter(charId, {
            pendingReAddAt: undefined,
            pendingReAddContext: undefined,
          });
        }
      }

      // ── Proactive share check ──
      for (const [charId, char] of Object.entries(store.characters)) {
        if (!char.shareEnabled || char.isDisabled || char.isWeChatFriend === false) continue;

        const freq = char.shareFrequency || 2;
        if (freq <= 0) continue;

        // Check mood from recent emotion events — arguments reduce share frequency
        const events = (store.emotionEvents || []).filter((e: any) => e.characterId === charId);
        const recentEvents = events.slice(-6);
        let effectiveFreq = freq;
        if (recentEvents.length > 0) {
          const avgValence = recentEvents.reduce((s: number, e: any) => s + e.valence, 0) / recentEvents.length;
          if (avgValence < -0.7) continue; // severe argument → skip entirely
          if (avgValence < -0.5) effectiveFreq = Math.max(1, freq - 2);
          else if (avgValence < -0.3) effectiveFreq = Math.max(1, freq - 1);
        }

        // Base interval: 24h / frequency, with ±25% jitter so it feels organic
        const baseInterval = (24 * 60 * 60 * 1000) / effectiveFreq;
        const jitter = 0.75 + Math.random() * 0.5;
        const interval = baseInterval * jitter;

        const lastShare = char.lastShareAt || 0;
        if (Date.now() - lastShare < interval) continue;

        try {
          const prompt = `你正在扮演${char.name}。性格：${char.personality || '普通'}，关系：${char.relationship || '朋友'}，好感度：${char.affection ?? 50}/100。
  ${char.biography ? '背景：' + char.biography : ''}

  你现在想主动给对方分享一些有趣的东西。可以分享的内容包括：
  - 最近看的一本书/文章/漫画
  - 最近刷到的好玩的视频
  - 最近听到的一首歌
  - 最近听到的一个笑话
  - 最近遇到的有趣/奇怪的事
  - 任何你觉得对方会感兴趣的事情

  要求：
  1. 分享内容要符合你的性格和你们的关系
  2. 口吻自然亲切，就像朋友间日常分享
  3. 短小精悍，1-2句话即可
  4. 直接输出分享内容，不要引号，不要动作/神态描写`;
          const content = (await generateAIResponse(prompt)).trim();
          if (content) {
            store.sendAdvancedMessage(charId, { text: content, senderId: charId });
            store.updateCharacter(charId, { lastShareAt: Date.now() });
          }
        } catch {
          // Silent fail
        }
      }

      // ── Dream sharing check ──
      const hour = now.getHours();
      if (hour >= 6 && hour < 24) { // only during waking hours
        for (const [charId, char] of Object.entries(store.characters)) {
          if (char.isDisabled || char.isWeChatFriend === false) continue;

          const dreamInfo = getDreamToShare(charId);
          if (!dreamInfo) continue;

          // Probabilistic: higher likelihood → more chance of sharing
          if (Math.random() >= dreamInfo.likelihood / 100) continue;

          const message = await generateDreamShareMessage(charId, dreamInfo.dream);
          if (message) {
            store.sendAdvancedMessage(charId, { text: message, senderId: charId });
            store.updateCharacter(charId, { lastDreamShareAt: Date.now() });
          }
        }
      }

      const forumConfig = store.settings.forum ?? {};
      const forumUserHandle = forumConfig.userHandle ?? '夜里不睡';
      const blockedHandles = forumConfig.blockedHandles ?? [];
      const postRefreshMinutes = forumConfig.postRefreshMinutes ?? 0;
      const replyRefreshMinutes = forumConfig.replyRefreshMinutes ?? 0;

      if (postRefreshMinutes > 0 && Date.now() - (forumConfig.lastPostRefreshAt || 0) >= postRefreshMinutes * 60 * 1000) {
        const recentChatLines = Object.entries(store.chats)
          .flatMap(([charId, messages]) => messages.slice(-2).map(msg => `${store.characters[charId]?.name || charId}:${msg.text}`))
          .slice(-8)
          .join('\n');
        const worldCtx = store.worldSettings?.map(ws => `${ws.title}：${ws.content}`).join('\n') || '';
        const newPosts = await generateForumSeedPosts(recentChatLines, 2, undefined, forumUserHandle, worldCtx);
        newPosts.forEach(post => store.saveForumPost(post));
        store.updateSettings({
          forum: {
            ...(store.settings.forum || {}),
            lastPostRefreshAt: Date.now()
          }
        });
      }

      if (replyRefreshMinutes > 0 && Date.now() - (forumConfig.lastReplyRefreshAt || 0) >= replyRefreshMinutes * 60 * 1000) {
        const duePosts = store.forumPosts.filter(post => post.nextReplyAt && post.nextReplyAt <= Date.now() && (post.subscribed || post.authorHandle === forumUserHandle));
        for (const post of duePosts) {
          const latestUserComment = [...post.comments].reverse().find(comment => comment.authorHandle === forumUserHandle);
          const newComments = (await generateForumReplyBatch(post, latestUserComment))
            .filter(comment => !blockedHandles.includes(comment.authorHandle))
            .map((comment, index) => index === 0 && latestUserComment ? {
              ...comment,
              replyToId: latestUserComment.id,
              replyToHandle: latestUserComment.authorHandle
            } : comment);
          if (!newComments.length) continue;
          store.saveForumPost({
            ...post,
            comments: [...post.comments, ...newComments],
            updatedAt: Date.now(),
            nextReplyAt: scheduleNextReplyAt(replyRefreshMinutes)
          });
          store.setNotification({
            id: Date.now(),
            title: newComments[0].authorHandle,
            text: `${newComments[0].authorHandle}回复了您的评论`,
            sourceApp: 'forum',
            openApp: 'forum',
            avatar: FORUM_ICON,
            forumPostId: post.id,
          });
          const sourceCharacterId = newComments[0].authorSourceId;
          if (sourceCharacterId && store.characters[sourceCharacterId]) {
            store.sendAdvancedMessage(sourceCharacterId, {
              senderId: sourceCharacterId,
              text: `刚刷到你在论坛发的那条《${post.title}》。\n\n我在下面回你了。\n\n你如果愿意，也可以继续和我说。`
            });
          }
        }
        store.updateSettings({
          forum: {
            ...(store.settings.forum || {}),
            lastReplyRefreshAt: Date.now()
          }
        });
      }

    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // ── Midnight dream check ──
  useEffect(() => {
    const check = () => {
      const store = useAppStore.getState();
      const today = new Date().toISOString().split('T')[0];
      if (store.settings.lastDreamDate === today) return;
      const now = new Date();
      if (now.getHours() < 1) { // 0:00~0:59 = midnight
        for (const charId of Object.keys(store.characters)) {
          try { dream(charId); } catch {}
          // ~30% chance to auto-generate a prose dream
          if (Math.random() < 0.3) {
            generateDream(charId).catch(() => {});
          }
        }
        store.updateSettings({ lastDreamDate: today });
      }
    };
    check();
    const timer = setInterval(check, 60000);
    return () => clearInterval(timer);
  }, []);

  // ── Weather alert engine ──
  // Periodically checks tomorrow's weather; if abnormal, the character sends a proactive message.
  useEffect(() => {
    const today = () => new Date().toISOString().slice(0, 10);

    const checkWeather = async () => {
      try {
        const s = useAppStore.getState();
        if (s.settings.lastWeatherAlertDate === today()) return;

        const { getLocation, fetchWeather, checkAbnormalWeather, getCityName, getWeatherAdvice } = await import('../lib/weather');
        const { lat, lon } = await getLocation();
        const weather = await fetchWeather(lat, lon);
        const city = await getCityName(lat, lon);
        weather.city = city;

        const alert = checkAbnormalWeather(weather.today, weather.tomorrow);
        if (!alert) return;

        // Pick the best character to send the message
        const chars = Object.values(s.characters).filter((c: any) => !c.isDisabled);
        const lover = chars.find((c: any) => c.relationshipStatus === 'married' || c.relationshipStatus === 'engaged' || c.relationshipStatus === 'dating');
        const target = lover || chars.sort((a: any, b: any) => (b.affection ?? 50) - (a.affection ?? 50))[0];
        if (!target) return;

        const msg = await getWeatherAdvice(alert, target.name, target.personality, target.relationship || '朋友', target.affection ?? 50);
        if (msg) {
          s.sendAdvancedMessage(target.id, { text: msg, senderId: target.id });
          s.updateSettings({ lastWeatherAlertDate: today() } as any);
        }
      } catch {
        // Silently ignore location/network errors
      }
    };

    // Initial check after a 20-minute delay — give user time to configure characters
    const initialTimer = setTimeout(checkWeather, 1200000);

    // Subsequent checks at random 15–45 minute intervals
    const scheduleNext = () => {
      const min = 15 * 60000;
      const max = 45 * 60000;
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      return setTimeout(async () => {
        await checkWeather();
        nextTimer = scheduleNext();
      }, delay);
    };
    let nextTimer: NodeJS.Timeout = scheduleNext();

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(nextTimer);
    };
  }, []);

  useEffect(() => {
    if (settings.customCode) {
      try {
        const func = new Function('React', 'useState', 'useEffect', 'useRef', settings.customCode);
        func(React, useState, useEffect, useRef);
      } catch (e) {
        console.error('Failed to execute custom code:', e);
      }
    }
  }, [settings.customCode]);

  // Inject custom font from IndexedDB (data stored there, not in localStorage)
  useEffect(() => {
    const fontName = settings.customFontName;
    if (!fontName) {
      // No font configured — remove any previously injected font
      removeInjectedFont();
      return;
    }

    loadAndInjectFont(fontName);
  }, [settings.customFontName]);

  const renderApp = () => {
    const appContent = (() => {
      switch (currentApp) {
        case 'wechat': return <WeChatApp />;
        case 'music': return <MusicApp />;
        case 'settings': return <SettingsApp />;
        case 'tarot': return <TarotApp />;
        case 'bottle': return <BottleApp />;
        case 'worldbook': return <WorldBookApp />;
        case 'liarsbar': return <LiarsBarApp />;
        case 'jubensha': return <JubenshaApp />;
        case 'ifapp': return <IFApp />;
        case 'vocab': return <VocabApp />;
        case 'copet': return <CoPetApp />;
        case 'focus': return <FocusApp />;
        case 'reader': return <ReaderApp />;
        case 'calendar': return <CalendarApp />;
        case 'billing': return <BillingApp />;
        case 'beautify': return <BeautifyApp />;
        case 'news': return <NewsApp />;
        case 'desktoppet': return <DesktopPetApp />;
        case 'writing': return <WritingApp />;
        case 'diary': return <DiaryApp />;
        case 'couplediary': return <CoupleDiaryApp onBack={closeApp} />;
        case 'movie': return <MovieApp onBack={closeApp} />;
        case 'mailbox': return <MailboxApp />;
        case 'forum': return <ForumApp />;
        case 'memory': return <MemoryApp />;
        case 'hunter': return <HunterApp />;
        case 'marriage': return <MarriageBureau />;
        case 'weather': return <WeatherApp onBack={closeApp} />;
        case 'dream': return <DreamApp />;
        default: return null;
      }
    })();

    if (worldBookRequired) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 p-6">
          <div className="text-6xl mb-6">📖</div>
          <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mb-3 text-center">请先启用世界书</h2>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-8 text-center leading-relaxed">
            使用此功能前，请先在世界书中创建一个世界观并启用它。
          </p>
          <button
            onClick={() => openApp('worldbook')}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-full shadow-lg hover:scale-105 transition-transform"
          >
            前往世界书
          </button>
        </div>
      );
    }

    return appContent;
  };

  return (
    <div className="min-h-[100dvh] bg-gray-900">
      <div className="relative w-full h-[100dvh] bg-black overflow-hidden flex flex-col">

        {!(widgets?.some?.(w => w.type === 'time_bar') && !currentApp && !isLocked) && (
           <StatusBar />
        )}

        {/* Phone content */}
        <div className="flex-1 flex flex-col">
          <AnimatePresence>
          {isLocked ? (
            <LockScreen key="lock" />
          ) : (
            <motion.div 
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0"
            >
              <HomeScreen />
              <DesktopPetOverlay />
              
              <AnimatePresence>
                {currentApp && (
                  <motion.div
                    key="app"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 z-40 bg-white"
                  >
                    {renderApp()}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Floating Music Player */}
          <FloatingMusicPlayer />

        {/* Notification Banner */}
        {/* Notification permission prompt */}
        {'Notification' in window && Notification.permission === 'default' && !isLocked && (
          <div className="absolute top-32 left-3 right-3 z-[9999]">
            <div className="bg-white/90 dark:bg-zinc-800/90 backdrop-blur-xl rounded-[22px] px-4 py-3 flex items-center shadow-2xl border border-white/40 dark:border-white/10">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                <span className="text-lg">🔔</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">开启消息通知</div>
                <div className="text-xs text-gray-500">切到其他App也能收到角色消息</div>
              </div>
              <button
                onClick={() => {
                  Notification.requestPermission().then(p => {
                    if (p === 'granted') setNotifGranted(true);
                  });
                }}
                className="bg-blue-500 text-white px-4 py-1.5 rounded-full text-sm font-medium active:scale-95 transition-transform"
              >
                开启
              </button>
            </div>
          </div>
        )}

        {notification && !isLocked && (
           <div 
             className="absolute top-8 left-3 right-3 bg-white/88 dark:bg-zinc-800/92 backdrop-blur-xl rounded-[22px] px-3 py-3 flex shadow-2xl z-[9999] animate-slide-down cursor-pointer border border-white/40 dark:border-white/10"
             onClick={() => {
                clearNotification();
                const targetApp = notification.openApp || (notification.sourceApp === 'forum' ? 'forum' : 'wechat');
                openApp(targetApp);
                if (targetApp === 'wechat') {
                  const update: any = {};
                  if (notification.characterId && notification.text?.includes('请求添加你为朋友')) {
                    update.activeWeChatTab = 'contacts';
                  } else if (notification.characterId) {
                    update.activeWeChatCharId = notification.characterId;
                  }
                  if (Object.keys(update).length) useAppStore.getState().updateSettings(update as any);
                }
             }}
           >
             <div 
               className="w-10 h-10 rounded-[12px] mr-3 flex-shrink-0 bg-cover bg-center shadow-sm" 
               style={{ backgroundImage: `url(${notification.avatar || characters[notification.characterId || '']?.avatar})`, backgroundColor: notification.avatar ? 'transparent' : characters[notification.characterId || '']?.avatar || '#94a3b8' }} 
             />
             <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{notification.title || characters[notification.characterId || '']?.name || '消息'}</span>
                  <span className="text-[10px] text-gray-400">{notification.sourceApp === 'forum' ? '论坛' : notification.sourceApp === 'mailbox' ? '信箱' : '微信'}</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 truncate leading-5">
                  {notification.text}
                </div>
             </div>
           </div>
        )}

        {/* Home Indicator */}
        {!isLocked && (
          <div className="absolute bottom-0 inset-x-0 h-8 flex justify-center items-end pb-2 z-[100] pointer-events-none">
            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(e, info) => {
                if (info.offset.y < -30 || info.velocity.y < -100) {
                  const state = useAppStore.getState();
                  if (state.currentApp) state.closeApp();
                  else state.lock();
                }
              }}
              className="w-1/3 h-1.5 bg-gray-300 mix-blend-difference rounded-full cursor-pointer hover:bg-white/80 transition-colors pointer-events-auto touch-none"
              onClick={() => {
                 const state = useAppStore.getState();
                 if (state.currentApp) state.closeApp();
                 else state.lock();
              }}
            />
          </div>
        )}

        </div>{/* end phone-content wrapper */}

        {/* Character Phone Check Overlay */}
        {charPhoneCheck.isActive && charPhoneCheck.characterId && (
          <CharacterPhoneCheckOverlay
            characterId={charPhoneCheck.characterId}
            onFinish={async (id) => {
              const store = useAppStore.getState();
              const char = store.characters[id];
              const persona = store.settings.persona;

              // 只收集角色实际查看过的内容（基于 navigatedAppsRef）
              const viewed = new Set(navigatedAppsRef.current);
              let dataForAI = '';
              if (viewed.has('wechat')) {
                const partnerIds = Object.keys(store.characters).filter(
                  cid => cid !== id && store.characters[cid]?.isWeChatFriend !== false && (store.chats[cid] || []).length > 0
                );
                for (const pid of partnerIds.slice(0, 2)) {
                  const pName = store.characters[pid]?.name || pid;
                  const msgs = (store.chats[pid] || []).slice(-4);
                  if (msgs.length > 0) {
                    dataForAI += `和${pName}的聊天内容：`;
                    for (const m of msgs) {
                      dataForAI += `${m.senderId === 'user' ? persona?.name || '你' : pName}说「${(m.text || '').slice(0, 20)}」`;
                      if (m !== msgs[msgs.length-1]) dataForAI += '，';
                    }
                    dataForAI += '。\n';
                  }
                }
              }
              if (viewed.has('diary') && (store.diaryEntries || []).length > 0) {
                const d = store.diaryEntries[0];
                dataForAI += `日记内容：「${d?.content?.slice(0, 60) || d?.title || ''}」。\n`;
              }
              if (viewed.has('forum') && (store.forumPosts || []).length > 0) {
                const f = store.forumPosts[0];
                dataForAI += `论坛帖子内容：「${f?.content?.slice(0, 60) || f?.title || ''}」。\n`;
              }
              if (viewed.has('music') && (store.songs || []).length > 0) {
                dataForAI += `收藏了音乐：${store.songs[0]?.title || ''}。\n`;
              }
              if (viewed.has('couplediary') && (store.coupleDiaries || []).length > 0) {
                const cd = store.coupleDiaries[0];
                if (cd.entries?.length > 0) dataForAI += `情侣日记：「${cd.entries[0]?.content?.slice(0, 60) || ''}」。\n`;
              }

              // AI 生成印象摘要写进记忆
              let impression = dataForAI.slice(0, 300);
              try {
                const summary = await generateAIResponse(
                  `你正在扮演${char?.name || '一个角色'}。你刚刚查了${persona?.name || '对方'}的手机，看到了以下内容。请用1-2句话概括你的印象——你觉得对方平时在做什么、和谁聊天、有什么兴趣爱好。像是在和朋友八卦一样自然地说出来。不要数数，不要说具体多少条/多少篇，只说大概感觉。

你看到的内容：
${dataForAI}

只输出你的印象，不要加括号引号。`
                );
                if (summary?.trim()) impression = summary.trim();
              } catch {}

              store.addCharacterMemory(id, {
                type: 'event',
                content: `查看了${persona?.name || '对方'}的手机。${impression}`,
                summary: impression.slice(0, 150),
                tags: ['char_phone_check', 'completed'], valence: 0.3, arousal: 0.3, importance: 7, layer: 'daily', resolved: 0,
              });

              store.sendMessage(id, '[系统] 手机检查结束了。');

              if (char) {
                try {
                  const reply = await generateAIResponse(
                    `你正在扮演${char.name}。性格：${char.personality || ''}。关系：${char.relationship || '朋友'}。用户：${persona.name || '你'}。

你刚刚查看了${persona?.name || '对方'}的手机。整体印象：${impression}
根据你的印象，用1-2句话自然回应。不要无证据说对方出轨。如果没看到什么就放心/安心。不可以说具体数字（几条聊天、几篇日记、几首音乐等），只说你的感觉。
严禁动作描写、神态描写、心理描写。不加括号、引号、星号。直接以文字开头。`
                  );
                  if (reply?.trim()) useAppStore.getState().receiveMessage(id, reply.trim());
                } catch {}
              }

              useAppStore.getState().endCharPhoneCheck();
            }}
            onGrabBack={async (id) => {
              const store = useAppStore.getState();
              store.sendMessage(id, '[系统] 你抢回了手机。');
              store.addCharacterMemory(id, {
                type: 'event',
                content: `我正在查看${store.settings.persona?.name || '对方'}的手机，被对方抢回去了，只看到了一部分`,
                summary: '查手机被抢回',
                tags: ['char_phone_check', 'grabbed_back'], valence: 0.1, arousal: 0.7, importance: 7, layer: 'daily', resolved: 0,
              });

              // 抢回也要有 AI 回复
              const char = store.characters[id];
              if (char) {
                try {
                  const reply = await generateAIResponse(
                    `你正在扮演${char.name}。性格：${char.personality || ''}。关系：${char.relationship || '朋友'}。用户：${store.settings.persona?.name || '你'}。

你正在查看${store.settings.persona?.name || '对方'}的手机，被对方一把抢回去了。根据你的性格，用1-2句话自然回应。
严禁动作描写、神态描写、心理描写。不加括号、引号、星号。直接以文字开头。`
                  );
                  if (reply?.trim()) useAppStore.getState().receiveMessage(id, reply.trim());
                } catch {}
              }

              useAppStore.getState().endCharPhoneCheck();
            }}
          />
        )}

      </div>
    </div>
  );
}
