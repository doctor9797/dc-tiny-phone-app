import { generateAIResponse } from '../../lib/ai';
import { useAppStore } from '../../store';

// ── Types ──

export interface PhoneMessage {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
}

export interface PhoneContact {
  id: string;
  name: string;
  avatar: string;
  relationship: string;
  personality: string;
  messages: PhoneMessage[];
}

export interface PhoneCheckData {
  contacts: PhoneContact[];
}

export interface MomentComment {
  authorName: string;
  text: string;
}

export interface MomentPost {
  id: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  timestamp: number;
  images?: string[];
  comments?: MomentComment[];
}

export interface PhoneCheckMoments {
  posts: MomentPost[];
}

export interface PhoneCheckDecision {
  agreed: boolean;
  reply: string;
  passcodeHint?: string;
}

// ── Constants ──

export const OC_AVATARS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#73C6B6',
];

// ── Trigger ──

const QUICK_TRIGGERS = ['查你手机', '看你手机', '查手机', '翻你手机', '检查你手机', '看你微信', '查查你手机', '查查你的手机', '给我看看你的手机', '让我看看你的手机', '手机给我看看', '手机拿过来', '手机我看一下'];

export async function isPhoneCheckTrigger(text: string): Promise<boolean> {
  // Quick keyword check first (no AI cost for obvious cases)
  if (QUICK_TRIGGERS.some(t => text.includes(t))) return true;

  // AI check for fuzzy/vague requests
  try {
    const reply = await generateAIResponse(
      `判断用户是否在要求查看/检查对方的手机。只需回复"是"或"否"。\n用户说：「${text}」\n例如："手机给我看看"→是、"把你手机给我"→是、"我要看你微信"→是、"今天天气不错"→否、"你吃饭了吗"→否、"在干嘛"→否。`
    );
    return reply?.includes('是') ?? false;
  } catch {
    return false;
  }
}

// ── Helpers ──

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── AI Generation ──

export async function decidePhoneCheck(
  charId: string,
  char: { name: string; personality: string; relationship?: string; affection?: number; biography?: string; birthDate?: string },
  userMessage: string,
  recentChat: string,
  passcode: string = '',
  charBirthday: string = '',
  userBirthday: string = '',
  phoneCheckCount: number = 0,
): Promise<PhoneCheckDecision | null> {
  const repeatNote = phoneCheckCount > 0
    ? `\n注意：对方之前已经查过${phoneCheckCount}次你的手机了。这次反应要和之前不一样，不能重复说过的话。如果上次同意了这次可以拒绝，如果上次拒绝了这次态度可以更严厉或无奈妥协。`
    : '';
  // Gather world book context + character card
  const store = useAppStore.getState();
  const worldSettings = store.worldSettings;
  const activeWorldId = store.activeWorldSettingId;
  const activeWorld = worldSettings.find(w => w.id === activeWorldId) || worldSettings[0];
  const worldContent = activeWorld ? activeWorld.content : '';
  const worldCharacters = activeWorld ? activeWorld.characters : [];
  const worldCharCard = worldCharacters.find(c => c.id === charId);
  const charFromWorld = worldCharCard ? {
    personality: worldCharCard.personality || char.personality,
    viewOnMe: worldCharCard.viewOnMe || '',
    experience: worldCharCard.experience || '',
    forceRequirements: worldCharCard.forceRequirements || '',
  } : null;

  // Gather recent character memories about phone/privacy
  const memories = store.characterMemoryBank[charId] || [];
  const relevantMemories = memories
    .filter(m => m.tags?.includes('phone_check') || m.content?.includes('手机') || m.content?.includes('隐私'))
    .slice(0, 5)
    .map(m => `- ${m.summary || m.content?.slice(0, 120)}`)
    .join('\n');

  const prompt = `你正在扮演${char.name}。
角色性格：${charFromWorld?.personality || char.personality || '普通'}
关系：${char.relationship || '朋友'}，好感度：${char.affection ?? 50}/100
${char.biography ? '背景：' + char.biography : ''}
${charFromWorld?.viewOnMe ? '对方在我眼中的印象：' + charFromWorld.viewOnMe : ''}
${charFromWorld?.experience ? '经历：' + charFromWorld.experience : ''}
${charFromWorld?.forceRequirements ? '强制要求：' + charFromWorld.forceRequirements : ''}

【世界观设定】
${worldContent || '（无特别世界观设定）'}

【相关记忆】
${relevantMemories || '（暂无相关记忆）'}

对方刚才说：「${userMessage}」
最近的聊天记录：
${recentChat || '（暂无）'}${repeatNote}

根据角色的完整人设、世界观、记忆，以及和对方的关系，角色是否同意让对方查看自己的手机？

请以 JSON 格式回复，严格按以下格式：
{
  "agreed": true/false,
  "reply": "对对方说的话（同意或拒绝，完全使用角色性格的语气）",
  "passcodeHint": "如果设了密码且你同意给看，放提示；填空字符串=没提示"
}

注意：
- 回复必须严格符合角色的性格设定、世界观设定、角色卡强制要求
- 如果关系亲密（恋人/配偶/好感度>70），较可能同意
- 如果性格谨慎/多疑，较可能拒绝
- 如果心中有秘密，较可能拒绝
- 回复语气由角色性格和人设决定——温柔的人就温柔，暴躁的人就暴躁，尊重角色本身
${passcode ? '- 手机锁屏密码是"' + passcode + '"' : '- 手机没有设置锁屏密码'}
${charBirthday ? '- 你的生日是' + charBirthday : ''}
${userBirthday ? '- 对方的生日是' + userBirthday : ''}
- 如果同意给看：
${passcode ? '  - 可以告诉对方密码。如果密码数字和生日（MMDD）一致可以说"密码是我生日"/"密码是你生日"，如果不一致直接说密码数字' : '  - 没有密码，可以说"手机没锁直接看吧"'}
  - 如果之前聊天记录里告诉过对方密码，可以说"和上次一样"
- 如果拒绝：直接拒绝，不用说密码的事`;
  try {
    const text = await generateAIResponse(prompt);
    const json = text?.match(/\{[\s\S]*\}/)?.[0];
    if (json) {
      const parsed = JSON.parse(json);
      return {
        agreed: !!parsed.agreed,
        reply: parsed.reply || '…',
        passcodeHint: parsed.passcodeHint || undefined,
      };
    }
  } catch {}
  return null;
}

export async function generateMockPhoneData(
  ownerId: string,
  owner: { name: string; personality: string; biography?: string },
  allChars: Record<string, { name: string; avatar?: string; personality?: string; relationship?: string; biography?: string; isDisabled?: boolean; isWeChatFriend?: boolean }>,
  checkTime: number,
): Promise<PhoneCheckData> {
    // Pass store character info as reference so AI knows who exists in this world
  // Include both existing friends (isWeChatFriend=true) and pending requests (isWeChatFriend=false)
  const allKnown = Object.values(allChars).filter((c: any) => !c.isDisabled);
  const storeKnown = allKnown
    .filter((c: any) => c.id !== ownerId)
    .map((c: any) => ({ id: c.id, name: c.name || c.id, avatar: c.avatar || pickRandom(OC_AVATARS), personality: c.personality || '', relationship: c.relationship || '', biography: c.biography || '', isWeChatFriend: c.isWeChatFriend }));

  const storeCandidates = storeKnown.filter((c: any) => c.isWeChatFriend !== false);
  const pendingCandidates = storeKnown.filter((c: any) => c.isWeChatFriend === false);

  const prompt = `你正在扮演${owner.name}。
角色性格：${owner.personality || '普通'}
${owner.biography ? '背景：' + owner.biography : ''}

当前时间是：${new Date(checkTime).toLocaleString('zh-CN')}

请根据角色的性格、背景故事和社交圈，**完全由你自行决定**该角色手机通讯录里应该有哪些联系人。

首先根据角色名字判断：如果角色名是英文名（如 Bruce Wayne、Clark Kent、Tony Stark、Harry Potter 等），角色是**西方人**，所有联系人也必须用英文名；如果角色名是中文名，则联系人用中文名。严禁西方角色联系人中出现"老王""小李""张叔"这类中文名。

以下是一些已知的角色（可能和角色同属一个世界观）供参考：
${storeCandidates.map(c => `- ${c.name}（身份：${c.relationship || '未知'}${c.biography ? '，' + c.biography : ''}）`).join('\n')}
${pendingCandidates.length > 0 ? '\n以下角色已经请求添加为好友但你还未通过（必须包含在通讯录中）：\n' + pendingCandidates.map(c => `- ${c.name}（身份：${c.relationship || '未知'}${c.biography ? '，' + c.biography : ''}）`).join('\n') : ''}

【强制要求】
- ${pendingCandidates.length > 0 ? '上述"已请求添加好友"的角色**必须**出现在通讯录中。' : ''}
- 可以自行添加原创联系人，也可以从参考列表中选择
- 禁止添加和角色敌对的人

请生成该角色手机通讯录里的联系人，要求：
1. **完全基于角色人设和世界观**决定联系人。
2. **【红线】严禁**出现和角色敌对、竞争、仇恨、互相看不顺眼的人。例如蝙蝠侠不能有小丑、企鹅人、稻草人；超人不能有卢瑟；哈利波特不能有马尔福、伏地魔。**只要是对立势力或敌对关系的人，一律禁止出现。**
3. 联系人的名字、关系、与角色的交集都要合理。
4. **根据角色所属文化选择联系人名字**：西方角色→英文名（如 Alfred、Dick、Lois），东方角色→中文名（如 张伟、王建国）。**绝对不能混用。**
5. 其中一部分联系人最近有聊过天（你自行决定哪些人聊了、聊什么），生成 1-2 轮对话。
6. 所有对话时间必须在 ${new Date(checkTime).toLocaleString('zh-CN')} 之前。
7. 对话内容要符合角色性格和双方关系，自然口语化。

以 JSON 数组格式回复，不要加 markdown 代码块：
[
  {
    "contactName": "联系人名字（中文）",
    "contactId": "唯一英文id",
    "relationship": "与角色的关系",
    "personality": "联系人性格，6-15个字概括",
    "conversation": [
      { "text": "消息内容", "sender": "me", "minutesAgo": 120 },
      { "text": "回复内容", "sender": "them", "minutesAgo": 118 }
    ]
  }
]

要求：
- **所有联系人都在 JSON 数组中**，没聊过天的不带 conversation 字段
- **最近聊过天的人数你自行决定**
- sender: "me" = 角色发的, "them" = 对方发的
- minutesAgo: 距离当前时间多少分钟前（必须是正数）
- contactId: 用英文，如 "alfred" "dick_grayson"
- personality: 用简短中文描述性格，用于模拟其回复风格
- 对话自然口语化，符合角色性格和双方关系`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? (() => { try { return JSON.parse(json); } catch { return null; } })() : null;
    if (Array.isArray(arr)) {
      const contacts: PhoneContact[] = arr.map((item: any) => {
        const match = storeCandidates.find(n => n.name === item.contactName);
        return {
          id: item.contactId || 'oc_' + randomId(),
          name: item.contactName || '未知',
          avatar: match?.avatar || pickRandom(OC_AVATARS),
          relationship: item.relationship || (match?.relationship || '朋友'),
          personality: item.personality || (match?.personality || '性格温和'),
          messages: (item.conversation || []).map((msg: any) => ({
            id: randomId(),
            text: msg.text || '',
            sender: msg.sender === 'me' ? 'me' : 'them',
            timestamp: checkTime - (msg.minutesAgo || 60) * 60 * 1000,
          })),
        };
      });
      return { contacts };
    }
  } catch {}

  // Last resort: AI failed entirely, try a simpler prompt
  try {
    const fallbackPrompt = `你正在扮演${owner.name}，${owner.personality || ''}。
${owner.biography ? '背景：' + owner.biography : ''}

当前时间是：${new Date(checkTime).toLocaleString('zh-CN')}

请根据角色名判断角色所属文化（英文名→西方角色用英文联系人名，中文名→中文联系人名），生成该角色微信通讯录中应有的联系人，并从中选一部分人生成简短对话。严禁出现角色敌对的人。

要求：西方角色联系人用英文名，东方角色用中文名。contactId用英文。不需对话的人不带conversation字段。

JSON数组格式（不要代码块）：
[{"contactName":"联系人中文名","contactId":"英文id","relationship":"关系","personality":"性格","conversation":[{"text":"消息","sender":"me","minutesAgo":60},{"text":"回复","sender":"them","minutesAgo":58}]}]`;
    const text = await generateAIResponse(fallbackPrompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? JSON.parse(json) : null;
    if (Array.isArray(arr) && arr.length >= 5) {
      return {
        contacts: arr.map((item: any) => ({
          id: item.contactId || 'oc_' + randomId(),
          name: item.contactName || '未知',
          avatar: pickRandom(OC_AVATARS),
          relationship: item.relationship || '朋友',
          personality: item.personality || '性格温和',
          messages: (item.conversation || []).map((msg: any) => ({
            id: randomId(),
            text: msg.text || '',
            sender: msg.sender === 'me' ? 'me' : 'them',
            timestamp: checkTime - (msg.minutesAgo || 60) * 60 * 1000,
          })),
        })),
      };
    }
  } catch {}

  return { contacts: [] };
}

export async function incrementPhoneData(
  characterId: string,
  owner: { name: string; personality: string; biography?: string },
  existingData: PhoneCheckData | null,
  allChars: Record<string, { name: string; avatar?: string; personality?: string; relationship?: string; biography?: string; isDisabled?: boolean; isWeChatFriend?: boolean }>,
  checkTime: number,
): Promise<PhoneCheckData> {
  if (!existingData || !existingData.contacts?.length) {
    return generateMockPhoneData(characterId, owner, allChars, checkTime);
  }

  // Keep ALL old contacts, never drop them
  const existingContacts = existingData.contacts;

  // Determine latest timestamp
  let latestTs = 0;
  for (const c of existingContacts) {
    for (const m of c.messages) {
      if (m.timestamp > latestTs) latestTs = m.timestamp;
    }
  }

  // Show up to last 6 messages per contact
  const existingDesc = existingContacts.map(c => {
    const recentMsgs = c.messages.slice(-6).map(m =>
      `${m.sender === 'me' ? '我' : c.name}: ${m.text}`
    ).join('\n');
    return `- ${c.name}（性格：${c.personality || '性格温和'}，关系：${c.relationship || '朋友'}，共${c.messages.length}条消息）\n${recentMsgs ? '  最近消息：\n' + recentMsgs.split('\n').map(l => '  ' + l).join('\n') : '  暂无私聊'}`;
  }).join('\n\n');

  const prompt = `你正在扮演${owner.name}。
角色性格：${owner.personality || '普通'}
${owner.biography ? '背景：' + owner.biography : ''}

当前时间是：${new Date(checkTime).toLocaleString('zh-CN')}

以下是你微信里已有的联系人和聊天记录（这些记录已保留，请勿复述或重复）：

${existingDesc}

现在这是你**第二次/第三次**打开手机，距离上次查看已经过了一段时间。

请执行以下操作：
1. **优先为"暂无私聊"的联系人新增初次对话**，这些人在通讯录里但一直没聊过天。
2. 其次为已有聊天记录的联系人新增后续对话。
3. **如果觉得合适，可以自己原创新的联系人加到通讯录中**。新联系人的名字根据角色所属文化决定（西方角色→英文名，东方角色→中文名）。**严禁**添加和角色敌对的人。
4. 新增对话的联系人数量、新增联系人的数量，全由你自行决定。

新增对话的时间必须在 ${new Date(Math.max(latestTs, checkTime - 86400000) + 60000).toLocaleString('zh-CN')} 到 ${new Date(checkTime).toLocaleString('zh-CN')} 之间。

按以下 JSON 数组格式回复，不要加 markdown 代码块：
[
  {
    "contactName": "联系人名字",
    "contactId": "唯一英文id",
    "relationship": "与角色的关系",
    "personality": "联系人性格，6-15个字概括",
    "conversation": [
      { "text": "消息内容", "sender": "me", "minutesAgo": 30 },
      { "text": "回复内容", "sender": "them", "minutesAgo": 28 }
    ]
  }
]

要求：
- **只需要有新增对话或新增联系人才出现在数组中**，已有联系人但没新增的不需要出现
- **必须包含至少 2 个之前"暂无私聊"的联系人**（即没有聊天记录的）
- 新增联系人的 contactId 用英文，contactName 用中文，新增联系人必须包含 personality 字段
- minutesAgo: 距离当前时间多少分钟前（正数）
- 对话内容要基于角色性格自然延续，不要复述旧内容
- 每条消息自然口语化`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? (() => { try { return JSON.parse(json); } catch { return null; } })() : null;

    if (Array.isArray(arr)) {
      const existingMap = new Map(existingContacts.map(c => [c.name, c]));

      for (const item of arr) {
        const existing = existingMap.get(item.contactName);
        if (existing) {
          const newMessages: PhoneMessage[] = (item.conversation || []).map((msg: any) => ({
            id: randomId(),
            text: msg.text || '',
            sender: msg.sender === 'me' ? 'me' : 'them',
            timestamp: checkTime - (msg.minutesAgo || 60) * 60 * 1000,
          }));
          existing.messages = [...existing.messages, ...newMessages];
        } else {
          // New contact — AI created it
          existingContacts.push({
            id: item.contactId || 'oc_' + randomId(),
            name: item.contactName || '未知',
            avatar: pickRandom(OC_AVATARS),
            relationship: item.relationship || '朋友',
            personality: item.personality || '性格温和',
            messages: (item.conversation || []).map((msg: any) => ({
              id: randomId(),
              text: msg.text || '',
              sender: msg.sender === 'me' ? 'me' : 'them',
              timestamp: checkTime - (msg.minutesAgo || 60) * 60 * 1000,
            })),
          });
        }
      }
      return { contacts: existingContacts };
    }
  } catch {}

  return { contacts: existingContacts };
}

export async function generatePhoneCheckMoments(
  characterId: string,
  owner: { name: string; personality: string; avatar?: string },
  contacts: { name: string; personality?: string; relationship?: string; avatar?: string }[],
  existingMoments: PhoneCheckMoments | null,
  checkTime: number,
): Promise<PhoneCheckMoments> {
  const existingPosts = existingMoments?.posts || [];

  // Determine time range for new posts
  let latestTs = 0;
  for (const p of existingPosts) {
    if (p.timestamp > latestTs) latestTs = p.timestamp;
  }

  const contactsDesc = contacts.map(c =>
    `- ${c.name}（性格：${c.personality || '性格温和'}，关系：${c.relationship || '朋友'}）`
  ).join('\n');

  const prompt = `你正在扮演${owner.name}（${owner.personality || '普通'}）。

请生成 1-2 条朋友圈，发布者可以是${owner.name}本人，也可以是联系人。
联系人：
${contactsDesc}

所有朋友圈的时间必须在 ${new Date(checkTime).toLocaleString('zh-CN')} 之前。
${existingPosts.length > 0 ? `已有朋友圈的最新时间是 ${new Date(latestTs).toLocaleString('zh-CN')}，新增的请在此时间之后。` : ''}

以 JSON 数组格式回复：
[
  {
    "authorName": "发布者名字",
    "content": "朋友圈文字内容",
    "minutesAgo": 45,
    "comments": [
      { "authorName": "评论者名字", "text": "评论内容" }
    ]
  }
]

要求：
- 内容阳光健康，符合作者性格
- minutesAgo 是距离 checkTime 的分钟数（正数）
- 评论可选，1-2条
- **评论的语气和风格要符合评论者的性格**`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.match(/\[[\s\S]*\]/)?.[0];
    if (json) {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        const newPosts: MomentPost[] = parsed.map((post: any) => {
          const contact = contacts.find(c => c.name === post.authorName);
          return {
            id: randomId(),
            authorName: post.authorName || owner.name,
            authorAvatar: contact?.avatar || owner.avatar || pickRandom(OC_AVATARS),
            content: post.content || '',
            timestamp: checkTime - (post.minutesAgo || 60) * 60 * 1000,
            comments: (post.comments || [])
              .filter((c: any) => c.text?.trim().length > 0)
              .map((c: any) => ({
              authorName: c.authorName || '匿名',
              text: c.text || '',
            })),
          };
        });
        return { posts: [...existingPosts, ...newPosts] };
      }
    }
  } catch {}

  // Fallback: add a generic post
  const fallback: MomentPost = {
    id: randomId(),
    authorName: owner.name,
    authorAvatar: owner.avatar || pickRandom(OC_AVATARS),
    content: '今天天气真好。',
    timestamp: checkTime - 30 * 60 * 1000,
    comments: [],
  };
  return { posts: [...existingPosts, fallback] };
}

// buildFallbackConversations removed — everything is AI-generated

// ── Music Types ──

export interface PhoneSong {
  id: string;
  title: string;
  artist: string;
  duration: string;
}

export interface PhoneMusicData {
  collected: PhoneSong[];
}

const STORAGE_MUSIC_KEY = 'phone_music_';

export async function generateInitialMusic(
  owner: { name: string; personality: string; biography?: string },
  characterId: string,
): Promise<PhoneMusicData> {
  const prompt = `根据角色人设，为${owner.name}生成手机音乐软件里的收藏歌曲。

角色名：${owner.name}
角色性格：${owner.personality || '普通'}
${owner.biography ? '背景：' + owner.biography : ''}

要求：
1. **歌曲必须符合角色性格、身份、世界观**
2. **歌曲必须是现实中真实存在的歌曲**，不能瞎编
3. **根据角色名字和背景判断角色说什么语言**——如果是西方人/美国人/英国人/欧洲人，歌曲必须是英文歌（或角色母语的歌）；如果是中国人则中文歌；日本人则日文歌等
4. 生成大约 10 首收藏歌曲（你自行决定数量）
5. 歌曲名和歌手名保留原文（如英文歌就写英文原名，中文歌写中文），不要翻译
6. 时长格式为 "M:SS"

以 JSON 数组格式输出，不要 markdown 代码块：
[
  { "title": "歌曲名", "artist": "歌手名", "duration": "3:45" }
]`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? JSON.parse(json) : null;
    if (Array.isArray(arr) && arr.length > 0) {
      const songs: PhoneSong[] = arr.map((s: any, i: number) => ({
        id: 'music_' + characterId + '_' + i,
        title: s.title || '未知曲目',
        artist: s.artist || '未知歌手',
        duration: s.duration || '3:00',
      }));
      const data: PhoneMusicData = { collected: songs };
      localStorage.setItem(STORAGE_MUSIC_KEY + characterId, JSON.stringify(data));
      return data;
    }
  } catch {}

  return { collected: [] };
}

export async function incrementMusic(
  owner: { name: string; personality: string; biography?: string },
  characterId: string,
  existing: PhoneMusicData,
): Promise<PhoneMusicData> {
  const existingDesc = existing.collected.map(s =>
    `- 《${s.title}》- ${s.artist}（${s.duration}）`
  ).join('\n');

  const prompt = `根据角色人设，为${owner.name}的手机音乐软件新增收藏歌曲。

角色名：${owner.name}
角色性格：${owner.personality || '普通'}
${owner.biography ? '背景：' + owner.biography : ''}

已有收藏歌曲：
${existingDesc}

要求：
1. 新增 3-5 首歌曲（你自行决定数量）
2. **歌曲必须是现实中真实存在的歌曲**，不能瞎编
3. **根据角色名字和背景判断角色说什么语言**，歌曲语言要匹配
4. 新增歌曲风格必须和已有歌曲及角色人设一致
5. 不能和已有歌曲重复
6. 歌曲名和歌手名保留原文
7. 时长格式为 "M:SS"

以 JSON 数组格式输出，不要 markdown 代码块：
[
  { "title": "歌曲名", "artist": "歌手名", "duration": "3:45" }
]`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? JSON.parse(json) : null;
    if (Array.isArray(arr) && arr.length > 0) {
      const newSongs: PhoneSong[] = arr.map((s: any, i: number) => ({
        id: 'music_' + characterId + '_new_' + Date.now() + '_' + i,
        title: s.title || '未知曲目',
        artist: s.artist || '未知歌手',
        duration: s.duration || '3:00',
      }));
      const data: PhoneMusicData = { collected: [...existing.collected, ...newSongs] };
      localStorage.setItem(STORAGE_MUSIC_KEY + characterId, JSON.stringify(data));
      return data;
    }
  } catch {}

  return existing;
}

export async function generateRecentMusic(
  owner: { name: string; personality: string; biography?: string },
  characterId: string,
): Promise<PhoneSong[]> {
  const prompt = `根据角色人设，为${owner.name}生成最近在听的 15 首歌曲。

角色名：${owner.name}
角色性格：${owner.personality || '普通'}
${owner.biography ? '背景：' + owner.biography : ''}

要求：
1. **歌曲必须是现实中真实存在的歌曲**，不能瞎编
2. **根据角色名字和背景判断角色说什么语言**，歌曲语言要匹配
3. 最近在听代表角色最近常听的 15 首，要符合角色性格和最近心境
4. 其中大部分应该来自角色的收藏歌曲风格，但也可以有一些新的尝试
5. 歌曲名和歌手名保留原文
6. 时长格式为 "M:SS"

以 JSON 数组格式输出，不要 markdown 代码块，正好 15 首：
[
  { "title": "歌曲名", "artist": "歌手名", "duration": "3:45" }
]`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? JSON.parse(json) : null;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.slice(0, 15).map((s: any, i: number) => ({
        id: 'music_recent_' + characterId + '_' + Date.now() + '_' + i,
        title: s.title || '未知曲目',
        artist: s.artist || '未知歌手',
        duration: s.duration || '3:00',
      }));
    }
  } catch {}

  return [];
}

export function loadMusicData(characterId: string): PhoneMusicData | null {
  try {
    const raw = localStorage.getItem(STORAGE_MUSIC_KEY + characterId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveMusicData(characterId: string, data: PhoneMusicData) {
  localStorage.setItem(STORAGE_MUSIC_KEY + characterId, JSON.stringify(data));
}

// ── Photo Types ──

export interface PhonePhoto {
  id: string;
  description: string;
  palette: string;
  category: string;
  timestamp: number;
}


export async function generateInitialPhotos(
  owner: { name: string; personality: string; biography?: string },
  characterId: string,
  checkTime: number,
): Promise<PhonePhoto[]> {
  const cacheKey = 'phone_photos_v2_' + characterId;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  const prompt = `你正在扮演${owner.name}。
角色性格：${owner.personality || '普通'}
${owner.biography ? '背景设定：' + owner.biography : ''}

当前时间：${new Date(checkTime).toLocaleString('zh-CN')}

请为${owner.name}的手机相册生成一批照片。

要求：
1. 照片总量在 20-60 张之间（你自行决定合适的数量，必须是随机数量）
2. 每张照片用一段 20-40 字的详细中文描述，描写照片画面内容，生动具体
3. 照片按照相册分类组织，分类名由你根据角色生活决定（如"夜巡"、"家人"、"装备"、"哥谭街景"等），每个分类至少 3 张照片
4. 每张照片配一个柔和浅色 palette（十六进制浅色色值，必须是浅色/马卡龙色系，饱和度低、亮度高，如 #fce4ec #e8eaf6 #fff3e0 #e0f2f1 #f3e5f5 这类）
5. 照片内容必须严格符合角色的身份和设定（警察不能保存自己犯罪的照片，蝙蝠侠不会出现在阳光海滩度假）
6. 描述中不能出现 emoji，不能出现动作/心理描写，只描述照片画面

按以下 JSON 数组格式输出（不要 markdown 代码块）：
[
  {
    "category": "分类名",
    "description": "20-40字的照片画面描写",
    "palette": "#xxxxxx",
    "minutesAgo": 分钟数
  },
  ...
]

注意：
- minutesAgo 是距离当前时间的分钟数（正数，越大越早），所有照片的时间跨度在最近 90 天内
- 分类名必须中文，要能体现角色的生活轨迹
- 照片数量随机分布在各个分类中，每个分类的照片数量不要完全相同`;
  let retries = 0;
  while (retries < 3) {
    try {
      const text = await generateAIResponse(prompt);
      const json = text?.replace(/```json\n?|```\n?/g, '').trim();
      const arr = json ? JSON.parse(json) : null;
      if (Array.isArray(arr) && arr.length >= 10) {
        const photos: PhonePhoto[] = arr.map((p: any, i: number) => ({
          id: 'photo_' + characterId + '_' + i + '_' + Date.now(),
          description: (p.description || '').trim(),
          palette: p.palette || '#1e293b',
          category: p.category || '其他',
          timestamp: checkTime - (p.minutesAgo || 60 + i * 5) * 60 * 1000,
        }));
        localStorage.setItem(cacheKey, JSON.stringify(photos));
        return photos;
      }
    } catch {}
    retries++;
  }

  return generatePhotoFallback(owner, characterId, checkTime);
}

export async function incrementPhotos(
  owner: { name: string; personality: string; biography?: string },
  characterId: string,
  existingPhotos: PhonePhoto[],
  checkTime: number,
): Promise<PhonePhoto[]> {
  let latestTs = 0;
  for (const p of existingPhotos) {
    if (p.timestamp > latestTs) latestTs = p.timestamp;
  }

  const categorySummary: Record<string, number> = {};
  for (const p of existingPhotos) {
    categorySummary[p.category] = (categorySummary[p.category] || 0) + 1;
  }
  const catDesc = Object.entries(categorySummary)
    .map(([cat, count]) => '- ' + cat + '（' + count + '张）')
    .join('\n');

  const prompt = `你正在扮演${owner.name}。
角色性格：${owner.personality || '普通'}
${owner.biography ? '背景设定：' + owner.biography : ''}

当前时间：${new Date(checkTime).toLocaleString('zh-CN')}

${owner.name}的手机相册已有${existingPhotos.length}张照片，分类如下：
${catDesc}

现在请新增一批照片（2-8 张之间，你自行决定随机数量），要求：
1. 每张照片用一段 20-40 字的详细中文描写
2. 新增的照片可以使用已有的分类，也可以创建新的分类
3. 每张照片配一个氛围色 palette
4. 照片内容不能与已有照片重复
5. 照片内容必须严格符合角色设定
6. 描述中不能出现 emoji

新增照片的时间必须发生在最近几天内（即 minutesAgo 在 10 到 4320 分钟之间）。

按以下 JSON 数组输出：
[
  {
    "category": "分类名",
    "description": "20-40字的照片画面描写",
    "palette": "#xxxxxx",
    "minutesAgo": 分钟数
  },
  ...
]

不要输出 markdown 代码块，只输出纯 JSON。`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? JSON.parse(json) : null;
    if (Array.isArray(arr) && arr.length > 0) {
      const newPhotos: PhonePhoto[] = arr.map((p: any, i: number) => ({
        id: 'photo_' + characterId + '_new_' + Date.now() + '_' + i,
        description: (p.description || '').trim(),
        palette: p.palette || '#1e293b',
        category: p.category || '其他',
        timestamp: checkTime - (p.minutesAgo || 60) * 60 * 1000,
      }));
      const result = [...existingPhotos, ...newPhotos];
      localStorage.setItem('phone_photos_v2_' + characterId, JSON.stringify(result));
      return result;
    }
  } catch {}

  const result = [...existingPhotos];
  localStorage.setItem('phone_photos_v2_' + characterId, JSON.stringify(result));
  return result;
}

export function getPhotoCategories(photos: PhonePhoto[]): { name: string; count: number; palettes: string[] }[] {
  const map = new Map<string, { count: number; palettes: string[] }>();
  for (const p of photos) {
    const existing = map.get(p.category);
    if (existing) {
      existing.count++;
      if (existing.palettes.length < 3) existing.palettes.push(p.palette);
    } else {
      map.set(p.category, { count: 1, palettes: [p.palette] });
    }
  }
  return Array.from(map.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);
}

function generatePhotoFallback(
  owner: { name: string },
  characterId: string,
  checkTime: number,
): PhonePhoto[] {
  const colors = ['#0f172a', '#1e293b', '#292524', '#44403c', '#57534e', '#1c1917', '#451a03', '#1e3a5f', '#27272a', '#fefce8', '#fce7f3', '#f0f9ff', '#fef3c7', '#f5f3ff'];
  const categories = ['日常', '街景', '装备', '朋友', '风景'];
  const descs = [
    '城市夜景，高楼上俯瞰万家灯火',
    '桌面上一杯冒着热气的咖啡，旁边摊开着笔记本',
    '公园长椅上的落叶，阳光透过树枝洒下斑驳光影',
    '朋友聚会时的合影，大家举杯笑得很开心',
    '书架上几本被翻旧了的书，书脊上的字迹已经模糊',
    '窗外的雨景，雨水顺着玻璃滑落，城市模糊成一片',
    '厨房台面上刚出炉的面包，表面泛着金黄色的光泽',
    '地铁站台上匆忙的人群，灯光昏黄而温暖',
    '一件挂在衣帽架上的旧风衣，口袋边角已经磨损',
    '老式唱片机的一角，唱针轻轻搁在黑色的唱片上',
    '一只蹲在窗台上的花猫，眼睛在黑暗中闪着琥珀色的光',
    '工具箱里整齐摆放的各种工具，扳手和螺丝刀分类排列',
  ];
  const count = 20 + Math.floor(Math.random() * 25);
  const photos: PhonePhoto[] = [];
  for (let i = 0; i < count; i++) {
    photos.push({
      id: 'photo_' + characterId + '_fb_' + i,
      description: descs[i % descs.length],
      palette: colors[i % colors.length],
      category: categories[i % categories.length],
      timestamp: checkTime - (i + 1) * 86400000 * (0.5 + Math.random()),
    });
  }
  localStorage.setItem('phone_photos_v2_' + characterId, JSON.stringify(photos));
  return photos;
}

// ── Call Log Types ──

export interface CallRecord {
  id: string;
  contactName: string;
  contactId?: string;
  direction: 'incoming' | 'outgoing' | 'missed';
  duration: number;
  timestamp: number;
}

export interface CallLogData {
  records: CallRecord[];
}

const STORAGE_CALL_KEY = 'phone_call_log_';

export async function generateInitialCallLog(
  owner: { name: string; personality: string; biography?: string },
  characterId: string,
  contacts: { name: string; relationship?: string }[],
  checkTime: number,
): Promise<CallLogData> {
  const contactsDesc = contacts.map(c =>
    `- ${c.name}（关系：${c.relationship || '朋友'}）`
  ).join('\n');

  const prompt = `为${owner.name}生成手机通话记录。

角色名：${owner.name}
角色性格：${owner.personality || '普通'}
${owner.biography ? '背景：' + owner.biography : ''}

角色通讯录中有以下联系人：
${contactsDesc}

要求：
1. 生成大约 10 条通话记录（你自行决定数量）
2. 通话对象必须来自上述通讯录，且与该角色的人设逻辑一致（谁会和他通话、为什么）
3. 通话记录包含：联系人、通话方向（呼入/呼出/未接）、通话时长（秒）、通话时间
4. 通话时间必须都在当前时间 ${new Date(checkTime).toLocaleString('zh-CN')} 之前
5. 通话时长随机（几秒到几十分钟不等），未接来电时长为 0
6. 呼入和呼出的数量你自己决定
7. 通话记录分布在过去一周内

以 JSON 数组格式输出，不要 markdown 代码块：
[
  {
    "contactName": "联系人名字",
    "direction": "incoming/outgoing/missed",
    "duration": 秒数,
    "minutesAgo": 分钟数
  }
]

要求：contactName 必须是通讯录中的联系人名字，direction 用英文 "incoming" 呼入、"outgoing" 呼出、"missed" 未接。`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? JSON.parse(json) : null;
    if (Array.isArray(arr) && arr.length > 0) {
      const validNames = new Set(contacts.map(c => c.name));
      const records: CallRecord[] = arr
        .filter((r: any) => r.contactName && validNames.has(r.contactName))
        .map((r: any, i: number) => ({
        id: 'call_' + characterId + '_' + i,
        contactName: r.contactName || '未知',
        direction: r.direction === 'missed' ? 'missed' : r.direction === 'outgoing' ? 'outgoing' : 'incoming',
        duration: r.direction === 'missed' ? 0 : (r.duration || Math.floor(Math.random() * 600) + 10),
        timestamp: checkTime - (r.minutesAgo || 60 + i * 120) * 60 * 1000,
      }));
      const data: CallLogData = { records };
      localStorage.setItem(STORAGE_CALL_KEY + characterId, JSON.stringify(data));
      return data;
    }
  } catch {}

  return { records: [] };
}

export async function incrementCallLog(
  owner: { name: string; personality: string; biography?: string },
  characterId: string,
  contacts: { name: string; relationship?: string }[],
  existing: CallLogData,
  checkTime: number,
): Promise<CallLogData> {
  const existingDesc = existing.records.map(r =>
    `- ${r.contactName}（${r.direction === 'incoming' ? '呼入' : r.direction === 'outgoing' ? '呼出' : '未接'}，${r.duration}秒）`
  ).join('\n');

  const contactsDesc = contacts.map(c =>
    `- ${c.name}（关系：${c.relationship || '朋友'}）`
  ).join('\n');

  const prompt = `为${owner.name}的手机新增通话记录。

角色名：${owner.name}
角色性格：${owner.personality || '普通'}
${owner.biography ? '背景：' + owner.biography : ''}

已有的通话记录：
${existingDesc}

角色通讯录联系人：
${contactsDesc}

要求：
1. 新增 3-6 条通话记录（你自行决定数量）
2. 通话对象来自上述通讯录，也可以和已有记录中的联系人重复
3. 新增记录不能和已有记录完全相同（时间、时长不同即可）
4. 新增通话时间必须在 ${new Date(checkTime - 86400000).toLocaleString('zh-CN')} 到 ${new Date(checkTime).toLocaleString('zh-CN')} 之间
5. 通话时长随机（几秒到几十分钟不等），未接来电时长为 0
6. 呼入、呼出、未接的比例你自行决定

以 JSON 数组格式输出，不要 markdown 代码块：
[
  {
    "contactName": "联系人名字",
    "direction": "incoming/outgoing/missed",
    "duration": 秒数,
    "minutesAgo": 分钟数
  }
]`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? JSON.parse(json) : null;
    if (Array.isArray(arr) && arr.length > 0) {
      const validNames = new Set(contacts.map(c => c.name));
      const newRecords: CallRecord[] = arr
        .filter((r: any) => r.contactName && validNames.has(r.contactName))
        .map((r: any, i: number) => ({
        id: 'call_' + characterId + '_new_' + Date.now() + '_' + i,
        contactName: r.contactName || '未知',
        direction: r.direction === 'missed' ? 'missed' : r.direction === 'outgoing' ? 'outgoing' : 'incoming',
        duration: r.direction === 'missed' ? 0 : (r.duration || Math.floor(Math.random() * 600) + 10),
        timestamp: checkTime - (r.minutesAgo || 10 + i * 60) * 60 * 1000,
      }));
      const data: CallLogData = { records: [...existing.records, ...newRecords] };
      localStorage.setItem(STORAGE_CALL_KEY + characterId, JSON.stringify(data));
      return data;
    }
  } catch {}

  return existing;
}

export function loadCallLogData(characterId: string): CallLogData | null {
  try {
    const raw = localStorage.getItem(STORAGE_CALL_KEY + characterId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveCallLogData(characterId: string, data: CallLogData) {
  localStorage.setItem(STORAGE_CALL_KEY + characterId, JSON.stringify(data));
}
