import { generateAIResponse } from '../../lib/ai';
import { useAppStore } from '../../store';

// ── Types ──

export interface WeekDaySummary {
  date: string;
  summary: string;
}

export interface CalendarWeekData {
  weekId: string;
  startDate: string;
  endDate: string;
  days: WeekDaySummary[];
}

export interface TimelineEvent {
  time: string;
  title: string;
  content: string;
}

export interface CalendarDayDetail {
  date: string;
  diary?: string;
  timeline: TimelineEvent[];
  isFuture: boolean;
}

// ── Storage ──

const WEEK_PREFIX = 'phone_cal_week_';
const DAY_PREFIX = 'phone_cal_day_';
const MAX_RETRIES = 3;

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveJSON(key: string, data: any) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

function loadWeek(charId: string, weekId: string): CalendarWeekData | null {
  return loadJSON<CalendarWeekData>(WEEK_PREFIX + charId + '_' + weekId);
}

function saveWeek(charId: string, data: CalendarWeekData) {
  saveJSON(WEEK_PREFIX + charId + '_' + data.weekId, data);
}

function loadDayDetail(charId: string, date: string): CalendarDayDetail | null {
  return loadJSON<CalendarDayDetail>(DAY_PREFIX + charId + '_' + date);
}

function saveDayDetail(charId: string, data: CalendarDayDetail) {
  saveJSON(DAY_PREFIX + charId + '_' + data.date, data);
}

// ── Date Helpers ──

export function getMondayOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateShort(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

export function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function getDayOfWeekName(dateStr: string): string {
  return ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][new Date(dateStr + 'T12:00:00').getDay()];
}

export function isToday(dateStr: string): boolean {
  return dateStr === formatDate(new Date());
}

export function isFuture(dateStr: string): boolean {
  return dateStr > formatDate(new Date());
}

// ── Build Character Context ──

interface CharContext {
  name: string;
  personality: string;
  biography: string;
  relationship: string;
  affection: number;
  viewOnMe: string;
  experience: string;
  forceRequirements: string;
  worldContent: string;
  userNickname: string;
}

function buildCharContext(charId: string, char: { name: string; personality: string; biography?: string; relationship?: string; affection?: number }, callerName: string): CharContext {
  const store = useAppStore.getState();
  const charName = char.name;
  const activeWorldId = store.activeWorldSettingId;
  const activeWorld = store.worldSettings.find(w => w.id === activeWorldId) || store.worldSettings[0];
  const worldContent = activeWorld ? activeWorld.content : '';
  const worldCharCard = activeWorld?.characters.find(c => c.id === charId);

  return {
    name: charName,
    personality: worldCharCard?.personality || char.personality || '普通',
    biography: worldCharCard?.biography || char.biography || '',
    relationship: worldCharCard?.relationship || char.relationship || '朋友',
    affection: worldCharCard?.affection ?? char.affection ?? 50,
    viewOnMe: worldCharCard?.viewOnMe || '',
    experience: worldCharCard?.experience || '',
    forceRequirements: worldCharCard?.forceRequirements || '',
    worldContent,
    userNickname: worldCharCard?.userNickname || store.characters[charId]?.userNickname || callerName,
  };
}

function buildCharDescription(ctx: CharContext): string {
  const parts = [
    `角色名：${ctx.name}`,
    `性格：${ctx.personality}`,
  ];
  if (ctx.biography) parts.push(`背景：${ctx.biography}`);
  if (ctx.experience) parts.push(`经历：${ctx.experience}`);
  if (ctx.worldContent) parts.push(`世界观：${ctx.worldContent}`);
  if (ctx.forceRequirements) parts.push(`强制要求：${ctx.forceRequirements}`);
  return parts.join('\n');
}

function getWeekId(monday: Date): string {
  return 'W' + formatDate(monday);
}

// ── Week Generation ──

export function weekExists(charId: string, monday: Date): boolean {
  return loadWeek(charId, getWeekId(monday)) !== null;
}

export async function getOrGenerateWeek(
  charId: string,
  char: { name: string; personality: string; biography?: string; relationship?: string; affection?: number },
  callerName: string,
  monday: Date,
): Promise<CalendarWeekData> {
  const weekId = getWeekId(monday);
  const startDate = formatDate(monday);
  const endDate = formatDate(new Date(monday.getTime() + 6 * 86400000));

  const cached = loadWeek(charId, weekId);
  if (cached) return cached;

  const ctx = buildCharContext(charId, char, callerName);
  const charDesc = buildCharDescription(ctx);

  const prevMonday = new Date(monday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const prevWeek = loadWeek(charId, getWeekId(prevMonday));
  const prevWeekContext = prevWeek
    ? `上一周的情况（${prevWeek.startDate} - ${prevWeek.endDate}）：\n${prevWeek.days.map(d => `${d.date}：${d.summary}`).join('\n')}`
    : '没有上一周的数据（这是第一周）。';

  const store = useAppStore.getState();
  const memories = store.characterMemoryBank[charId] || [];
  const userMemories = memories
    .filter(m => m.content.includes(ctx.userNickname) || m.content.includes('用户') || m.tags?.includes('conversation'))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10)
    .map(m => `- ${m.summary || m.content.slice(0, 100)}`)
    .join('\n');

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    dates.push(formatDate(d));
  }

  const todayStr = formatDate(new Date());
  const pastDates = dates.filter(d => d <= todayStr);
  const futureDates = dates.filter(d => d > todayStr);

  const prompt = `${charDesc}

你和${ctx.userNickname}的关系：${ctx.relationship}，好感度：${ctx.affection}/100
${ctx.viewOnMe ? '对' + ctx.userNickname + '的看法：' + ctx.viewOnMe : ''}

${userMemories ? '【相关记忆（涉及' + ctx.userNickname + '）】\n' + userMemories + '\n' : ''}

【连续性上下文】
${prevWeekContext}

【任务】
请为 ${dates[0]} 至 ${dates[6]} 各生成一句话摘要（15-40字）。

注意日期分类：
- **过去/今天（${pastDates.join('、')}）**：生成已发生的事
- **未来（${futureDates.join('、')}）**：生成计划/待办/预约，不得写已发生的事

要求：
1. 连续7天，每一天必须与前一天逻辑连贯
2. 大约70%是角色独立生活，30%涉及${ctx.userNickname}
3. 内容符合角色性格、世界观
4. 第1天要考虑上一周最后一天的情况

以 JSON 数组输出，不要 markdown 代码块（纯JSON）：
[
  { "date": "${dates[0]}", "summary": "一句话摘要" },
  ...
]`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const text = await generateAIResponse(prompt);
      const json = text?.replace(/```json\n?|```\n?/g, '').trim();
      const arr = json ? JSON.parse(json) : null;
      if (Array.isArray(arr) && arr.length === 7) {
        const days: WeekDaySummary[] = arr.map((item: any) => ({
          date: item.date,
          summary: item.summary || '',
        }));
        const data: CalendarWeekData = { weekId, startDate, endDate, days };
        saveWeek(charId, data);
        return data;
      }
    } catch (e) {
      console.error(`Week generation attempt ${attempt + 1} failed:`, e);
    }
  }

  throw new Error('AI 生成周数据失败，请重试');
}

// ── Day Detail Generation ──

export function dayDetailExists(charId: string, date: string): boolean {
  return loadDayDetail(charId, date) !== null;
}

export async function getOrGenerateDayDetail(
  charId: string,
  char: { name: string; personality: string; biography?: string; relationship?: string; affection?: number },
  callerName: string,
  date: string,
  daySummary: string,
): Promise<CalendarDayDetail> {
  const cached = loadDayDetail(charId, date);
  if (cached) return cached;

  const isFutureDate = isFuture(date);
  const todayStr = formatDate(new Date());
  const ctx = buildCharContext(charId, char, callerName);
  const charDesc = buildCharDescription(ctx);

  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  const yesterdayStr = formatDate(d);
  const yesterdayDetail = loadDayDetail(charId, yesterdayStr);
  const yesterdayContext = yesterdayDetail
    ? `【昨天（${yesterdayStr}）的情况】\n日记：${yesterdayDetail.diary}\n日程：\n${yesterdayDetail.timeline.map(t => `- ${t.time} ${t.title}：${t.content}`).join('\n')}`
    : '没有昨天的数据。';

  const store = useAppStore.getState();
  const memories = store.characterMemoryBank[charId] || [];
  const userMemories = memories
    .filter(m => m.content.includes(ctx.userNickname) || m.content.includes('用户'))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 8)
    .map(m => `- ${m.summary || m.content.slice(0, 100)}`)
    .join('\n');

  let prompt: string;

  if (isFutureDate) {
    prompt = `${charDesc}

你和${ctx.userNickname}的关系：${ctx.relationship}，好感度：${ctx.affection}/100
${ctx.viewOnMe ? '对' + ctx.userNickname + '的看法：' + ctx.viewOnMe : ''}

${userMemories ? '【记忆】\n' + userMemories + '\n' : ''}

${yesterdayContext}

【任务】
现在请为 ${date}（${getDayOfWeekName(date)}）生成当日计划。

⚠️ 这是未来日期（${date} > 今天 ${todayStr}），还未发生。

计划 = 角色在什么时间打算做什么事。类似日历预约、待办事项、日程安排。
格式参考：
- "09:00" → "蝙蝠洞训练" → "和阿尔弗雷德约好了晨练。"
- "14:00" → "韦恩集团董事会" → "季度财报会议。"
- "20:00" → "夜巡" → "哥谭东区巡逻路线。"

禁止：
- 不要写日记体描述（如"窗外的天气比昨天好点"）
- 不要写情绪/感受
- 不要写已发生的事
- 不要写回忆

生成 3-6 条计划，每条有具体时间（HH:mm），用将来时或计划性语言。

以 JSON 格式输出，不要 markdown 代码块：
{
  "timeline": [
    { "time": "09:00", "title": "蝙蝠洞训练", "content": "和阿尔弗雷德约好了晨练。" }
  ]
}`;
  } else {
    prompt = `${charDesc}

你和${ctx.userNickname}的关系：${ctx.relationship}，好感度：${ctx.affection}/100
${ctx.viewOnMe ? '对' + ctx.userNickname + '的看法：' + ctx.viewOnMe : ''}

${userMemories ? '【涉及' + ctx.userNickname + '的记忆】\n' + userMemories + '\n' : ''}

${yesterdayContext}

【任务】
现在请为 ${date}（${getDayOfWeekName(date)}${date === todayStr ? '·今天' : ''}）生成日记和日程。

当天摘要：${daySummary}

请生成：
1. **日记**（100-300字，第一人称，像私人日记。语气符合角色性格，自然真实，有生活感。不要像新闻报道，不要第三人称叙述。）
2. **日程**（4-8条时间轴事件，必须有具体时间）

要求：
- 内容必须与昨天的事件逻辑连贯
- 大约70%是角色独立生活，30%可以涉及${ctx.userNickname}
- 如果涉及${ctx.userNickname}，必须基于记忆库中的真实记忆，不能编造不存在的互动
- 事件必须符合角色性格和世界观

以 JSON 格式输出，不要 markdown 代码块：
{
  "diary": "日记内容（第一人称）",
  "timeline": [
    { "time": "09:00", "title": "事件标题", "content": "简短描述" }
  ]
}`;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const text = await generateAIResponse(prompt);
      const json = text?.replace(/```json\n?|```\n?/g, '').trim();
      const data = json ? JSON.parse(json) : null;

      if (isFutureDate) {
        if (Array.isArray(data?.timeline) && data.timeline.length >= 3) {
          const detail: CalendarDayDetail = {
            date,
            isFuture: true,
            timeline: data.timeline.slice(0, 8).map((t: any) => ({
              time: t.time || '00:00',
              title: t.title || '',
              content: t.content || '',
            })),
          };
          saveDayDetail(charId, detail);
          return detail;
        }
      } else {
        if (data?.diary && Array.isArray(data?.timeline) && data.timeline.length >= 4) {
          const detail: CalendarDayDetail = {
            date,
            diary: data.diary,
            isFuture: false,
            timeline: data.timeline.slice(0, 8).map((t: any) => ({
              time: t.time || '00:00',
              title: t.title || '',
              content: t.content || '',
            })),
          };
          saveDayDetail(charId, detail);
          return detail;
        }
      }
    } catch (e) {
      console.error(`Day detail generation attempt ${attempt + 1} failed:`, e);
    }
  }

  throw new Error('AI 生成日程数据失败，请重试');
}

export function getDayDetail(charId: string, date: string): CalendarDayDetail | null {
  return loadDayDetail(charId, date);
}

export function getWeekData(charId: string, monday: Date): CalendarWeekData | null {
  return loadWeek(charId, getWeekId(monday));
}
