import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, AppNotification, Character, Message, Moment, Song, UserSettings, WorldSetting, CharacterCard, PetState, ChatGroup, Book, JubenshaSession, NewsIssue, ActivityLog, IFSession, ForumDirectThread, CoupleDiary, SpecialEvent, VoiceApiConfig } from './types';

const initialCharacters: Record<string, Character> = {
  bruce: { id: 'bruce', name: '布鲁斯·韦恩', avatar: '#1a1a1a', background: '#333333', bubbleColor: '#4a4a4a', relationship: '朋友', interactionMode: '沉稳', personality: '深沉、多疑、富有责任感', userNickname: '你', affection: 50, remark: '布鲁斯', isStarred: false },
  alfred: { id: 'alfred', name: '阿尔弗雷德', avatar: '#4a5568', background: '#e2e8f0', bubbleColor: '#cbd5e1', relationship: '管家', interactionMode: '恭敬', personality: '睿智、忠诚、幽默', userNickname: '少爷/小姐', affection: 80, remark: '阿福', isStarred: false },
  dick: { id: 'dick', name: '理查德·格雷森', avatar: '#2b6cb0', background: '#ebf8ff', bubbleColor: '#bee3f8', relationship: '朋友', interactionMode: '开朗', personality: '阳光、乐观、富有领导力', userNickname: '你', affection: 60, remark: '迪克', isStarred: false },
  jason: { id: 'jason', name: '杰森·陶德', avatar: '#c53030', background: '#fff5f5', bubbleColor: '#fed7d7', relationship: '朋友', interactionMode: '暴躁', personality: '叛逆、冲动、内心柔软', userNickname: '你', affection: 40, remark: '杰森', isStarred: false },
  tim: { id: 'tim', name: '提姆·德雷克', avatar: '#c05621', background: '#fffff0', bubbleColor: '#fefcbf', relationship: '朋友', interactionMode: '理智', personality: '聪明、谨慎、工作狂', userNickname: '你', affection: 60, remark: '提姆', isStarred: false },
  damian: { id: 'damian', name: '达米安·韦恩', avatar: '#276749', background: '#f0fff4', bubbleColor: '#c6f6d5', relationship: '朋友', interactionMode: '傲慢', personality: '骄傲、好胜、渴望认同', userNickname: '你', affection: 30, remark: '达米安', isStarred: false },
  barbara: { id: 'barbara', name: '芭芭拉·戈登', avatar: '#6b46c1', background: '#faf5ff', bubbleColor: '#e9d8fd', relationship: '朋友', interactionMode: '知性', personality: '坚强、智慧、技术高超', userNickname: '你', affection: 70, remark: '芭芭拉', isStarred: false },
  kate: { id: 'kate', name: '凯特·凯恩', avatar: '#9b2c2c', background: '#fff5f5', bubbleColor: '#fed7d7', relationship: '朋友', interactionMode: '独立', personality: '坚韧、果敢、不羁', userNickname: '你', affection: 50, remark: '凯特', isStarred: false },
  stephanie: { id: 'stephanie', name: '史蒂芬妮·布朗', avatar: '#805ad5', background: '#faf5ff', bubbleColor: '#e9d8fd', relationship: '朋友', interactionMode: '活泼', personality: '开朗、乐观、永不言弃', userNickname: '你', affection: 60, remark: '史蒂芬妮', isStarred: false },
  cassandra: { id: 'cassandra', name: '卡珊德拉·该隐', avatar: '#2d3748', background: '#edf2f7', bubbleColor: '#e2e8f0', relationship: '朋友', interactionMode: '沉默', personality: '安静、敏锐、行动派', userNickname: '你', affection: 50, remark: '卡珊', isStarred: false },
};

const initialSettings: UserSettings = {
  apiBaseUrl: '',
  apiKey: '',
  apiModel: 'gemini-2.5-flash',
  voiceApiConfigs: [{
    id: 'default',
    baseUrl: 'https://api.minimax.chat/v1',
    groupId: '',
    apiKey: '',
    voiceId: 'female-shaonv',
    ttsModel: 'speech-02',
    sttModel: 'whisper-1',
    characterId: '',
    characterName: '',
  }],
  bilingual: false,
  wallpaper: '#1e293b',
  lockscreenWallpaper: '#0f172a',
  passcode: '',
  persona: {
    name: 'User',
    age: '20',
    profession: '平民',
    identity: '普通人',
    appearance: '普通',
    experience: '无',
  },
  wechatName: '我',
  wechatId: 'wxid_123456',
  signature: '这个人很懒，什么都没写',
  wechatAvatar: '#3b82f6',
  appIcons: {},
  appOrder: ['wechat', 'music', 'settings', 'tarot', 'bottle', 'worldbook', 'liarsbar', 'jubensha', 'ifapp', 'vocab', 'copet', 'focus', 'reader', 'calendar', 'billing', 'beautify', 'news', 'desktoppet', 'writing', 'diary', 'mailbox', 'forum'],
  dockApps: [],
  showDock: true,
  appNameOverrides: {},
  timeOffsetMinutes: 0,
  mailbox: {
    enabledSenderIds: ['alfred', 'dick'],
    frequencyByCharacter: {
      alfred: 'medium',
      dick: 'low',
    },
    lastReceivedAt: {}
  },
  forum: {
    userHandle: '夜里不睡',
    blockedHandles: [],
    postRefreshMinutes: 120,
    replyRefreshMinutes: 45,
    lastPostRefreshAt: 0,
    lastReplyRefreshAt: 0
  },
  desktopPet: {
    enabled: false,
    characterId: null,
    x: 260,
    y: 360,
    remindMode: false,
    lastReminderEventId: null
  }
};

const splitMessageText = (text: string) => {
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

const getMessageMetaFromText = (senderId: string, text: string) => {
  const trimmed = (text || '').trim();
  if (trimmed.startsWith('[系统]')) {
    return {
      type: 'system' as const,
    };
  }
  if (trimmed.startsWith('[礼物]')) {
    return {
      type: 'gift' as const,
      giftName: trimmed.replace('[礼物]', '').trim(),
      giftStatus: senderId === 'user' ? 'opened' as const : 'unopened' as const,
    };
  }
  if (trimmed.startsWith('[转账]')) {
    const amountMatch = trimmed.match(/¥(\d+(\.\d+)?)/);
    return {
      type: 'transfer' as const,
      amount: amountMatch ? parseFloat(amountMatch[1]) : undefined,
      transferStatus: 'pending' as const,
    };
  }
  return {};
};

const shouldDisplayNotification = (
  state: AppState & AppActions,
  notification: AppNotification | null
) => {
  if (!notification) return false;
  if (!notification.sourceApp) return true;

  if (notification.sourceApp === 'wechat') {
    if (state.currentApp !== 'wechat') return true;
    const activeChatId = state.settings.activeWeChatCharId || null;
    return Boolean(activeChatId && notification.characterId && activeChatId !== notification.characterId);
  }

  if (notification.sourceApp === 'forum') {
    return state.currentApp !== 'forum';
  }

  if (notification.sourceApp === 'mailbox') {
    return state.currentApp !== 'mailbox';
  }

  return true;
};

const isStoreCharacterEnabled = (state: AppState & AppActions, characterId: string) => {
  const character = state.characters[characterId];
  const card = state.worldSettings.flatMap(setting => setting.characters).find(char => char.id === characterId);
  if (!character) return false;
  if ((character as any).isDisabled === true) return false;
  if (card?.isEnabled === false) return false;
  return true;
};

interface AppActions {
  unlock: () => void;
  lock: () => void;
  openApp: (app: AppState['currentApp']) => void;
  closeApp: () => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  updateCharacter: (id: string, data: Partial<Character>) => void;
  removeCharacter: (id: string) => void;
  clearWeChatHistory: (characterId: string) => void;
  sendMessage: (characterId: string, text: string, imageUrl?: string, stickerUrl?: string, timestamp?: number) => void;
  receiveMessage: (characterId: string, text: string, minTimestamp?: number) => void;
  deleteChat: (characterId: string) => void;
  notification: AppNotification | null;
  notificationQueue: AppNotification[];
  clearNotification: () => void;
  addMoment: (moment: Omit<Moment, 'id' | 'timestamp' | 'likes' | 'comments'>) => void;
  addMomentComment: (momentId: string, authorId: string, text: string) => void;
  deleteMomentComment: (momentId: string, index: number) => void;
  deleteMoment: (momentId: string) => void;
  toggleMomentLike: (momentId: string, characterId: string) => void;
  addSong: (song: Omit<Song, 'id'>) => void;
  updateSong: (songId: string, updates: Partial<Song>) => void;
  deleteSong: (songId: string) => void;
  toggleSongFavorite: (songId: string) => void;
  addWorldSetting: (setting: Omit<WorldSetting, 'id'>) => void;
  updateWorldSetting: (id: string, setting: Partial<WorldSetting>) => void;
  deleteWorldSetting: (id: string) => void;
  setActiveWorldSetting: (id: string | null) => void;
  throwBottle: (text: string, imageUrl?: string, musicUrl?: string) => void;
  deleteBottle: (bottleId: string) => void;
  receiveBottleReply: (bottleId: string, reply: string) => void;
  addFriendRequest: (characterCard: CharacterCard) => void;
  acceptFriendRequest: (requestId: string) => void;
  addSticker: (url: string) => void;
  updateCoPet: (data: PetState | null) => void;
  sendAdvancedMessage: (channelId: string, msg: Partial<Message>) => void;
  updateWeChatBalance: (amount: number) => void;
  addWeChatGift: (gift: { id: string; name: string; senderId: string; timestamp: number }) => void;
  createWeChatGroup: (group: ChatGroup) => void;
  updateWeChatGroup: (id: string, updates: Partial<ChatGroup>) => void;
  clearGroupChatHistory: (groupId: string) => void;
  deleteGroupChat: (groupId: string) => void;
  openGift: (channelId: string, messageId: string) => void;
  updateChatMessage: (channelId: string, messageId: string, updates: Partial<Message>) => void;
  createBook: (book: Book) => void;
  updateBook: (id: string, updates: Partial<Book>) => void;
  deleteBook: (id: string) => void;
  createJubenshaSession: (session: JubenshaSession) => void;
  updateJubenshaSession: (id: string, updates: Partial<JubenshaSession>) => void;
  deleteJubenshaSession: (id: string) => void;
  createIFSession: (session: IFSession) => void;
  updateIFSession: (id: string, updates: Partial<IFSession>) => void;
  deleteIFSession: (id: string) => void;
  updateCalendarRecord: (date: string, record: Partial<import('./types').CalendarDayRecord>) => void;
  saveForumDmThread: (thread: ForumDirectThread) => void;
  deleteForumDmThread: (handle: string) => void;
  addFocusRecord: (record: import('./types').FocusRecord) => void;
  deleteFocusRecord: (id: string) => void;
  addBillingRecord: (record: import('./types').BillingRecord) => void;
  updateBillingRecord: (id: string, updates: Partial<import('./types').BillingRecord>) => void;
  deleteBillingRecord: (id: string) => void;
  updateBillingManager: (characterId: string | null) => void;
  addBillingCategory: (category: import('./types').BillingCategory) => void;
  updateBillingCategory: (id: string, category: Partial<import('./types').BillingCategory>) => void;
  deleteBillingCategory: (id: string) => void;
  addWidget: (widget: import('./types').DesktopWidget) => void;
  updateWidget: (id: string, updates: Partial<import('./types').DesktopWidget>) => void;
  removeWidget: (id: string) => void;
  saveNewsIssue: (issue: NewsIssue) => void;
  addActivityLog: (log: ActivityLog) => void;
  reorderWidgets: (activeId: string, overId: string, targetPage?: number) => void;
  saveWritingArticle: (article: import('./types').WritingArticle) => void;
  deleteWritingArticle: (id: string) => void;
  saveDiaryEntry: (entry: import('./types').DiaryEntry) => void;
  deleteDiaryEntry: (id: string) => void;
  createCoupleDiary: (partnerId: string) => void;
  updateCoupleDiary: (diaryId: string, updates: Partial<import('./types').CoupleDiary>) => void;
  deleteCoupleDiaryEntry: (diaryId: string, entryId: string) => void;
  addCoupleDiaryEntry: (diaryId: string, entry: import('./types').CoupleDiaryEntry) => void;
  addSpecialEvent: (diaryId: string, event: import('./types').SpecialEvent) => void;
  updateSpecialEvent: (diaryId: string, eventId: string, updates: Partial<import('./types').SpecialEvent>) => void;
  deleteSpecialEvent: (diaryId: string, eventId: string) => void;
  saveMailboxLetter: (letter: import('./types').MailLetter) => void;
  deleteMailboxLetter: (id: string) => void;
  markMailboxLetterRead: (id: string) => void;
  saveForumPost: (post: import('./types').ForumPost) => void;
  deleteForumPost: (id: string) => void;
  addTarotRecord: (record: import('./types').TarotRecord) => void;
  deleteTarotRecord: (id: string) => void;
  setNotification: (notification: AppNotification | null) => void;
  setMovieSessions: (sessions: import('./types').MovieSession[]) => void;
  setWatchCompanionPlans: (plans: import('./types').WatchCompanionPlan[]) => void;
  updateMovieSession: (id: string, updates: Partial<import('./types').MovieSession>) => void;
  deleteMovieSession: (id: string) => void;
}

const getCharacterExperience = (id: string) => {
  switch(id) {
    case 'bruce': return '哥谭市的暗夜骑士，韦恩集团的掌舵人，经历了父母双亡的惨剧后，化身蝙蝠侠打击犯罪。';
    case 'alfred': return '韦恩家族的忠诚管家，前英国特工，照顾了布鲁斯一生，是蝙蝠家族最坚实的后盾。';
    case 'dick': return '第一代罗宾，现为夜翼，曾在马戏团长大，后被布鲁斯收养，性格阳光，是家族的粘合剂。';
    case 'jason': return '第二代罗宾，曾在犯罪巷偷蝙蝠车轮胎被布鲁斯收养，后被小丑杀害，复活后成为红头罩，行事极端。';
    case 'tim': return '第三代罗宾，现为红罗宾，凭借自己的智慧发现了蝙蝠侠的真实身份，是个工作狂和侦探天才。';
    case 'damian': return '第五代罗宾，布鲁斯和塔利亚的亲生儿子，从小在刺客联盟接受训练，性格高傲但渴望父亲的认可。';
    case 'barbara': return '戈登局长的女儿，曾是蝙蝠女孩，被小丑致残后成为“神谕”，为家族提供顶级的情报和技术支持。';
    case 'kate': return '布鲁斯的表姐，蝙蝠女侠，曾因性取向被军校开除，后在哥谭独立打击犯罪，行事果敢。';
    case 'stephanie': return '曾是搅局者、罗宾和蝙蝠女孩，父亲是反派“线索大师”，性格乐观，永不言弃。';
    case 'cassandra': return '刺客大卫·该隐和西瓦女士的女儿，从小被培养成完美杀手，不善言辞但能读懂肢体语言，现为孤儿/黑蝙蝠。';
    default: return 'DC宇宙角色';
  }
};

const getCharacterViewOnMe = (id: string) => {
  switch(id) {
    case 'bruce': return '觉得你是个需要保护的普通人，但也欣赏你的某些特质，虽然表面上保持距离，但暗中关注着你的安全。';
    case 'alfred': return '对你非常和蔼可亲，把你当成韦恩庄园的贵客，总是为你准备好红茶和小甜饼。';
    case 'dick': return '把你当成好朋友，喜欢和你开玩笑，觉得和你在一起很轻松，没有超级英雄的压力。';
    case 'jason': return '表面上对你有些不耐烦，但其实内心把你当成少数可以信任的人，会在你遇到危险时毫不犹豫地出手。';
    case 'tim': return '觉得你是个有趣的聊天对象，虽然经常因为忙于案件而忽略你，但心里很重视你的意见。';
    case 'damian': return '经常嘲笑你是个“愚蠢的平民”，但如果你遇到麻烦，他会第一个冲出来，虽然嘴上绝对不会承认关心你。';
    case 'barbara': return '把你当成知心朋友，经常和你分享生活中的琐事，也会在网络上默默保护你的隐私安全。';
    case 'kate': return '觉得你是个独立有趣的人，偶尔会约你出去喝一杯，把你当成可以倾诉的平民朋友。';
    case 'stephanie': return '把你当成最好的闺蜜/兄弟，经常拉着你一起去吃好吃的，分享她的快乐和烦恼。';
    case 'cassandra': return '虽然不怎么说话，但喜欢静静地待在你身边，通过你的肢体语言知道你是个善良的人，对你非常信任。';
    default: return '未知';
  }
};

export const defaultWorldCharacters: CharacterCard[] = Object.values(initialCharacters).map(char => ({
  id: char.id,
  name: char.name,
  avatar: char.avatar,
  personality: char.personality,
  experience: getCharacterExperience(char.id),
  relationship: char.relationship,
  viewOnMe: getCharacterViewOnMe(char.id),
  memoryRounds: 8,
  memorySummary: '',
  weeklyActivitySummary: '',
  memoryDigestMessageCount: 0,
  weeklyDigestMessageCount: 0
}));

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set) => ({
      isLocked: true,
      currentApp: null,
      settings: initialSettings,
      characters: initialCharacters,
      chats: {},
      moments: [],
      songs: [],
      worldSettings: [{ id: 'default', title: '基础世界观', content: 'DC宇宙，哥谭市。', characters: defaultWorldCharacters }],
      activeWorldSettingId: 'default',
      bottles: [],
      friendRequests: [],
      stickers: [],
      copetData: null,
      wechatBalance: 8888,
      wechatGifts: [],
      wechatGroups: {},
      books: {},
      jubenshaSessions: {},
      ifSessions: {},
      forumDmThreads: {},
      calendarRecords: {},
      focusRecords: [],
      billingCategories: [
        { id: 'c1', name: '餐饮', icon: '🍽️', color: '#fca5a5' },
        { id: 'c2', name: '交通', icon: '🚌', color: '#93c5fd' },
        { id: 'c3', name: '购物', icon: '🛍️', color: '#fcd34d' },
        { id: 'c4', name: '娱乐', icon: '🎮', color: '#c4b5fd' },
        { id: 'c5', name: '生活', icon: '🏠', color: '#86efac' },
      ],
      billingRecords: [],
      billingManagerId: null,
      widgets: [],
      newsIssues: [],
      activityLogs: [],
      writingArticles: [],
      diaryEntries: [],
      coupleDiaries: [],
      mailboxLetters: [],
      forumPosts: [],
      tarotRecords: [],
      movieSessions: [],
      watchCompanionPlans: [],
      notification: null,
      notificationQueue: [],
      clearNotification: () => set((state) => {
        const nextQueue = [...(state.notificationQueue || [])];
        const nextNotification = nextQueue.shift() || null;
        return { notification: nextNotification, notificationQueue: nextQueue };
      }),
      setNotification: (notification) => set((state) => ({
        ...(shouldDisplayNotification(state as AppState & AppActions, notification)
          ? state.notification
            ? { notification: state.notification, notificationQueue: [...(state.notificationQueue || []), notification as AppNotification] }
            : { notification, notificationQueue: state.notificationQueue || [] }
          : { notification: state.notification, notificationQueue: state.notificationQueue || [] })
      })),

      unlock: () => set({ isLocked: false }),
      lock: () => set({ isLocked: true, currentApp: null }),
      openApp: (app) => set({ currentApp: app }),
      closeApp: () => set({ currentApp: null }),
      
      updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),

      saveForumDmThread: (thread) => set((state) => ({
        forumDmThreads: { ...state.forumDmThreads, [thread.handle]: thread }
      })),

      deleteForumDmThread: (handle) => set((state) => {
        const nextThreads = { ...state.forumDmThreads };
        delete nextThreads[handle];
        return { forumDmThreads: nextThreads };
      }),
      
      updateCharacter: (id, data) => set((state) => ({
        characters: { ...state.characters, [id]: { ...state.characters[id], ...data } }
      })),

      removeCharacter: (id) => set((state) => {
        const newChars = { ...state.characters };
        delete newChars[id];
        return { characters: newChars };
      }),

      deleteChat: (characterId) => {
        set((state) => {
          const newChats = { ...state.chats };
          delete newChats[characterId];
          return {
            chats: newChats,
            worldSettings: state.worldSettings.map(setting => ({
              ...setting,
              characters: setting.characters.map(char => char.id === characterId ? {
                ...char,
                memorySummary: '',
                weeklyActivitySummary: '',
                memoryUpdatedAt: undefined,
                memoryDigestMessageCount: 0,
                weeklyDigestMessageCount: 0
              } : char)
            }))
          };
        });
        void import('./lib/ai').then(mod => mod.refreshCharacterMemoryDigest(characterId, { force: true })).catch(() => {});
      },

      clearWeChatHistory: (characterId) => {
        set((state) => ({
          chats: { ...state.chats, [characterId]: [] },
          worldSettings: state.worldSettings.map(setting => ({
            ...setting,
            characters: setting.characters.map(char => char.id === characterId ? {
              ...char,
              memorySummary: '',
              weeklyActivitySummary: '',
              memoryUpdatedAt: undefined,
              memoryDigestMessageCount: 0,
              weeklyDigestMessageCount: 0
            } : char)
          }))
        }));
        void import('./lib/ai').then(mod => mod.refreshCharacterMemoryDigest(characterId, { force: true })).catch(() => {});
      },

      sendAdvancedMessage: (channelId, msg) => set((state) => {
        const chat = state.chats[channelId] || [];
        const senderId = msg.senderId || 'user';
        if (senderId !== 'user' && !isStoreCharacterEnabled(state as AppState & AppActions, senderId)) {
          return {};
        }
        const chunks = senderId === 'user' ? [msg.text || ''] : splitMessageText(msg.text || '');
        const messages = (chunks.length > 0 ? chunks : ['']).map((chunk, index) => ({
          id: `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
          senderId,
          timestamp: Date.now() + index,
          ...msg,
          text: chunk,
          ...getMessageMetaFromText(senderId, chunk),
        })) as Message[];
        const notifications =
          senderId !== 'user' && state.characters[channelId]
            ? messages.map((message, index) => ({
                id: Date.now() + index,
                characterId: channelId,
                text: message.text?.slice(0, 50) + ((message.text?.length || 0) > 50 ? '...' : ''),
                sourceApp: 'wechat' as const,
                openApp: 'wechat' as const
              }))
            : [];
        const visibleNotifications = notifications.filter(item => shouldDisplayNotification(state as AppState & AppActions, item));
        const nextNotification = !state.notification && visibleNotifications.length > 0 ? visibleNotifications[0] : state.notification;
        const queuedNotifications =
          state.notification
            ? visibleNotifications
            : visibleNotifications.slice(1);
        return {
          chats: { ...state.chats, [channelId]: [...chat, ...messages] },
          notification: nextNotification,
          notificationQueue: [...(state.notificationQueue || []), ...queuedNotifications]
        };
      }),

      openGift: (channelId, messageId) => set((state) => {
        const chat = state.chats[channelId] || [];
        const newChat = chat.map(m => m.id === messageId ? { ...m, giftStatus: 'opened' as const } : m);
        return { chats: { ...state.chats, [channelId]: newChat } };
      }),

      updateChatMessage: (channelId, messageId, updates) => set((state) => {
        const chat = state.chats[channelId] || [];
        const newChat = chat.map(message => message.id === messageId ? { ...message, ...updates } : message);
        return { chats: { ...state.chats, [channelId]: newChat } };
      }),

      updateWeChatBalance: (amount) => set({ wechatBalance: amount }),
      addWeChatGift: (gift) => set((state) => ({ wechatGifts: [{...gift, timestamp: Date.now()}, ...(state.wechatGifts || [])] })),

      createWeChatGroup: (group) => set((state) => ({
        wechatGroups: { ...state.wechatGroups, [group.id]: group }
      })),

      updateWeChatGroup: (id, updates) => set((state) => ({
        wechatGroups: { ...state.wechatGroups, [id]: { ...state.wechatGroups[id], ...updates } }
      })),

      clearGroupChatHistory: (groupId: string) => set((state) => {
        const group = state.wechatGroups[groupId];
        if (!group) return state;
        
        const newGroups = { ...state.wechatGroups, [groupId]: { ...group, messages: [] } };
        
        for (const memberId of group.members) {
          if (memberId === 'user') continue;
          const cardIndex = state.worldSettings.findIndex(ws => 
            ws.characters.some(c => c.id === memberId)
          );
          if (cardIndex >= 0) {
            const charIndex = state.worldSettings[cardIndex].characters.findIndex(c => c.id === memberId);
            if (charIndex >= 0) {
              state.worldSettings[cardIndex].characters[charIndex].memorySummary = '';
              state.worldSettings[cardIndex].characters[charIndex].memoryUpdatedAt = undefined;
              state.worldSettings[cardIndex].characters[charIndex].memoryDigestMessageCount = 0;
            }
          }
        }
        
        return { ...state, wechatGroups: newGroups };
      }),

      deleteGroupChat: (groupId: string) => set((state) => {
        const newGroups = { ...state.wechatGroups };
        delete newGroups[groupId];
        return { ...state, wechatGroups: newGroups };
      }),

      createBook: (book) => set((state) => ({
        books: { ...state.books, [book.id]: book }
      })),
      
      updateBook: (id, updates) => set((state) => ({
        books: { ...state.books, [id]: { ...state.books?.[id], ...updates } as Book }
      })),
      
      deleteBook: (id) => set((state) => {
        const newBooks = { ...state.books };
        delete newBooks[id];
        return { books: newBooks };
      }),
      
      createJubenshaSession: (session) => set((state) => ({
        jubenshaSessions: { ...state.jubenshaSessions, [session.id]: session }
      })),
      
      updateJubenshaSession: (id, updates) => set((state) => ({
        jubenshaSessions: { ...state.jubenshaSessions, [id]: { ...state.jubenshaSessions?.[id], ...updates } as JubenshaSession }
      })),
      
      deleteJubenshaSession: (id) => set((state) => {
        const newSessions = { ...state.jubenshaSessions };
        delete newSessions[id];
        return { jubenshaSessions: newSessions };
      }),

      createIFSession: (session) => set((state) => ({
        ifSessions: { ...state.ifSessions, [session.id]: session }
      })),

      updateIFSession: (id, updates) => set((state) => ({
        ifSessions: { ...state.ifSessions, [id]: { ...state.ifSessions?.[id], ...updates } as IFSession }
      })),

      deleteIFSession: (id) => set((state) => {
        const newSessions = { ...state.ifSessions };
        delete newSessions[id];
        return { ifSessions: newSessions };
      }),
      
      updateCalendarRecord: (date, record) => set((state) => {
        const existing = state.calendarRecords[date] || { date, events: [], menstrual: false, dysmenorrhea: false, menstrualVisibleTo: [], feeling: '', feelingLevel: 5 };
        return {
          calendarRecords: {
            ...state.calendarRecords,
            [date]: { ...existing, ...record }
          }
        };
      }),

      addFocusRecord: (record) => set((state) => ({
        focusRecords: [record, ...(state.focusRecords || [])]
      })),

      deleteFocusRecord: (id) => set((state) => ({
        focusRecords: (state.focusRecords || []).filter(r => r.id !== id)
      })),

      addBillingRecord: (record) => set((state) => ({
        billingRecords: [record, ...(state.billingRecords || [])]
      })),

      updateBillingRecord: (id, updates) => set((state) => ({
        billingRecords: (state.billingRecords || []).map(r => r.id === id ? { ...r, ...updates } : r)
      })),

      deleteBillingRecord: (id) => set((state) => ({
        billingRecords: (state.billingRecords || []).filter(r => r.id !== id)
      })),

      updateBillingManager: (characterId) => set({ billingManagerId: characterId }),

      addBillingCategory: (category) => set((state) => ({
        billingCategories: [...(state.billingCategories || []), category]
      })),

      updateBillingCategory: (id, category) => set((state) => ({
        billingCategories: (state.billingCategories || []).map(c => c.id === id ? { ...c, ...category } : c)
      })),

      deleteBillingCategory: (id) => set((state) => ({
        billingCategories: (state.billingCategories || []).filter(c => c.id !== id)
      })),

      addWidget: (widget) => set((state) => ({
        widgets: [...(state.widgets || []), widget]
      })),

      updateWidget: (id, updates) => set((state) => ({
        widgets: (state.widgets || []).map(w => w.id === id ? { ...w, ...updates } : w)
      })),

      removeWidget: (id) => set((state) => ({
        widgets: (state.widgets || []).filter(w => w.id !== id)
      })),

      saveNewsIssue: (issue) => set((state) => {
        const others = (state.newsIssues || []).filter(existing => existing.id !== issue.id && existing.date !== issue.date);
        return { newsIssues: [issue, ...others].sort((a, b) => b.createdAt - a.createdAt) };
      }),

      addActivityLog: (log) => {
        set((state) => ({
          activityLogs: [log, ...(state.activityLogs || [])].slice(0, 80)
        }));
        (log.relatedCharacterIds || []).forEach(characterId => {
          void import('./lib/ai').then(mod => mod.refreshCharacterMemoryDigest(characterId, { force: true })).catch(() => {});
        });
      },

      reorderWidgets: (activeId, overId, targetPage) => set((state) => {
        const widgets = [...(state.widgets || [])];
        const oldIndex = widgets.findIndex(widget => widget.id === activeId);
        const newIndex = widgets.findIndex(widget => widget.id === overId);
        if (oldIndex === -1 || newIndex === -1) return {};
        const moved = [...widgets];
        const [activeWidget] = moved.splice(oldIndex, 1);
        moved.splice(newIndex, 0, { ...activeWidget, page: targetPage ?? activeWidget.page });
        return { widgets: moved };
      }),

      saveWritingArticle: (article) => set((state) => {
        const others = (state.writingArticles || []).filter(item => item.id !== article.id);
        return { writingArticles: [article, ...others].sort((a, b) => b.updatedAt - a.updatedAt) };
      }),

      deleteWritingArticle: (id) => set((state) => ({
        writingArticles: (state.writingArticles || []).filter(article => article.id !== id)
      })),

      saveDiaryEntry: (entry) => set((state) => {
        const others = (state.diaryEntries || []).filter(item => item.id !== entry.id);
        return { diaryEntries: [entry, ...others].sort((a, b) => b.updatedAt - a.updatedAt) };
      }),

      deleteDiaryEntry: (id) => set((state) => ({
        diaryEntries: (state.diaryEntries || []).filter(entry => entry.id !== id)
      })),

      createCoupleDiary: (partnerId) => set((state) => {
        const newDiary: CoupleDiary = {
          id: Date.now().toString(),
          partnerId,
          entries: [],
          createdAt: Date.now(),
          partnerWritingFrequency: 'medium',
          startDate: Date.now(),
          specialEvents: [
            { id: 'default1', name: '纪念日', date: Date.now(), color: '#ec4899' },
            { id: 'default2', name: '生日', date: Date.now(), color: '#f59e0b' },
            { id: 'default3', name: '约会日', date: Date.now(), color: '#10b981' },
          ],
          reminders: [
            { id: '1', type: 'anniversary', name: '纪念日', days: [52, 100, 200, 365, 500, 1000], notifyBefore: 3, enabled: true },
            { id: '2', type: 'holiday', name: '情人节', days: [0], notifyBefore: 7, enabled: true },
            { id: '3', type: 'holiday', name: '七夕', days: [0], notifyBefore: 7, enabled: true },
          ]
        };
        return { coupleDiaries: [...(state.coupleDiaries || []), newDiary] };
      }),

      updateCoupleDiary: (diaryId, updates) => set((state) => ({
        coupleDiaries: (state.coupleDiaries || []).map(diary => 
          diary.id === diaryId ? { ...diary, ...updates } : diary
        )
      })),

      deleteCoupleDiaryEntry: (diaryId, entryId) => set((state) => ({
        coupleDiaries: (state.coupleDiaries || []).map(diary => 
          diary.id === diaryId 
            ? { ...diary, entries: diary.entries.filter(e => e.id !== entryId) }
            : diary
        )
      })),

      addSpecialEvent: (diaryId, event) => set((state) => ({
        coupleDiaries: (state.coupleDiaries || []).map(diary => 
          diary.id === diaryId 
            ? { ...diary, specialEvents: [...(diary.specialEvents || []), event] }
            : diary
        )
      })),

      updateSpecialEvent: (diaryId, eventId, updates) => set((state) => ({
        coupleDiaries: (state.coupleDiaries || []).map(diary => 
          diary.id === diaryId 
            ? { ...diary, specialEvents: diary.specialEvents.map(e => e.id === eventId ? { ...e, ...updates } : e) }
            : diary
        )
      })),

      deleteSpecialEvent: (diaryId, eventId) => set((state) => ({
        coupleDiaries: (state.coupleDiaries || []).map(diary => 
          diary.id === diaryId 
            ? { ...diary, specialEvents: diary.specialEvents.filter(e => e.id !== eventId) }
            : diary
        )
      })),

      addCoupleDiaryEntry: (diaryId, entry) => set((state) => ({
        coupleDiaries: (state.coupleDiaries || []).map(diary => 
          diary.id === diaryId 
            ? { ...diary, entries: [entry, ...diary.entries] }
            : diary
        )
      })),

      saveMailboxLetter: (letter) => set((state) => {
        const others = (state.mailboxLetters || []).filter(item => item.id !== letter.id);
        return { mailboxLetters: [letter, ...others].sort((a, b) => b.createdAt - a.createdAt) };
      }),

      deleteMailboxLetter: (id) => set((state) => ({
        mailboxLetters: (state.mailboxLetters || []).filter(letter => letter.id !== id)
      })),

      markMailboxLetterRead: (id) => set((state) => ({
        mailboxLetters: (state.mailboxLetters || []).map(letter => letter.id === id ? { ...letter, isRead: true } : letter)
      })),

      saveForumPost: (post) => set((state) => {
        // 去重：30分钟内同一作者+同一标题视为重复
        const isDup = (state.forumPosts || []).some(
          existing => existing.authorHandle === post.authorHandle
            && existing.title === post.title
            && Math.abs(existing.createdAt - post.createdAt) < 30 * 60 * 1000
        );
        if (isDup) return state;
        const others = (state.forumPosts || []).filter(item => item.id !== post.id);
        return { forumPosts: [post, ...others].sort((a, b) => b.updatedAt - a.updatedAt) };
      }),

      deleteForumPost: (id) => set((state) => ({
        forumPosts: (state.forumPosts || []).filter(post => post.id !== id)
      })),

      addTarotRecord: (record) => set((state) => ({
        tarotRecords: [record, ...(state.tarotRecords || [])]
      })),

      deleteTarotRecord: (id) => set((state) => ({
        tarotRecords: (state.tarotRecords || []).filter(r => r.id !== id)
      })),

      setMovieSessions: (sessions) => set({ movieSessions: sessions }),
      setWatchCompanionPlans: (plans) => set({ watchCompanionPlans: plans }),
      updateMovieSession: (id, updates) => set((state) => ({
        movieSessions: state.movieSessions.map(s => s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s)
      })),
      deleteMovieSession: (id) => set((state) => ({
        movieSessions: state.movieSessions.filter(s => s.id !== id)
      })),

      sendMessage: (characterId, text, imageUrl, stickerUrl, timestamp?: number) => set((state) => {
        const newMsg: Message = {
          id: Date.now().toString(),
          senderId: 'user',
          text,
          imageUrl,
          stickerUrl,
          timestamp: timestamp || Date.now(),
          ...getMessageMetaFromText('user', text)
        };
        const chat = state.chats[characterId] || [];
        return { chats: { ...state.chats, [characterId]: [...chat, newMsg] } };
      }),

      receiveMessage: (characterId, text, minTimestamp?: number) => set((state) => {
        if (!isStoreCharacterEnabled(state as AppState & AppActions, characterId)) {
          return {};
        }
        const chat = state.chats[characterId] || [];
        const parts = splitMessageText(text);
        const baseTs = minTimestamp ? minTimestamp + 1 : Date.now();
        const messages = (parts.length > 0 ? parts : [text]).map((part, index) => ({
          id: `${Date.now()}_${index}`,
          senderId: characterId,
          text: part,
          timestamp: baseTs + index,
          ...getMessageMetaFromText(characterId, part)
        })) as Message[];
        const notifications: AppNotification[] = messages.map((message, index) => ({
          id: Date.now() + index,
          characterId,
          text: message.text?.substring(0, 50) + ((message.text?.length || 0) > 50 ? '...' : ''),
          sourceApp: 'wechat',
          openApp: 'wechat'
        }));
        const visibleNotifications = notifications.filter(item => shouldDisplayNotification(state as AppState & AppActions, item));
        return { 
          chats: { ...state.chats, [characterId]: [...chat, ...messages] },
          notification: !state.notification && visibleNotifications.length > 0 ? visibleNotifications[0] : state.notification,
          notificationQueue: [...(state.notificationQueue || []), ...(state.notification ? visibleNotifications : visibleNotifications.slice(1))]
        };
      }),

      addMoment: (moment) => set((state) => ({
        moments: [{ ...moment, id: Date.now().toString(), timestamp: Date.now(), likes: [], comments: [] }, ...state.moments]
      })),

      addMomentComment: (momentId, authorId, text) => set((state) => ({
        moments: state.moments.map(m => m.id === momentId ? { ...m, comments: [...m.comments, { authorId, text }] } : m)
      })),

      deleteMomentComment: (momentId, index) => set((state) => ({
        moments: state.moments.map(m => m.id === momentId ? { ...m, comments: m.comments.filter((_, i) => i !== index) } : m)
      })),

      deleteMoment: (momentId) => set((state) => ({
        moments: state.moments.filter(m => m.id !== momentId)
      })),

      toggleMomentLike: (momentId, characterId) => set((state) => ({
        moments: state.moments.map(m => {
          if (m.id === momentId) {
            const likes = m.likes.includes(characterId) ? m.likes.filter(id => id !== characterId) : [...m.likes, characterId];
            return { ...m, likes };
          }
          return m;
        })
      })),

      addSong: (song) => set((state) => ({
        songs: [...state.songs, { ...song, id: Date.now().toString() }]
      })),

      updateSong: (songId, updates) => set((state) => ({
        songs: state.songs.map(song => song.id === songId ? { ...song, ...updates } : song)
      })),

      deleteSong: (songId) => set((state) => ({
        songs: state.songs.filter(song => song.id !== songId)
      })),

      toggleSongFavorite: (songId) => set((state) => ({
        songs: state.songs.map(s => s.id === songId ? { ...s, isFavorite: !s.isFavorite } : s)
      })),

      addWorldSetting: (setting) => set((state) => ({
        worldSettings: [...state.worldSettings, { ...setting, id: Date.now().toString() }]
      })),

      updateWorldSetting: (id, setting) => set((state) => ({
        worldSettings: state.worldSettings.map(ws => ws.id === id ? { ...ws, ...setting } : ws)
      })),

      deleteWorldSetting: (id) => set((state) => ({
        worldSettings: state.worldSettings.filter(ws => ws.id !== id),
        activeWorldSettingId: state.activeWorldSettingId === id ? null : state.activeWorldSettingId
      })),

      setActiveWorldSetting: (id) => set((state) => ({
        activeWorldSettingId: id
      })),

      throwBottle: (text, imageUrl, musicUrl) => set((state) => ({
        bottles: [{ id: Date.now().toString(), text, imageUrl, musicUrl, timestamp: Date.now() }, ...state.bottles]
      })),

      deleteBottle: (bottleId) => set((state) => ({
        bottles: state.bottles.filter(b => b.id !== bottleId)
      })),

      receiveBottleReply: (bottleId, reply) => set((state) => ({
        bottles: state.bottles.map(b => b.id === bottleId ? { ...b, reply } : b)
      })),

      addFriendRequest: (characterCard) => set((state) => {
        const newChar: Character = {
          id: characterCard.id,
          name: characterCard.name,
          avatar: characterCard.avatar || '#94a3b8',
          background: '#f3f4f6',
          bubbleColor: '#ffffff',
          relationship: characterCard.relationship || '陌生人',
          interactionMode: '普通',
          personality: characterCard.personality || '',
          userNickname: '你',
          affection: 50,
          remark: characterCard.name,
          isStarred: false,
          isWeChatFriend: false
        };
        return {
          friendRequests: [{ id: Date.now().toString(), characterCard, status: 'pending' }, ...state.friendRequests],
          characters: { ...state.characters, [newChar.id]: newChar }
        };
      }),

      acceptFriendRequest: (requestId) => set((state) => {
        const req = state.friendRequests.find(r => r.id === requestId);
        if (!req || req.status === 'accepted') return state;
        
        const newCharacter = {
           id: req.characterCard.id,
           name: req.characterCard.name,
           avatar: req.characterCard.avatar || '#333',
           background: '#ffffff',
           bubbleColor: '#ffffff',
           relationship: req.characterCard.relationship || '朋友',
           interactionMode: req.characterCard.interactionMode || '友好',
           personality: req.characterCard.personality || '',
           userNickname: req.characterCard.userNickname || '你',
           affection: req.characterCard.affection || 50,
           remark: req.characterCard.name,
           isStarred: false,
           isWeChatFriend: true,
           ...state.characters[req.characterCard.id]
        };

        return {
          friendRequests: state.friendRequests.map(r => r.id === requestId ? { ...r, status: 'accepted' } : r),
          characters: {
             ...state.characters,
             [req.characterCard.id]: newCharacter
          }
        };
      }),

      addSticker: (url) => set((state) => ({
        stickers: [...state.stickers, url]
      })),

      updateCoPet: (data) => set({ copetData: data }),
    }),
    {
      name: 'dc-phone-storage',
    }
  )
);
