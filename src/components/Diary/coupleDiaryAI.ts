import { generateAIResponse } from '../../lib/ai';
import { getMemoriesForCharacter, estimateSentiment } from '../../lib/characterMemory';
import { useAppStore } from '../../store';
import {
  CoupleDiaryEntry, WhisperMessage, TimeCapsule, WishlistItem,
  LocationCheckin, CoupleDiary, CharacterMemoryEntry,
} from '../../types';

// ── Partner Content Generation ──

interface GenContext {
  partnerId: string;
  partnerName: string;
  partnerPersonality: string;
  partnerBio: string;
  partnerViewOnMe: string;
  partnerExperience: string;
  worldContent: string;
  userName: string;
  userNickname: string;
}

function buildGenContext(partnerId: string): GenContext | null {
  const store = useAppStore.getState();
  const char = store.characters[partnerId];
  if (!char) return null;

  const activeWorld = store.worldSettings.find(w => w.id === store.activeWorldSettingId) || store.worldSettings[0];
  const worldCard = activeWorld?.characters.find(c => c.id === partnerId);

  return {
    partnerId,
    partnerName: char.name,
    partnerPersonality: worldCard?.personality || char.personality || '普通',
    partnerBio: worldCard?.biography || char.biography || '',
    partnerViewOnMe: worldCard?.viewOnMe || (char as any).viewOnMe || '',
    partnerExperience: worldCard?.experience || (char as any).experience || '',
    worldContent: activeWorld?.content || '',
    userName: store.settings.wechatName || '你',
    userNickname: worldCard?.userNickname || char.userNickname || '你',
  };
}

function buildCharDesc(ctx: GenContext): string {
  let desc = `角色名：${ctx.partnerName}\n性格：${ctx.partnerPersonality}`;
  if (ctx.partnerBio) desc += `\n背景：${ctx.partnerBio}`;
  if (ctx.partnerExperience) desc += `\n经历：${ctx.partnerExperience}`;
  if (ctx.partnerViewOnMe) desc += `\n对我（${ctx.userNickname}）的看法：${ctx.partnerViewOnMe}`;
  if (ctx.worldContent) desc += `\n世界观：${ctx.worldContent}`;
  return desc;
}

function getScoredDiaryMemories(partnerId: string, maxResults = 8): string {
  const memories = getMemoriesForCharacter(partnerId, { maxResults });
  // Filter out AI-written couple diary entries (type:feel) but keep real user-written entries
  // AI entries: tags=['couple_diary','diary'], type='feel', category='couple_diary'
  // User entries: tags=['couple_diary','user_diary'], type='event'
  const realMemories = memories.filter(m => !(m.tags?.includes('couple_diary') && !m.tags?.includes('user_diary')));
  if (!realMemories.length) return '';

  const typeLabel: Record<string, string> = {
    fact: '事实', conversation: '对话', event: '事件',
    observation: '观察', preference: '偏好', feel: '感受',
  };

  return realMemories.map(m => {
    const label = typeLabel[m.type] || m.type;
    const summary = m.summary || m.content?.slice(0, 100) || '';
    return `- [${label}] ${summary}`;
  }).join('\n');
}

function saveMemory(partnerId: string, text: string, tags: string[]) {
  try {
    const store = useAppStore.getState();
    const est = estimateSentiment(text);
    store.addCharacterMemory(partnerId, {
      type: 'feel',
      content: text,
      summary: text.slice(0, 60),
      tags: ['couple_diary', ...tags],
      category: 'couple_diary',
      valence: est.valence,
      arousal: est.arousal,
      importance: 2,
      layer: 'diary',
      resolved: 0,
    });
    store.addEmotionEvent({
      characterId: partnerId,
      paDelta: est.valence > 0.6 ? 0.15 : est.valence < 0.4 ? -0.1 : 0.05,
      naDelta: est.valence < 0.4 ? 0.15 : est.valence < 0.5 ? 0.05 : -0.02,
      word: est.valence > 0.6 ? '甜蜜' : est.valence < 0.4 ? '思念' : '日常',
      valence: (est.valence - 0.5) * 2,
      arousal: est.arousal,
      matchSource: 'free_form',
      source: 'manual',
    });
  } catch {}
}

// ── Diary ──

export async function generatePartnerDiary(partnerId: string): Promise<Partial<CoupleDiaryEntry>> {
  const ctx = buildGenContext(partnerId);
  if (!ctx) throw new Error('Partner not found');

  const memories = getScoredDiaryMemories(partnerId);
  const prompt = `${buildCharDesc(ctx)}

你正在写情侣日记。以下是你的真实记忆（基于与你有关的真实互动和日常活动），请严格基于这些记忆写日记：

${memories || '（暂无特别回忆）'}

写作要求：
1. 如果记忆中有与${ctx.userNickname}的真实互动（如聊天、约会等）→ 详细描述这些互动
2. 如果记忆中是角色自己的日常活动（如训练、做饭、看书等）→ 写你此刻的感受和对${ctx.userNickname}的思念，比如"今天xxx的时候，突然好想你"
3. 【禁止】绝对不能编造没有在记忆中出现的具体事件！不能编造共同经历！
4. 【禁止】不能用"可能""或许""仿佛记得"模糊化编造
5. 如果没有任何真实记忆，就只写对${ctx.userNickname}的思念和当下的心情
6. 80-200字，第一人称，语气自然像真日记

同时选择你今天的心情（从以下选一个）：超开心、开心、甜蜜、一般、难过、生气

以 JSON 格式输出：
{"title": "日记标题", "content": "日记内容", "mood": "心情词"}`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const data = json ? JSON.parse(json) : null;
    if (data?.title && data?.content) {
      saveMemory(partnerId, `我在情侣日记中写了一篇日记：${data.title}`, ['diary']);
      return {
        title: data.title,
        content: data.content,
        moods: [data.mood || '开心'],
      };
    }
  } catch {}
  return { title: `${ctx.partnerName}的日记`, content: `想${ctx.userNickname}了。` };
}

// ── Gallery Photo ──

export async function generatePartnerGalleryPhoto(partnerId: string): Promise<{ description: string; caption: string; palette: string }> {
  const ctx = buildGenContext(partnerId);
  if (!ctx) throw new Error('Partner not found');

  const memories = getScoredDiaryMemories(partnerId);
  const PASTEL_PALETTES = ['#fce4ec','#f3e5f5','#e8eaf6','#e0f2f1','#fef3e0','#fbe9e7','#f1f8e9','#e1f5fe','#fce4ec','#f5f0ff'];

  const prompt = `${buildCharDesc(ctx)}

你在情侣相册中给${ctx.userNickname}分享了一张照片。这张照片是你刚刚拍的——你眼前的东西。以下是你的真实记忆：

${memories || '（暂无特别回忆）'}

请基于这些记忆，生成一张照片。需要输出两部分：description（照片画面）和 caption（你附上的一句话）。

【description 要求】
- 这张照片是你自己拍的，读者一看文字就知道你拍了什么
- 1. 如果是共同记忆相关 → 你在某个和ta有关的地方/场景，拍下了眼前的画面，比如"咖啡店吧台上拉花的两杯拿铁""公园长椅上两片叠在一起的落叶"
- 2. 如果是角色自己的日常活动 → 你在做自己的事，看到某个东西联想到${ctx.userNickname}就拍了下来，比如"训练手套上歪歪扭扭缝的名字缩写""桌上吃到一半的草莓蛋糕"
- 【禁止】不能写回忆画面，只能写"此时此刻眼前看到的画面"
- 15-35字，描述照片里能看到什么，不要动作/心理描写，不要emoji

【caption 要求】
- 你在这张照片下附了一句话，告诉${ctx.userNickname}为什么拍了这张照片
- 比如"看到咖啡就想到你，你也来一杯""今天训练完看到手套上的字，你缝的真丑哈哈"
- 10-30字，语气像日常聊天，自然一点
- 不能写"[图片]""这张照片"之类的废话，直接写想说的话

以 JSON 格式输出：
{"description": "照片画面描述", "caption": "附的一句话"}`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const data = json ? JSON.parse(json) : null;
    if (data?.description) {
      saveMemory(partnerId, `我在相册分享了照片：${data.description}`, ['gallery']);
      return {
        description: data.description,
        caption: data.caption || '',
        palette: PASTEL_PALETTES[Math.floor(Math.random() * PASTEL_PALETTES.length)],
      };
    }
  } catch {}
  return { description: `手机相册里一张还没发出去的照片。`, caption: `下次一起拍吧`, palette: '#fce4ec' };
}

// ── Whisper ──

export async function generatePartnerWhisper(partnerId: string): Promise<string> {
  const ctx = buildGenContext(partnerId);
  if (!ctx) return `${ctx?.partnerName || '对方'}想你了。`;

  const memories = getScoredDiaryMemories(partnerId);
  const prompt = `${buildCharDesc(ctx)}

你正在给${ctx.userNickname}写情侣悄悄话。以下是你最近的真实记忆：

${memories || '（暂无特别回忆）'}

请基于记忆，生成一句想对${ctx.userNickname}说的悄悄话（10-40字）。

要求：
1. 如果有最近的真实互动 → 针对那次互动说一句甜蜜的话
2. 如果角色刚做了什么事 → 说一句"我正在...，突然好想你"
3. 【禁止】绝对不能编造具体的共同经历！
4. 自然真实，像恋人之间的低语
5. 直接输出，不要前缀和引号`;

  try {
    const text = await generateAIResponse(prompt);
    const msg = text?.replace(/["「」『』"“”]/g, '').trim();
    if (msg && msg.length > 2) {
      saveMemory(partnerId, `我对${ctx.userNickname}说了一句悄悄话：${msg.slice(0, 40)}`, ['whisper']);
      return msg;
    }
  } catch {}
  return `想${ctx.userNickname}了。`;
}

// ── Time Capsule ──

export async function generatePartnerCapsule(partnerId: string): Promise<{ title: string; content: string }> {
  const ctx = buildGenContext(partnerId);
  if (!ctx) return { title: '给未来', content: '希望我们一直在一起。' };

  const memories = getScoredDiaryMemories(partnerId);
  const prompt = `${buildCharDesc(ctx)}

你在写时光胶囊——写给未来的信。以下是你的真实记忆：

${memories || '（暂无特别回忆）'}

请基于这些记忆写一封简短的信（50-100字）。

要求：
1. 如果有与${ctx.userNickname}的共同记忆 → 回忆那些时刻，写"还记得...吗？"
2. 如果只有角色自己的活动 → 写"今天我...，但我希望未来能和你一起..."
3. 【禁止】绝对不能编造共同回忆！
4. 如果没有任何记忆 → 单纯表达对未来的期待
5. 语气真诚感人

以 JSON 格式输出：
{"title": "标题", "content": "信的内容"}`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const data = json ? JSON.parse(json) : null;
    if (data?.title && data?.content) {
      saveMemory(partnerId, `我写了一个时光胶囊：${data.title}`, ['capsule']);
      return { title: data.title, content: data.content };
    }
  } catch {}
  return { title: `给${ctx.userNickname}的信`, content: `想和你一直走下去。` };
}

// ── Wishlist ──

export async function generatePartnerWish(partnerId: string): Promise<string> {
  const ctx = buildGenContext(partnerId);
  if (!ctx) return '想和你一起旅行。';

  const memories = getScoredDiaryMemories(partnerId);
  const prompt = `${buildCharDesc(ctx)}

你和${ctx.userNickname}在写心愿清单。以下是你最近的记忆：

${memories || '（暂无特别回忆）'}

请基于这些记忆，生成一个心愿（10-30字）。

要求：
1. 如果有共同记忆 → 基于那次经历延伸的心愿（比如聊到旅行→"想和${ctx.userNickname}一起去日本看樱花"）
2. 如果只有角色自己的活动 → 角色此刻的愿望（比如训练累了→"好想和${ctx.userNickname}一起窝在沙发上看电影"）
3. 【禁止】绝对不能编造！
4. 符合角色性格
5. 直接输出，不要前缀引号`;

  try {
    const text = await generateAIResponse(prompt);
    const wish = text?.replace(/["「」『』"“”]/g, '').trim();
    if (wish && wish.length > 3) {
      saveMemory(partnerId, `我在心愿清单添加了：${wish.slice(0, 40)}`, ['wishlist']);
      return wish;
    }
  } catch {}
  return `和${ctx.userNickname}一起做更多事。`;
}

// ── Stamp Map ──

export async function generatePartnerLocation(partnerId: string): Promise<{ name: string; note: string }> {
  const ctx = buildGenContext(partnerId);
  if (!ctx) return { name: '老地方', note: '我们常去的地方。' };

  const memories = getScoredDiaryMemories(partnerId);
  const prompt = `${buildCharDesc(ctx)}

你和${ctx.userNickname}有属于你们的地方。以下是你的真实记忆：

${memories || '（暂无特别回忆）'}

请基于记忆中的地点线索，生成一个对你们有意义的地点名称和备注（名称2-6字，备注10-30字）。

要求：
1. 如果记忆中有具体地点 → 基于真实地点生成
2. 如果没有具体地点 → 生成一个角色性格中可能喜欢的、希望和${ctx.userNickname}一起去的地方
3. 【禁止】绝对不能编造不存在的共同回忆！
4. 真实自然，符合角色性格

以 JSON 格式输出：
{"name": "地点名", "note": "简短备注"}`;

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const data = json ? JSON.parse(json) : null;
    if (data?.name) {
      saveMemory(partnerId, `我在情侣地图标记了一个地点：${data.name}`, ['location']);
      return { name: data.name, note: data.note || '' };
    }
  } catch {}
  return { name: '秘密基地', note: `和${ctx.userNickname}的专属地点。` };
}

// ── Heartbeat (no AI needed, just a notification) ──

export function generateHeartbeatText(partnerId: string): string {
  const store = useAppStore.getState();
  const char = store.characters[partnerId];
  return `${char?.name || '对方'}刚刚戳了你一下！`;
}
