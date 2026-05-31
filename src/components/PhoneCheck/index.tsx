import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store';
import { useCharPhoneSettings, type PhoneSettings } from './useSettings';
import { generateAIResponse } from '../../lib/ai';
import {
  generateMockPhoneData,
  incrementPhoneData,
  generatePhoneCheckMoments,
  generateInitialPhotos,
  incrementPhotos,
  generateInitialCallLog,
  incrementCallLog,
  loadCallLogData,
  saveCallLogData,
} from './data';
import type { PhoneCheckData, PhoneCheckMoments, PhonePhoto, PhoneContact, MomentComment, CallLogData } from './data';
import LockScreen from './LockScreen';
import PasscodeScreen from './PasscodeScreen';
import HomeScreen from './HomeScreen';
import WeChatApp from './WeChatApp';
import SettingsApp from './SettingsApp';
import PhotosApp from './PhotosApp';
import MusicApp from './MusicApp';
import PhoneApp from './PhoneApp';
import CameraApp from './CameraApp';
import CalendarApp from './CalendarApp';

const STORAGE_CHAT_KEY = 'phone_check_data_';
const STORAGE_MOMENTS_KEY = 'phone_check_moments_';

export interface PhoneCheckActions {
  sentMessages: { contactName: string; text: string }[];
  postedMoments: { content: string }[];
  settingsChanges: string[];
  viewedAlbums: boolean;
  playedMusic: boolean;
  grabbedBack?: boolean;
  usedCamera: boolean;
}

interface Props {
  characterId: string;
  character: { name: string; personality: string; avatar?: string; background?: string; momentsBackground?: string; affection?: number; relationship?: string; biography?: string };
  userMessage: string;
  grabMode?: boolean;
  onClose: (actions: PhoneCheckActions) => void;
}

type ScreenState = 'lock' | 'passcode' | 'home' | 'wechat' | 'photos' | 'music' | 'settings' | 'phone' | 'camera' | 'calendar';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, data: any) {
  localStorage.setItem(key, JSON.stringify(data));
}

export default function PhoneCheck({ characterId, character, userMessage, grabMode, onClose }: Props) {
  const store = useAppStore.getState();
  const allChars = store.characters;

  const phoneSettings = useCharPhoneSettings(characterId, character.avatar, character.background);
  const { lockscreenWallpaper, homeWallpaper, passcode } = phoneSettings;

  const callerName = store.characters[characterId]?.userNickname || '你';
  const callerRelation = character.relationship || '朋友';

  // Track which camera photos already had memory saved
  const memorizedPhotoIdsRef = useRef<Set<string>>(new Set());

  const [phoneData, setPhoneData] = useState<PhoneCheckData | null>(null);
  const [moments, setMoments] = useState<PhoneCheckMoments>({ posts: [] });
  const [photos, setPhotos] = useState<PhonePhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [callLog, setCallLog] = useState<CallLogData>({ records: [] });
  const [screen, setScreen] = useState<ScreenState>('lock');
  const [loaded, setLoaded] = useState(false);

  // Track user actions
  const actionsRef = useRef<PhoneCheckActions>({
    sentMessages: [],
    postedMoments: [],
    settingsChanges: [],
    viewedAlbums: false,
    playedMusic: false,
    grabbedBack: false,
    usedCamera: false,
  });

  // Grab mode: 10-second countdown, auto-close on 0
  const [grabCountdown, setGrabCountdown] = useState(10);
  const handleCloseRef = useRef<() => void>(() => {});
  useEffect(() => { handleCloseRef.current = handleClose; });

  useEffect(() => {
    if (!grabMode) return;
    setGrabCountdown(10);
    const timer = window.setInterval(() => {
      setGrabCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [grabMode]);

  useEffect(() => {
    if (grabMode && grabCountdown <= 0) {
      handleCloseRef.current();
    }
  }, [grabMode, grabCountdown]);

  // Initialize data on mount — no AI decision call (already handled by WeChatApp)
  useEffect(() => {
    const init = async () => {
      try {
      // Load or generate phone data
      let existingData = loadJSON<PhoneCheckData | null>(STORAGE_CHAT_KEY + characterId, null);
      const existingMoments = loadJSON<PhoneCheckMoments | null>(STORAGE_MOMENTS_KEY + characterId, null);

      // Migrate old data: add personality if missing
      if (existingData?.contacts) {
        let migrated = false;
        for (const c of existingData.contacts) {
          if (!c.personality) {
            (c as any).personality = c.relationship === '家人' || c.relationship?.includes('父') || c.relationship?.includes('母') || c.relationship?.includes('兄') || c.relationship?.includes('弟') || c.relationship?.includes('姐') || c.relationship?.includes('妹') || c.relationship?.includes('子') || c.relationship?.includes('女') ? '亲切随和'
              : c.relationship === '手下' || c.relationship === '下属' || c.relationship === '学生' ? '恭敬礼貌'
              : c.relationship === '朋友' || c.relationship === '好友' ? '热情开朗'
              : '性格温和';
            migrated = true;
          }
        }
        if (migrated) saveJSON(STORAGE_CHAT_KEY + characterId, existingData);
      }

      let newData: PhoneCheckData | null = null;

      if (existingData && existingData.contacts?.length > 0) {
        newData = await incrementPhoneData(characterId, character, existingData, allChars, Date.now());
      } else {
        newData = await generateMockPhoneData(characterId, character, allChars, Date.now());
      }
      if (newData) {
        setPhoneData(newData);
        saveJSON(STORAGE_CHAT_KEY + characterId, newData);
      }

      // Moments
      const contacts = newData?.contacts || existingData?.contacts || [];
      const newMoments = await generatePhoneCheckMoments(characterId, character, contacts, existingMoments, Date.now());
      setMoments(newMoments);
      saveJSON(STORAGE_MOMENTS_KEY + characterId, newMoments);

      // Photos — load or init with increment
      const existingPhotos = loadJSON<PhonePhoto[] | null>('phone_photos_v2_' + characterId, null);
      if (existingPhotos && existingPhotos.length > 0) {
        const newPhotos = await incrementPhotos(
          { name: character.name, personality: character.personality, biography: character.biography },
          characterId,
          existingPhotos,
          Date.now(),
        );
        setPhotos(newPhotos);
        saveJSON('phone_photos_v2_' + characterId, newPhotos);
      } else {
        const newPhotos = await generateInitialPhotos(
          { name: character.name, personality: character.personality, biography: character.biography },
          characterId,
          Date.now(),
        );
        setPhotos(newPhotos);
        saveJSON('phone_photos_v2_' + characterId, newPhotos);
      }
      setPhotosLoading(false);

      // Merge camera photos from previous sessions into main gallery
      try {
        const cameraPhotosRaw = localStorage.getItem('phone_camera_photos_' + characterId);
        if (cameraPhotosRaw) {
          const cameraPhotos = JSON.parse(cameraPhotosRaw);
          if (Array.isArray(cameraPhotos) && cameraPhotos.length > 0) {
            const mainKey = 'phone_photos_v2_' + characterId;
            const currentMain = loadJSON<PhonePhoto[]>(mainKey, []);
            const existingIds = new Set(currentMain.map(p => p.id));
            let added = 0;
            for (const cp of cameraPhotos) {
              const photoId = 'camera_photo_' + cp.id;
              if (!existingIds.has(photoId)) {
                currentMain.push({
                  id: photoId,
                  description: cp.desc || '照片',
                  palette: '#f0f0f0',
                  category: '相机拍摄',
                  timestamp: cp.timestamp || Date.now(),
                });
                existingIds.add(photoId);
                added++;
              }
            }
            if (added > 0) {
              setPhotos(currentMain);
              localStorage.setItem(mainKey, JSON.stringify(currentMain));
            }
          }
        }
      } catch {}

      // Call log — load or generate
      const existingCallLog = loadCallLogData(characterId);
      if (existingCallLog && existingCallLog.records.length > 0) {
        const updated = await incrementCallLog(
          { name: character.name, personality: character.personality, biography: character.biography },
          characterId,
          contacts,
          existingCallLog,
          Date.now(),
        );
        setCallLog(updated);
        saveCallLogData(characterId, updated);
      } else {
        const initial = await generateInitialCallLog(
          { name: character.name, personality: character.personality, biography: character.biography },
          characterId,
          contacts,
          Date.now(),
        );
        setCallLog(initial);
        saveCallLogData(characterId, initial);
      }

      } catch (e) {
        console.error('phone check init error', e);
      }

      setLoaded(true);
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSendMessage = useCallback((contactId: string, text: string) => {
    if (!phoneData) return;
    setPhoneData(prev => {
      if (!prev) return prev;
      const updated = { ...prev, contacts: [...prev.contacts] };
      const contactIdx = updated.contacts.findIndex(c => c.id === contactId);
      if (contactIdx >= 0) {
        updated.contacts = [...updated.contacts];
        updated.contacts[contactIdx] = {
          ...updated.contacts[contactIdx],
          messages: [
            ...updated.contacts[contactIdx].messages,
            { id: Math.random().toString(36).slice(2, 10), text, sender: 'me' as const, timestamp: Date.now() },
          ],
        };
      }
      saveJSON(STORAGE_CHAT_KEY + characterId, updated);
      return updated;
    });
    actionsRef.current.sentMessages.push({
      contactName: phoneData.contacts.find(c => c.id === contactId)?.name || '未知',
      text,
    });
  }, [characterId, phoneData]);

  const handlePostMoment = useCallback(async (content: string) => {
    const postId = Math.random().toString(36).slice(2, 10);
    const newPost = {
      id: postId,
      authorName: character.name,
      authorAvatar: character.avatar || '#07C160',
      content,
      timestamp: Date.now(),
      comments: [] as MomentComment[],
    };

    // AI decides who comments and what they say
    const contacts = phoneData?.contacts || [];
    if (contacts.length > 0) {
      const contactsDesc = contacts.map(c =>
        `- ${c.name}（性格：${c.personality || '性格温和'}，关系：${c.relationship || '朋友'}）`
      ).join('\n');

      const prompt = `你正在扮演${character.name}的角色。

${character.name}（${character.personality}）发了一条朋友圈，内容是：
「${content}」

${character.name}的${callerRelation}${callerName}正拿${character.name}的手机发朋友圈。所以发朋友圈的人实际上是${callerName}，不是${character.name}本人。

以下是一些微信好友看到了这条朋友圈。请自行判断哪些好友会回复评论、回复什么内容。你可以让任意数量的人回复——可能只有一两个人觉得有意思就评论了，也可能很多人都来凑热闹，也可能根本没人评论。

联系人：
${contactsDesc}

回复要求：
1. 回复内容必须和朋友圈内容相关
2. **根据朋友圈的语气判断**：如果内容语气像${character.name}本人，就当是${character.name}发的正常评论
3. 如果内容语气不像${character.name}（比如用词风格不同、态度不对），要判断发的人可能不是本人
4. 如果知道${callerName}（${character.name}的${callerRelation}），可能会问"你不是${character.name}吧？${callerName}？"
5. 如果不知道对方是谁但觉得不对劲，可以说"这不太像你发的"
6. 如果觉得就是本人，正常评论
7. 【强制】只用对话，禁止任何动作描写、环境描写、心理描写、神态描写
8. 【强制】不要用引号括住整句话

以 JSON 数组格式输出——如果没人评论就输出空数组：
[
  { "authorName": "联系人名字", "text": "评论内容" }
]`;

      try {
        const text = await generateAIResponse(prompt);
        const json = text?.match(/\[[\s\S]*\]/)?.[0];
        if (json) {
          const comments = JSON.parse(json);
          if (Array.isArray(comments)) {
            newPost.comments = comments
              .map((c: any) => ({
                authorName: c.authorName || '匿名',
                text: c.text || '',
              }))
              .filter(c => c.text.trim().length > 0);
          }
        }
      } catch {}
    }

    setMoments(prev => {
      const updated = { posts: [...prev.posts, newPost] };
      saveJSON(STORAGE_MOMENTS_KEY + characterId, updated);
      return updated;
    });
    actionsRef.current.postedMoments.push({ content });
  }, [characterId, character, callerName, callerRelation, phoneData]);

  const handleClose = useCallback(() => {
    // Save final state
    if (phoneData) saveJSON(STORAGE_CHAT_KEY + characterId, phoneData);
    if (moments) saveJSON(STORAGE_MOMENTS_KEY + characterId, moments);

    // Add memory for phone check end
    const store = useAppStore.getState();
    const actions = actionsRef.current;
    let summary = '查看了我的手机';
    if (actions.sentMessages.length > 0) {
      summary += '，冒充我给别人发了消息';
    }
    if (actions.postedMoments.length > 0) {
      summary += '，用我的账号发了朋友圈';
    }
    if (actions.settingsChanges.length > 0) {
      summary += '，还修改了手机设置';
    }
    if (actions.usedCamera) {
      summary += '，用相机拍了照片';
    }
    if (actions.grabbedBack) {
      summary += '（被角色抢回手机）';
    }
    store.addCharacterMemory(characterId, {
      type: 'event',
      content: summary,
      summary: summary.slice(0, 150),
      tags: ['phone_check', 'privacy'],
      valence: actions.grabbedBack ? 0.1 : 0.3,
      arousal: 0.6,
      importance: 6,
      layer: 'daily',
      resolved: 0,
    });

    // Mark as grabbed back when in grab mode
    if (grabMode) {
      actions.grabbedBack = true;
    }

    onClose(actions);
  }, [characterId, phoneData, moments, onClose, grabMode]);

  if (!loaded || !phoneData) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
        {grabMode && (
          <div className={'absolute top-0 inset-x-0 py-2 px-4 text-center text-sm font-bold ' + (
            grabCountdown <= 5 ? 'bg-red-600/90 text-white animate-pulse' : 'bg-black/60 text-white/90'
          )}>
            ⏱ 还剩 {grabCountdown} 秒 · {character.name} 随时会抢回手机
          </div>
        )}
        <div className="text-white/50 text-sm">加载中...</div>
      </div>,
      document.body
    );
  }

  const renderScreen = () => {
    switch (screen) {
      case 'lock':
        return (
          <LockScreen
            wallpaper={lockscreenWallpaper}
            onUnlock={() => setScreen(passcode ? 'passcode' : 'home')}
            onClose={handleClose}
          />
        );
      case 'passcode':
        return (
          <PasscodeScreen
            passcode={passcode}
            onUnlock={() => setScreen('home')}
            onClose={handleClose}
          />
        );
      case 'home':
        return (
          <HomeScreen wallpaper={homeWallpaper} onOpenApp={(app) => setScreen(app as ScreenState)} />
        );
      case 'wechat':
        return (
          <WeChatApp
            phoneData={phoneData}
            moments={moments}
            ownerName={character.name}
            ownerAvatar={character.avatar || '#07C160'}
            ownerPersonality={character.personality}
            ownerCover={character.momentsBackground || character.background}
            callerName={callerName}
            callerRelation={callerRelation}
            isDark={false}
            onBack={() => setScreen('home')}
            onSendMessage={handleSendMessage}
            onPostMoment={handlePostMoment}
          />
        );
      case 'photos':
        return (
          <PhotosApp
            photos={photos}
            loading={photosLoading}
            onHome={() => {
              actionsRef.current.viewedAlbums = true;
              setScreen('home');
            }}
          />
        );
      case 'music':
        return (
          <MusicApp
            characterId={characterId}
            character={character}
            onHome={() => {
              actionsRef.current.playedMusic = true;
              setScreen('home');
            }}
            onPlayed={() => {
              actionsRef.current.playedMusic = true;
            }}
          />
        );
      case 'phone':
        return (
          <PhoneApp
            characterId={characterId}
            character={character}
            onHome={() => setScreen('home')}
            callLogData={callLog}
          />
        );
      case 'calendar':
        return (
          <CalendarApp
            characterId={characterId}
            character={character}
            callerName={callerName}
            onHome={() => setScreen('home')}
          />
        );
      case 'camera':
        return (
          <CameraApp
            characterId={characterId}
            onHome={() => setScreen('home')}
            onPhotosTaken={(newPhotos) => {
              actionsRef.current.usedCamera = true;
              // Sync camera photos into main gallery
              const key = 'phone_photos_v2_' + characterId;
              try {
                const raw = localStorage.getItem(key);
                const mainPhotos: PhonePhoto[] = raw ? JSON.parse(raw) : [];
                const existingIds = new Set(mainPhotos.map(p => p.id));
                const cameraRaw = localStorage.getItem('phone_camera_photos_' + characterId);
                if (cameraRaw) {
                  const cameraPhotos = JSON.parse(cameraRaw);
                  let changed = false;
                  for (const cp of cameraPhotos) {
                    const photoId = 'camera_photo_' + cp.id;
                    if (!existingIds.has(photoId)) {
                      mainPhotos.push({
                        id: photoId,
                        description: cp.desc || '照片',
                        palette: '#f0f0f0',
                        category: '相机拍摄',
                        timestamp: cp.timestamp || Date.now(),
                      });
                      existingIds.add(photoId);
                      changed = true;
                    }
                  }
                  if (changed) {
                    localStorage.setItem(key, JSON.stringify(mainPhotos));
                    setPhotos(mainPhotos);
                  }
                }
              } catch {}
              // Save character memory for newly taken photos
              for (const cp of newPhotos) {
                if (cp.desc && cp.desc !== '一张照片' && !memorizedPhotoIdsRef.current.has(cp.id)) {
                  memorizedPhotoIdsRef.current.add(cp.id);
                  try {
                    useAppStore.getState().addCharacterMemory(characterId, {
                      type: 'observation',
                      content: '用户在我的手机上拍摄/导入了一张照片：' + cp.desc,
                      summary: '拍照片：' + (cp.desc.length > 60 ? cp.desc.slice(0, 60) + '…' : cp.desc),
                      tags: ['phone_check', 'camera', 'photo'],
                      valence: 0.3,
                      arousal: 0.3,
                      importance: 5,
                      layer: 'daily',
                      resolved: 0,
                    });
                  } catch {}
                }
              }
            }}
          />
        );
      case 'settings':
        return (
          <SettingsApp
            characterId={characterId}
            lockscreenWallpaper={lockscreenWallpaper}
            homeWallpaper={homeWallpaper}
            passcode={passcode}
            onSetLockWall={phoneSettings.setLockWall}
            onSetHomeWall={phoneSettings.setHomeWall}
            onSetPasscode={phoneSettings.setPasscode}
            onHome={() => setScreen('home')}
            onChange={(desc) => actionsRef.current.settingsChanges.push(desc)}
          />
        );
      default:
        return null;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-white text-black flex flex-col overflow-hidden">
      {/* Close button — always visible */}
      <button
        onClick={handleClose}
        className="absolute top-2 right-2 z-[10000] bg-red-500/90 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg hover:bg-red-600 active:scale-95 transition-all"
      >
        归还手机
      </button>

      {/* Grab mode countdown banner */}
      {grabMode && (
        <div className={'shrink-0 py-2 px-4 text-center text-sm font-bold ' + (
          grabCountdown <= 5 ? 'bg-red-600/90 text-white animate-pulse' : 'bg-black/60 text-white/90'
        )}>
          ⏱ 还剩 {grabCountdown} 秒 · {character.name} 随时会抢回手机
        </div>
      )}

      {/* Screen content — full bleed, no bars */}
      <div className="flex-1 relative overflow-hidden">
        {renderScreen()}
      </div>
    </div>,
    document.body
  );
}
