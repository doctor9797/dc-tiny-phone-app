import React, { useState, useEffect, useRef } from 'react';
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
import FloatingMusicPlayer from './Music/FloatingMusicPlayer';
import { AnimatePresence, motion } from 'framer-motion';
import { format, differenceInMinutes, parse, startOfDay, addDays } from 'date-fns';
import { getCharacterReply } from '../lib/ai';
import { generateAIResponse } from '../lib/ai';
import { FORUM_ICON, generateForumReplyBatch, generateForumSeedPosts, scheduleNextReplyAt } from './Forum/forumUtils';

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
  const { isLocked, currentApp, settings, calendarRecords, updateCalendarRecord, characters, sendAdvancedMessage, widgets, notification, clearNotification, openApp, activeWorldSettingId, closeApp } = useAppStore();

  const APPS_REQUIRING_WORLD_BOOK = ['music', 'tarot', 'bottle', 'liarsbar', 'jubensha', 'ifapp', 'vocab', 'copet', 'focus', 'reader', 'calendar', 'billing', 'beautify', 'news', 'desktoppet', 'writing', 'diary', 'mailbox', 'forum'];
  const needsWorldBook = currentApp && currentApp !== 'worldbook' && currentApp !== 'wechat' && APPS_REQUIRING_WORLD_BOOK.includes(currentApp);
  const worldBookRequired = needsWorldBook && !activeWorldSettingId;

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

      const forumConfig = store.settings.forum || {};
      const forumUserHandle = forumConfig.userHandle || '夜里不睡';
      const blockedHandles = forumConfig.blockedHandles || [];
      const postRefreshMinutes = forumConfig.postRefreshMinutes || 120;
      const replyRefreshMinutes = forumConfig.replyRefreshMinutes || 45;

      if (Date.now() - (forumConfig.lastPostRefreshAt || 0) >= postRefreshMinutes * 60 * 1000) {
        const recentChatLines = Object.entries(store.chats)
          .flatMap(([charId, messages]) => messages.slice(-2).map(msg => `${store.characters[charId]?.name || charId}:${msg.text}`))
          .slice(-8)
          .join('\n');
        const newPosts = await generateForumSeedPosts(recentChatLines, 2);
        newPosts.forEach(post => store.saveForumPost(post));
        store.updateSettings({
          forum: {
            ...(store.settings.forum || {}),
            lastPostRefreshAt: Date.now()
          }
        });
      }

      if (Date.now() - (forumConfig.lastReplyRefreshAt || 0) >= replyRefreshMinutes * 60 * 1000) {
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
        case 'couplediary': return <CoupleDiaryApp />;
        case 'movie': return <MovieApp onBack={closeApp} />;
        case 'mailbox': return <MailboxApp />;
        case 'forum': return <ForumApp />;
        case 'memory': return <MemoryApp />;
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
    <div className="min-h-[100dvh] bg-gray-900 flex md:items-center md:justify-center md:p-4">
      <div className="relative w-full h-[100dvh] md:h-auto md:max-w-[400px] md:aspect-[9/19.5] bg-black md:rounded-[3rem] shadow-2xl overflow-hidden md:border-[8px] border-gray-800 flex flex-col">
        {!(widgets?.some?.(w => w.type === 'time_bar') && !currentApp && !isLocked) && (
           <StatusBar />
        )}
        
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-[100] pointer-events-none">
          <div className="w-40 h-full bg-gray-800 rounded-b-3xl"></div>
        </div>

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
        {notification && !isLocked && (
           <div 
             className="absolute top-8 left-3 right-3 bg-white/88 dark:bg-zinc-800/92 backdrop-blur-xl rounded-[22px] px-3 py-3 flex shadow-2xl z-[9999] animate-slide-down cursor-pointer border border-white/40 dark:border-white/10"
             onClick={() => {
                clearNotification();
                const targetApp = notification.openApp || (notification.sourceApp === 'forum' ? 'forum' : 'wechat');
                openApp(targetApp);
                if (targetApp === 'wechat' && notification.characterId) {
                  useAppStore.getState().updateSettings({ activeWeChatCharId: notification.characterId } as any);
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
      </div>
    </div>
  );
}
