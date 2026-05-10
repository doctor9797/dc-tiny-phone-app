export interface JubenshaRoleCard {
  playerId: string;
  roleName: string;
  publicIdentity: string;
  personality: string;
  backstory: string;
  secret: string;
  objective: string;
}

export interface JubenshaClue {
  id: string;
  title: string;
  detail: string;
  holderId?: string;
  location?: string;
}

export interface JubenshaEnding {
  id: string;
  title: string;
  summary: string;
  condition: string;
}

export interface JubenshaCaseData {
  caseTitle: string;
  background: string;
  opening: string;
  incident: string;
  truth: string;
  culpritId: string;
  userRoleId: string;
  roles: JubenshaRoleCard[];
  clues: JubenshaClue[];
  endings: JubenshaEnding[];
}

export interface JubenshaSession {
  id: string;
  name: string;
  background: string;
  theme: string;
  characterIds: string[];
  script: string;
  messages: { role: 'system' | 'user' | 'character'; name?: string; text: string }[];
  updatedAt: number;
  caseData?: JubenshaCaseData;
  discoveredClues?: string[];
  accusedCharacterId?: string | null;
  conclusion?: string;
  isFinished?: boolean;
  unlockedEndingIds?: string[];
  phase?: 'intro' | 'investigation1' | 'discussion' | 'investigation2' | 'final_vote';
}

export interface IFRoleIdentity {
  playerId: string;
  name: string;
  identity: string;
  publicStatus: string;
  personality: string;
  goal: string;
  hiddenInfo?: string;
}

export interface IFSessionMessage {
  role: 'system' | 'user' | 'character' | 'narrator';
  name?: string;
  text: string;
}

export interface IFSession {
  id: string;
  name: string;
  background: string;
  theme: string;
  characterIds: string[];
  opening: string;
  worldSummary: string;
  userIdentity: IFRoleIdentity;
  characterIdentities: IFRoleIdentity[];
  messages: IFSessionMessage[];
  updatedAt: number;
}

export type AppName = 'wechat' | 'music' | 'settings' | 'tarot' | 'bottle' | 'worldbook' | 'liarsbar' | 'jubensha' | 'ifapp' | 'vocab' | 'copet' | 'focus' | 'reader' | 'calendar' | 'billing' | 'beautify' | 'news' | 'desktoppet' | 'writing' | 'diary' | 'mailbox' | 'forum' | 'couplediary' | 'movie' | null;

export interface CalendarPlan {
  id: string;
  type: 'plan';
  title: string;
  time: string; // HH:mm
  isPublished: boolean;
  visibleTo: string[];
  reminded?: boolean;
}

export interface CalendarTask {
  id: string;
  type: 'task';
  title: string;
  priority: 'ui' | 'in' | 'un' | 'nn'; // Urgent&Important, Important&NotUrgent, Urgent&NotImportant, NotImportant&NotUrgent
}

export type CalendarEvent = CalendarPlan | CalendarTask;

export interface CalendarDayRecord {
  date: string;
  events: CalendarEvent[];
  menstrual: boolean;
  dysmenorrhea: boolean;
  menstrualVisibleTo: string[];
  feeling: string;
  feelingLevel: number;
  menstrualRemindedMonth?: string;
}

export interface Character {
  id: string;
  name: string;
  avatar: string; // color hex or image url
  background: string; // color hex or image url
  bubbleColor: string;
  relationship: string;
  interactionMode: string;
  personality: string;
  userNickname: string;
  affection: number;
  remark: string;
  isStarred: boolean;
  isWeChatFriend?: boolean;
  isDisabled?: boolean;
  voiceReplyEnabled?: boolean;
  voiceSampleName?: string;
  voiceSampleRegisteredAt?: number;
  voiceReferencePromptText?: string;
  // 主动消息相关
  lastUserMessageAt?: number; // 最后一次用户消息的时间
  followUpSent?: boolean; // 是否已发送过跟进消息
  // 朋友圈相关
  momentsEnabled?: boolean; // 是否开启朋友圈
  momentsFrequency?: number; // 每天发朋友圈次数 (1-5)
  momentsBackground?: string; // 朋友圈背景图
  lastMomentAt?: number; // 上次发朋友圈的时间
}

export interface Message {
  id: string;
  senderId: 'user' | string; // 'user' or character id
  text: string;
  imageUrl?: string;
  stickerUrl?: string;
  type?: 'text' | 'image' | 'transfer' | 'gift' | 'system' | 'audio';
  amount?: number;
  transferStatus?: 'pending' | 'received' | 'returned';
  giftName?: string;
  giftStatus?: 'unopened' | 'opened';
  audioUrl?: string;
  audioLabel?: string;
  audioDuration?: number;
  audioTranscription?: string;
  audioTranslation?: string;
  timestamp: number;
}

export interface Moment {
  id: string;
  authorId: string; // 'user' or character id
  content: string;
  imageUrl?: string;
  musicUrl?: string;
  location?: string;
  timestamp: number;
  likes: string[]; // character ids
  comments: { authorId: string; text: string }[];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  url: string;
  lyrics: string;
  isFavorite: boolean;
  dbKey?: string;
}

export interface VocabHistoryRecord {
  id: string;
  date: number;
  wordCount: number;
  wrongWords: { word: string, meaning: string }[];
  summary: string;
  difficulty?: 'cet4' | 'cet6' | 'ielts';
  durationSeconds?: number;
}

export interface VocabWrongWordRecord {
  word: string;
  meaning: string;
  difficulty: 'cet4' | 'cet6' | 'ielts';
  wrongCount: number;
  updatedAt: number;
}

export interface AppFolder {
  id: string;
  name: string;
  apps: AppName[];
  customIcon?: string;
}

export interface VoiceApiConfig {
  id: string;
  baseUrl: string;
  groupId: string;
  apiKey: string;
  voiceId: string;
  ttsModel: string;
  sttModel: string;
  characterId: string;
  characterName: string;
}

export interface UserSettings {
  apiBaseUrl: string;
  apiKey: string;
  apiModel: string;
  voiceApiConfigs: VoiceApiConfig[];
  bilingual: boolean;
  wallpaper: string;
  lockscreenWallpaper: string;
  bottleWallpaper?: string;
  vocabDifficulty?: 'cet4' | 'cet6' | 'ielts';
  vocabCompanionId?: string;
  vocabHistory?: VocabHistoryRecord[];
  vocabWrongBook?: VocabWrongWordRecord[];
  osTheme?: string;
  passcode: string; // empty if disabled
  wechatPaymentPasscode?: string;
  wechatTheme?: 'light' | 'dark';
  customCode?: string;
  persona: {
    name: string;
    age: string;
    profession: string;
    identity: string;
    appearance: string;
    experience: string;
  };
  wechatName: string;
  wechatId: string;
  signature: string;
  wechatAvatar: string;
  wechatMomentsBg?: string;
  appIcons: Record<string, string>;
  appOrder: (AppName | AppFolder)[];
  dockApps?: AppName[];
  showDock?: boolean;
  appNameOverrides?: Record<string, string>;
  timeOffsetMinutes?: number;
  activeWeChatCharId?: string | null;
  desktopPet?: {
    enabled: boolean;
    characterId: string | null;
    x: number;
    y: number;
    remindMode: boolean;
    lastDisturbMessageAt?: number;
    lastReminderEventId?: string | null;
  };
  mailbox?: {
    enabledSenderIds: string[];
    frequencyByCharacter?: Record<string, 'low' | 'medium' | 'high'>;
    lastReceivedAt?: Record<string, number>;
  };
  forum?: {
    userHandle?: string;
    blockedHandles?: string[];
    postRefreshMinutes?: number;
    replyRefreshMinutes?: number;
    lastPostRefreshAt?: number;
    lastReplyRefreshAt?: number;
  };
}

export interface WritingCharacterFeedback {
  id: string;
  characterId: string;
  mode: 'underline' | 'review';
  text: string;
  createdAt: number;
}

export interface WritingArticle {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  config: {
    characterIds: (string | 'user')[];
    relation: string;
    background: string;
    style: string;
    theme: string;
    wordCount: number;
  };
  revisionPrompt?: string;
  feedbacks?: WritingCharacterFeedback[];
}

export interface DiaryComment {
  id: string;
  characterId: string;
  text: string;
  createdAt: number;
}

export interface DiaryStyleConfig {
  template: 'storybook' | 'scrapbook' | 'letter' | 'forest' | 'magazine';
  fontFamily: string;
  fontSize: number;
  textColor: string;
  background: string;
  backgroundColor: string;
}

export interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  photoUrls?: string[];
  musicUrl?: string;
  musicTitle?: string;
  commentCharacterIds?: string[];
  comments?: DiaryComment[];
  style: DiaryStyleConfig;
}

export interface CoupleDiary {
  id: string;
  partnerId: string;
  entries: CoupleDiaryEntry[];
  createdAt: number;
  partnerWritingFrequency: 'low' | 'medium' | 'high' | 'off';
  startDate: number;
  specialEvents: SpecialEvent[];
  reminders: Reminder[];
}

export interface SpecialEvent {
  id: string;
  name: string;
  date: string;
  color: string;
  isAnniversary?: boolean;
  enabled?: boolean;
  content?: string;
  weather?: string;
  moods?: string[];
  photos?: string[];
}

export interface Reminder {
  id: string;
  type: 'anniversary' | 'holiday' | 'custom';
  name: string;
  days: number[];
  notifyBefore: number;
  enabled: boolean;
}

export interface CoupleDiaryEntry {
  id: string;
  authorId: string;
  title: string;
  content: string;
  photos: string[];
  createdAt: number;
  moods: string[];
  weather?: string;
  backgroundColor?: string;
  isSpecialEvent?: boolean;
  eventId?: string;
}

export interface MailLetter {
  id: string;
  direction: 'incoming' | 'outgoing';
  fromId: string;
  toId: string;
  subject: string;
  content: string;
  photoUrl?: string;
  createdAt: number;
  isRead: boolean;
}

export interface AppNotification {
  id: number;
  characterId?: string;
  title?: string;
  text: string;
  sourceApp?: 'wechat' | 'forum' | 'mailbox';
  avatar?: string;
  openApp?: AppName;
  forumPostId?: string;
}

export interface ForumComment {
  id: string;
  authorHandle: string;
  authorSourceId?: string;
  text: string;
  createdAt: number;
  replyToId?: string;
  replyToHandle?: string;
}

export interface ForumPost {
  id: string;
  boardId: string;
  authorHandle: string;
  authorSourceId?: string;
  title: string;
  content: string;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
  comments: ForumComment[];
  visitCount: number;
  subscribed?: boolean;
  nextReplyAt?: number;
}

export interface ForumDirectMessage {
  id: string;
  sender: 'user' | 'other';
  text: string;
  createdAt: number;
}

export interface ForumDirectThread {
  handle: string;
  sourceId?: string;
  messages: ForumDirectMessage[];
  updatedAt: number;
}

export interface CharacterCard {
  id: string;
  name: string;
  avatar: string;
  personality: string;
  experience: string;
  relationship: string;
  viewOnMe: string;
  forceRequirements?: string;
  affection?: number;
  userNickname?: string;
  interactionMode?: string;
  isEnabled?: boolean;
  memoryRounds?: number;
  memorySummary?: string;
  weeklyActivitySummary?: string;
  memoryUpdatedAt?: number;
  memoryDigestMessageCount?: number;
  weeklyDigestMessageCount?: number;
}

export interface WorldSetting {
  id: string;
  title: string;
  content: string;
  baseCode?: string;
  characters: CharacterCard[];
}

export interface FriendRequest {
  id: string;
  characterCard: CharacterCard;
  status: 'pending' | 'accepted';
}

export interface ChatGroup {
  id: string;
  name: string;
  members: string[]; // character ids and 'user'
  autonomous: boolean;
  memberAliases: Record<string, string>; // id -> alias in group
  messages: Message[];
}

export interface HighlightComment {
  id: string;
  bookId: string;
  startIndex: number;
  endIndex: number;
  text: string; // The highlighted text
  authorId: string; // 'user' or charId
  comment: string;
  color?: string; // Hex color for the highlight
  timestamp: number;
  replies?: Array<{ authorId: string; comment: string; timestamp: number }>;
}

export interface BookCharacterSetting {
  charId: string;
  commentFrequency: 'low' | 'medium' | 'high';
  enableChapterSummary: boolean;
  enableEndSummary: boolean;
  fontSize: number;
  bgColor: string;
  bgImage: string;
  readMode?: 'scroll' | 'page';
  hasReceivedEndLetter?: boolean;
  lastChapterCommented?: number;
}

export interface BookChapter {
  id: string;
  title: string;
  startIndex: number;
  endIndex: number;
}

export interface BookBookmark {
  id: string;
  label: string;
  note?: string;
  position: number;
  chapterTitle?: string;
  category?: string;
  color?: string;
  createdAt: number;
}

export interface ChapterReflection {
  chapterId: string;
  chapterTitle: string;
  characterId: string;
  text: string;
  createdAt: number;
  kind?: 'chapter' | 'final';
}

export interface Book {
  id: string;
  title: string;
  coverImage?: string;
  content: string;
  highlights: HighlightComment[];
  lastReadPosition: number;
  settings: BookCharacterSetting;
  chapters?: BookChapter[];
  bookmarks?: BookBookmark[];
  chapterReflections?: ChapterReflection[];
}

export interface RoomFurniture {
  id: string;
  name: string;
  emoji?: string;
  fId?: string;
  x: number;
  y: number;
}

export interface PetState {
  companionId: string;
  petType: 'dog' | 'cat' | 'bird' | 'rabbit' | 'hamster' | 'turtle';
  name: string;
  stage: 'egg' | 'baby' | 'child' | 'adult';
  stats: {
    affection: number;    // 亲密度
    intelligence: number; // 智力
    strength: number;     // 力量/体力
    satiety: number;      // 饱食度
    mood: number;         // 心情
    energy: number;       // 体力
  };
  inventory: string[];
  coins: number;
  furniture: RoomFurniture[];
  level: number;
  exp: number;
  history: { date: number, event: string }[];
}

export interface BillingCategory {
  id: string;
  name: string;
  icon: string; // Emoji
  color: string; // Hex color code
}

export interface BillingRecord {
  id: string;
  amount: number;
  categoryId: string;
  note: string;
  timestamp: number;
  managerComment?: string;
}

export interface FocusRecord {
  id: string;
  charId: string;
  mode: string;
  duration: number; // in seconds
  tasks: { text: string; completed: boolean }[];
  chatLog: { sender: 'user'|'char', text: string }[];
  charActions: string[];
  summary: string;
  timestamp: number;
}

export type WidgetType = 'music_player' | 'sticky_note' | 'photo_2x2' | 'photo_4x2' | 'listen_together' | 'profile_intro' | 'time_bar' | 'countdown' | 'quote_4x2' | 'calendar_widget';

export interface DesktopWidget {
  id: string;
  type: WidgetType;
  x?: number; // legacy or grid position if later customized
  y?: number;
  page?: number;
  slotIndex?: number;
  width?: number;
  height?: number;
  data: any; // widget-specific settings
}

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  category: string;
}

export interface NewsIssue {
  id: string;
  date: string;
  category: string;
  articles: NewsArticle[];
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  title: string;
  detail: string;
  timestamp: number;
  relatedCharacterIds?: string[];
}

export type CompanionMode = 'active' | 'natural' | 'silent';
export type CompanionDensity = 'quiet' | 'normal' | 'talkative';
export type DeliveryMode = 'auto' | 'hint' | 'manual';

export type CompanionTriggerType = 'emotion' | 'observe' | 'question' | 'memory';
export type CompanionTriggerPriority = 'high' | 'medium' | 'low';

export interface CompanionTrigger {
  id: string;
  time: number;
  type: CompanionTriggerType;
  priority: CompanionTriggerPriority;
  bubble: string;
  delivery: DeliveryMode;
  consumed?: boolean;
}

export interface WatchCompanionPlan {
  id: string;
  movieTitle: string;
  mode: CompanionMode;
  density: CompanionDensity;
  triggers: CompanionTrigger[];
  createdAt: number;
  updatedAt: number;
}

export interface MovieChatMessage {
  id: string;
  text: string;
  isCompanion: boolean;
  time: number;
}

export interface MovieSession {
  id: string;
  title: string;
  videoUrl: string;
  videoDbKey?: string;
  subtitleUrl?: string;
  subtitleContent?: string;
  currentTime: number;
  duration: number;
  companionPlanId?: string;
  companionMode: CompanionMode;
  companionDensity: CompanionDensity;
  isPlaying: boolean;
  characterId?: string;
  notes: { time: number; text: string; createdAt: number }[];
  chatMessages: MovieChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  isLocked: boolean;
  currentApp: AppName;
  settings: UserSettings;
  characters: Record<string, Character>;
  chats: Record<string, Message[]>;
  wechatGroups: Record<string, ChatGroup>;
  wechatBalance: number;
  wechatGifts: { id: string; name: string; senderId: string; timestamp: number }[];
  moments: Moment[];
  songs: Song[];
  worldSettings: WorldSetting[];
  bottles: { id: string; text: string; imageUrl?: string; musicUrl?: string; reply?: string; timestamp: number }[];
  friendRequests: FriendRequest[];
  stickers: string[];
  copetData?: PetState | null;
  books?: Record<string, Book>;
  jubenshaSessions: Record<string, JubenshaSession>;
  ifSessions: Record<string, IFSession>;
  forumDmThreads: Record<string, ForumDirectThread>;
  calendarRecords: Record<string, CalendarDayRecord>;
  focusRecords: FocusRecord[];
  billingCategories: BillingCategory[];
  billingRecords: BillingRecord[];
  billingManagerId: string | null;
  widgets: DesktopWidget[];
  newsIssues: NewsIssue[];
  activityLogs: ActivityLog[];
  writingArticles: WritingArticle[];
  diaryEntries: DiaryEntry[];
  coupleDiaries: CoupleDiary[];
  mailboxLetters: MailLetter[];
  forumPosts: ForumPost[];
  tarotRecords: TarotRecord[];
  movieSessions: MovieSession[];
  watchCompanionPlans: WatchCompanionPlan[];
  musicPlayback: {
    currentSongId: string | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    mode: 'full' | 'square' | 'bar' | 'hidden';
  };
}

export interface TarotRecord {
  id: string;
  cards: { name: string; keyword: string; isReversed: boolean }[];
  interpretation: string;
  timestamp: number;
}
