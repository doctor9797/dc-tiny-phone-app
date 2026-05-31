import { GoogleGenAI } from '@google/genai';
import { useAppStore } from '../store';
import { getTopMemoriesForPrompt, extractMemoryFromConversation, estimateSentiment, canGenerateDailyEvent, markDailyEventGenerated } from './characterMemory';
import { lookupEmotion } from './emotionDictionary';
import { getCurrentMood, buildMoodPrompt } from './moodLoop';
import { writeDecorationMoodToMemory } from './moodPool';

export function extractImageData(dataUrl: string): { mimeType: string; data: string } | null {
  try {
    const match = dataUrl.match(/^data:(image\/(\w+));base64,(.+)$/);
    if (match) return { mimeType: match[1], data: match[3] };
  } catch {}
  return null;
}

const cleanAiText = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, match => match.replace(/```/g, ''))
    .replace(/^[#*\-\s>]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[一-鿿\w]+[：:]\s*/gm, '')  // strip "Name: " prefix per line
    .replace(/^[（(][^）)]*[）)]\s*/gm, '')           // strip "(action)" prefix per line
    .replace(/^【[^】]*】\s*/gm, '')                  // strip "【action】" prefix per line
    .replace(/^[*]{1,2}[^*]*[*]{1,2}\s*/gm, '')      // strip *action* prefix per line
    .trim();

const normalizeForceRuleText = (value?: string) =>
  (value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');

const getCharacterCard = (characterId: string) => {
  const state = useAppStore.getState();
  return state.worldSettings.flatMap(setting => setting.characters).find(char => char.id === characterId) || null;
};

const isCharacterEnabled = (characterId: string) => {
  const state = useAppStore.getState();
  const character = state.characters[characterId];
  const card = getCharacterCard(characterId);
  if (!character) return false;
  if ((character as any).isDisabled === true) return false;
  if (card?.isEnabled === false) return false;
  return true;
};



export async function generateAIResponse(
  prompt: string,
  systemInstruction?: string,
  images?: { mimeType: string; data: string }[],
): Promise<string> {
  const settings = useAppStore.getState().settings;
  const apiKey = settings.apiKey || '';
  const modelName = settings.apiModel || 'gemini-2.5-flash';

  // Server proxy mode: no local key -> 走服务端代理（部署环境）
  if (!apiKey && !settings.apiBaseUrl && !images?.length) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName, prompt, systemInstruction }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return data.candidates[0].content.parts[0].text;
        }
        if (data.error) throw new Error(data.error);
      }
      const errText = await res.text().catch(() => '');
      throw new Error(errText || '代理请求失败 (' + res.status + ')');
    } catch (e: any) {
      throw new Error(e.message?.includes('配置') ? e.message : 'AI 服务未配置（请在设置中填入 API Key）');
    }
  }

  const isGeminiModel = modelName.toLowerCase().includes('gemini');
  const isDirectGoogle = settings.apiBaseUrl && (settings.apiBaseUrl.includes('generativelanguage') || settings.apiBaseUrl.includes('googleapis'));
  const forceOpenAI = (settings.apiBaseUrl && !isDirectGoogle) || !isGeminiModel;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    if (settings.apiBaseUrl && forceOpenAI) {
      let endpoint = settings.apiBaseUrl.trim();
      if (!endpoint.endsWith('/chat/completions') && !endpoint.endsWith('/completions')) {
         endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
      }

      const messages: any[] = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });

      if (images?.length) {
        const content: any[] = [{ type: 'text', text: prompt }];
        for (const img of images) {
          content.push({ type: 'image_url', image_url: { url: 'data:' + img.mimeType + ';base64,' + img.data } });
        }
        messages.push({ role: 'user', content });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey !== 'sk-local' ? 'Bearer ' + apiKey : ''
        },
        body: JSON.stringify({ model: modelName, messages }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errorData = await res.text();
        throw new Error('API 返回错误: ' + res.status + ' - ' + errorData);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }

    const ai = new GoogleGenAI({
      apiKey,
      ...(settings.apiBaseUrl ? { baseUrl: settings.apiBaseUrl.replace(/\/v1.*$/, '') } : {}),
    });

    const contents: any[] = [];
    if (images?.length) {
      contents.push({ text: prompt });
      for (const img of images) {
        contents.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }
    } else {
      contents.push(prompt);
    }

    const responsePromise = ai.models.generateContent({
      model: modelName,
      contents: contents.length === 1 && typeof contents[0] === 'string' ? contents[0] : contents,
      config: { systemInstruction },
    });

    const response = await Promise.race([
      responsePromise,
      new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error('API 请求超时，请检查您的网络或 API 代理设置。'));
        }, 60000);
      }),
    ]);

    clearTimeout(timeoutId);
    return (response as any).text || '';
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('API 请求超时，请检查您的网络或代理设置。');
    }
    if (error.message && error.message.includes('429') && error.message.includes('quota')) {
      throw new Error('API 额度已耗尽，请检查您的 API Key 计费状态或稍后再试。');
    }
    throw new Error(error.message || 'AI 请求失败');
  }
}

export async function getCharacterReply(
  characterId: string,
  userMessage: string,
  options?: number | { currentTime?: number; extraContext?: string; images?: { mimeType: string; data: string }[] }
): Promise<string> {
  let currentTime = Date.now();
  let extraContext = '';
  let images: { mimeType: string; data: string }[] | undefined;
  if (typeof options === 'number') {
    currentTime = options;
  } else if (options) {
    currentTime = options.currentTime || Date.now();
    extraContext = options.extraContext || '';
    images = options.images;
  }

  const state = useAppStore.getState();
  if (!isCharacterEnabled(characterId)) return '';

  // Phase 5: Mood Loop
  const currentMood = getCurrentMood(characterId);
  const moodPrompt = buildMoodPrompt(currentMood);

  const character = state.characters[characterId];
  const settings = state.settings;
  const relevantWorld = state.worldSettings.find(ws =>
    ws.characters.some(c => c.id === characterId)
  );
  const worldContext = relevantWorld
    ? relevantWorld.title + ': ' + relevantWorld.content
    : '';

  let card = null;
  for (const ws of state.worldSettings) {
    const found = ws.characters.find(c => c.id === characterId);
    if (found) { card = found; break; }
  }

  const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n) + '…' : s;
  const personality = trunc(card?.personality || character.personality || '', 200);
  const experience = trunc(card?.experience || character.experience || '', 200);
  const biography = trunc(card?.biography || character.biography || '', 300);
  const relationship = trunc(card?.relationship || character.relationship || '', 200);
  const viewOnMe = trunc(card?.viewOnMe || character.viewOnMe || '', 200);
  const characterForceRequirements = normalizeForceRuleText(card?.forceRequirements);
  const worldForceRequirements = relevantWorld
    ? normalizeForceRuleText(relevantWorld.baseCode)
    : '';
  const characterMemories = getTopMemoriesForPrompt(characterId, 300);
  const latestNewsIssue = (state.newsIssues || [])[0];
  const newsContext = latestNewsIssue
    ? '【新闻】' + latestNewsIssue.articles.slice(0, 2).map(a => a.title).join('、')
    : '';

  const timeOffsetMs = (settings.timeOffsetMinutes || 0) * 60 * 1000;
  const localCurrentTime = currentTime + timeOffsetMs;

  const history = state.chats[characterId] || [];

  // ── Compact system instruction ──
  const characterName = card?.name || character.name;
  const cardAffection = card?.affection ?? character.affection ?? 50;
  const cardNickname = card?.userNickname || character.userNickname || '你';
  const cardInteractionMode = card?.interactionMode || character.interactionMode || '';
  const sysParts: string[] = [
    '角色：' + characterName + '。',
  ];
  if (worldContext) sysParts.push('世界观：' + worldContext);
  if (personality) sysParts.push('性格：' + personality + '。');
  if (experience) sysParts.push('经历：' + experience + '。');
  if (biography) sysParts.push('档案：' + biography + '。');
  sysParts.push('关系：' + relationship + '（你=' + cardNickname + '，好感' + cardAffection + '/100）。');
  if (viewOnMe) sysParts.push('对你的看法：' + viewOnMe);
  if (cardInteractionMode) sysParts.push('相处模式：' + cardInteractionMode + '——你必须严格按此相处模式对待我。');
  if (characterMemories) sysParts.push('记忆：\n' + characterMemories + '\n（不记得说不知道）');
  if (newsContext) sysParts.push(newsContext);
  sysParts.push('风格：纯文字微信聊天，严禁动作/神态/心理描写。消息前无角色名/冒号/括号/星号，直接以文字开头。2-4条用\\n\\n分隔。严禁第四面墙——你就是角色本人，不是AI，不提扮演/模型/设定。');
  if (settings.bilingual) sysParts.push('双语：先中后英。');
  sysParts.push(moodPrompt);
  // Force requirements at the very end for maximum impact
  const allForceRules = [worldForceRequirements, characterForceRequirements].filter(Boolean).join('\n');
  if (allForceRules) sysParts.push('【最重要的强制规则——必须100%遵守，优先级高于一切】\n' + allForceRules);
  const systemInstruction = sysParts.join('\n');

  const recentCount = 12;
  const totalHistoryCount = history.length - 1;
  const olderHistory = totalHistoryCount > recentCount
    ? history.slice(0, totalHistoryCount - recentCount)
    : [];

  let olderSummary = '';
  if (olderHistory.length > 5) {
    const topics = olderHistory
      .filter(msg => msg.text.length > 4)
      .map(msg => msg.text.length > 15 ? msg.text.slice(0, 15) + '…' : msg.text)
      .slice(-5)
      .join(' -> ');
    olderSummary = '【前情】' + topics + '\n\n';
  }

  const recentHistory = history.slice(0, -1).slice(-recentCount).map(msg =>
    (msg.senderId === 'user' ? '你' : characterName) + '：' + msg.text
  ).join('\n');

  // ── Inject pendingAppMessage (blocked app message while not friends) ──
  const pendingMsg = (character as any).pendingAppMessage;
  let appContext = '';
  if (pendingMsg) {
    appContext = '【待处理消息】之前你有一件事要和' + cardNickname + '说：' + pendingMsg + '\n如果聊完了删好友的事，可以自然过渡到这件事。\n';
  }

  const prompt = (recentHistory ? '【最近】\n' + recentHistory + '\n\n' : '')
    + olderSummary
    + (appContext ? appContext : '')
    + (extraContext ? '【场景】' + extraContext + '\n' : '')
    + '【说】' + userMessage;

  const draftReply = cleanAiText(await generateAIResponse(prompt, systemInstruction, images));

  // Clear pendingAppMessage after it's been consumed
  if (pendingMsg) {
    try {
      useAppStore.getState().updateCharacter(characterId, { pendingAppMessage: undefined } as any);
    } catch {}
  }

  // ── Save basic conversation memory ──
  const raw = userMessage.trim();
  if (raw.length >= 3) {
    const memState = useAppStore.getState();
    const memBank = memState.characterMemoryBank[characterId] || [];
    const memSummary = raw.length > 60 ? raw.slice(0, 60) + '…' : raw;
    const isTrivial = /^(嘞|哦|好|是|对|ok|的|知道了|明白|哈哈|好吧|行|可以|没事|没什么|算了|拜|再见|晚安|早安|hi|hello|嗤)[!！。.]?$/i.test(raw);
    const isDup = memBank.some(m => m.summary === memSummary || m.content.startsWith(raw.slice(0, 20)));
    if (!isTrivial && !isDup) {
      memState.addCharacterMemory(characterId, {
        type: 'conversation',
        content: raw + '\n---\n' + draftReply,
        summary: memSummary,
        tags: [],
        valence: estimateSentiment(raw).valence,
        arousal: estimateSentiment(raw).arousal,
        importance: 3,
        layer: 'daily',
      });
    }
  }

  // Run scoring + AI extraction + daily event generation (non-blocking)
  (async () => {
    await scoreConversationEmotion(characterId, userMessage, draftReply).catch(() => {});
    await extractMemoryFromConversation(characterId, userMessage, draftReply).catch(() => {});
    // Generate today's AI-powered independent character events (3-5 per day)
    // These events have valence/arousal and affect the character's mood via PANAS.
    await generateDailyEvents(characterId).catch(() => {});
  })();

  if (!worldForceRequirements && !characterForceRequirements) {
    return draftReply;
  }

  const revisedReply = cleanAiText(await generateAIResponse(
    '你是严格的规则审核员。检查下面的回复是否违反了强制规则。如果有任何违反，必须彻底重写；如果完全合规，就原样输出。不要解释，只输出最终文本。\n\n【强制规则】\n' + (worldForceRequirements ? '世界书：' + worldForceRequirements + '\n' : '') + (characterForceRequirements ? '角色卡：' + characterForceRequirements + '\n' : '') + '\n【回复草稿】\n' + draftReply,
    '你是严格的规则审核机器人。只检查和修正回复，不添加解释。'
  ));

  const finalReply = revisedReply || draftReply;
  return finalReply;
}

// ── Phase 3: AI Emotion Scoring ──

const SCORE_SYSTEM_PROMPT = '你是一个严格的对话情感评分员。使用 PANAS 双轴模型评估对话对角色的情感影响。\n\n输出 JSON（不要其他内容）：\npa_delta (-0.3~0.5), na_delta (-0.3~0.5), valence (-1~1), arousal (0~1), word (情绪词), backup (3个备选), reason (一句话)';

interface AIEmotionScore {
  pa_delta: number;
  na_delta: number;
  valence: number;
  arousal: number;
  word: string;
  backup: string[];
  reason: string;
}

async function scoreConversationEmotion(
  characterId: string,
  userMessage: string,
  characterReply: string,
): Promise<void> {
  const state = useAppStore.getState();
  const char = state.characters[characterId];
  const charName = char?.name || characterId;

  try {
    const prompt = '评估对话对' + charName + '的情感影响。\n关系：' + (char?.relationship || '朋友') + '，好感' + (char?.affection ?? 50) + '/100，性格：' + (char?.personality || '') + '\n\n用户：' + userMessage + '\n' + charName + '：' + characterReply + '\n\n视角：' + charName + '。注意：用户纠正事实错误时，角色应尴尬而非生气（na≤0.15，arousal≤0.3）。啦娇可微正面，指责/争吵实评负面。';

    const raw = await generateAIResponse(prompt, SCORE_SYSTEM_PROMPT);
    const parsed: AIEmotionScore = JSON.parse(raw.replace(/```json|```/g, '').trim());

    const paDelta = Math.max(-0.3, Math.min(0.5, parsed.pa_delta ?? 0));
    const naDelta = Math.max(-0.3, Math.min(0.5, parsed.na_delta ?? 0));
    const aiValence = Math.max(-1, Math.min(1, parsed.valence ?? 0));
    const aiArousal = Math.max(0, Math.min(1, parsed.arousal ?? 0.5));
    const word = (parsed.word || '平静').trim();
    const backups = (parsed.backup || []).filter((b): b is string => typeof b === 'string').map(b => b.trim());

    const lookup = lookupEmotion(word, backups);

    const fusedValence = 0.7 * lookup.v + 0.3 * aiValence;
    const fusedArousal = 0.7 * lookup.a + 0.3 * aiArousal;

    state.addEmotionEvent({
      characterId,
      paDelta,
      naDelta,
      word: lookup.matchedWord,
      valence: fusedValence,
      arousal: fusedArousal,
      matchSource: lookup.matchSource,
      source: 'conversation',
    });

  } catch {
    // Silently fail
  }
}

export async function sendCharacterActivityFollowup(characterId: string, topicPrompt: string) {
  const state = useAppStore.getState();
  if (!isCharacterEnabled(characterId)) return;
  const char = state.characters[characterId];
  if (!char) return;

  state.addActivityLog({
    id: Date.now().toString() + '_' + Math.random(),
    title: topicPrompt.replace(/请你.*$/, '').replace(/[。！!？?]/g, '').slice(0, 28).trim() || '最近活动',
    detail: topicPrompt.slice(0, 140),
    timestamp: Date.now(),
    relatedCharacterIds: [characterId]
  });

  const sysMsg = `你是${char.name}。性格：${char.personality || '普通'}。和对方的关系：${char.relationship || '朋友'}（对方=${char.userNickname || '你'}，好感度${char.affection ?? 50}/100）。严禁动作描写、神态描写、心理描写。只说一句话，不加括号、引号、星号。直接以文字开头。`;

  try {
    const reply = cleanAiText(await generateAIResponse(topicPrompt, sysMsg));
    if (reply) {
      useAppStore.getState().receiveMessage(characterId, reply);
    }
  } catch {
    // ignore follow-up failures
  }
}

export async function textToSpeech(text: string, voiceId?: string): Promise<string> {
  const settings = useAppStore.getState().settings;
  const cfg = settings.voiceApiConfigs?.[0];
  const groupId = cfg?.groupId || '';
  const apiKey = cfg?.apiKey || '';
  const baseUrl = cfg?.baseUrl || '';
  const model = cfg?.ttsModel || 'speech-02';
  const defaultVoiceId = cfg?.voiceId || 'female-shaonv';

  if (!groupId || !apiKey || !baseUrl) {
    throw new Error('语音API未配置');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    let endpoint = baseUrl.trim();
    if (!endpoint.endsWith('/text_to_speech')) {
      endpoint = endpoint.replace(/\/$/, '') + '/text_to_speech';
    }
    endpoint = endpoint + '?GroupId=' + groupId;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model,
        text,
        voice_id: voiceId || defaultVoiceId
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.text();
      throw new Error('语音生成失败: ' + res.status + ' - ' + errorData);
    }

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('语音生成请求超时');
    }
    throw new Error(error.message || '语音生成失败');
  }
}

export async function translateText(text: string, targetLang: string = '中文'): Promise<string> {
  try {
    const prompt = '请将以下内容翻译成' + targetLang + '，只输出翻译结果：\n\n' + text;
    return await generateAIResponse(prompt);
  } catch {
    return text;
  }
}

export async function speechToText(audioBlob: Blob, language?: string): Promise<string> {
  const settings = useAppStore.getState().settings;
  const cfg = settings.voiceApiConfigs?.[0];
  const apiKey = cfg?.apiKey || '';
  const baseUrl = cfg?.baseUrl || '';
  const model = cfg?.sttModel || 'whisper-1';

  if (!apiKey || !baseUrl) {
    throw new Error('语音API未配置');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    let endpoint = baseUrl.trim();
    if (!endpoint.endsWith('/audio/transcriptions')) {
      endpoint = endpoint.replace(/\/$/, '') + '/audio/transcriptions';
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', model);
    formData.append('response_format', 'json');
    if (language) formData.append('language', language);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.text();
      throw new Error('语音识别失败: ' + res.status + ' - ' + errorData);
    }

    const data = await res.json();
    return data.text || '';
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('语音识别请求超时');
    }
    throw new Error(error.message || '语音识别失败');
  }
}

export async function generateCharacterMoment(characterId: string): Promise<{ content: string; imageUrl?: string; location?: string }> {
  const state = useAppStore.getState();
  const character = state.characters[characterId];
  const card = getCharacterCard(characterId);
  const settings = state.settings;

  if (!character || !card) {
    throw new Error('角色不存在');
  }

  const prompt = '你现在扮演角色：' + character.name + '。性格：' + (card.personality || character.personality) + '。经历：' + (card.experience || '') + '。关系：' + (card.relationship || character.relationship) + '。\n\n请以' + character.name + '的身份发一条朋友圈，内容符合性格和当前时间，1-3句话，可选地址。\n\n格式：\n内容：[...]\n位置：[...]';

  try {
    const response = await generateAIResponse(prompt);
    const lines = response.split('\n').filter(l => l.trim());
    let content = '';
    let location = '';

    for (const line of lines) {
      if (line.startsWith('内容：') || line.startsWith('内容:')) {
        content = line.replace(/^内容[：:]/, '').trim();
      } else if (line.startsWith('位置：') || line.startsWith('位置:')) {
        location = line.replace(/^位置[：:]/, '').trim();
      }
    }

    if (!content) {
      content = response.trim();
    }

    return { content, location: location || undefined };
  } catch (error) {
    throw new Error('生成朋友圈失败');
  }
}

export async function generateMomentReply(characterId: string, momentContent: string, commentText: string): Promise<string> {
  const state = useAppStore.getState();
  const character = state.characters[characterId];
  const card = getCharacterCard(characterId);

  if (!character || !card) {
    throw new Error('角色不存在');
  }

  const prompt = '角色：' + character.name + '，性格：' + (card.personality || character.personality) + '，关系：' + (card.relationship || character.relationship) + '。\n\n你发了朋友圈：' + momentContent + '\n' + '用户评论：' + commentText + '\n\n请以角色身份回复这条评论，符合性格，简短自然，只输出回复内容。';

  try {
    const response = await generateAIResponse(prompt);
    return response.trim();
  } catch (error) {
    throw new Error('生成回复失败');
  }
}

// ── AI-Powered Daily Event Generation ──
// Replaces the old hardcoded MOOD_POOLS with dynamically generated events.
// Each character gets 3-5 unique events per day that match their personality
// and life situation. Events have valence/arousal coordinates that feed into
// the PANAS mood system.

interface DailyEvent {
  word: string;        // event description, e.g. "在天台上吹风" / "破获一起毒品交易"
  feelingWord: string; // emotional response, e.g. "放松" / "愤怒"
  valence: number;     // 0~1, how positive/negative
  arousal: number;     // 0~1, how intense
}

export async function generateDailyEvents(characterId: string): Promise<void> {
  const state = useAppStore.getState();
  const character = state.characters[characterId];
  if (!character) return;

  // 每次只生成一条，随机间隔分散到一天中
  if (!canGenerateDailyEvent(characterId)) return;

  // Get richer character info from world settings (may contain biography)
  const card = getCharacterCard(characterId);
  const fullBio = card?.biography || character.biography || '';
  const fullExp = card?.experience || character.experience || '';
  const fullPersonality = card?.personality || character.personality || '';

  const charPrompt = `角色：${character.name}
设定概要：${fullBio || '无'}
性格：${fullPersonality || '普通'}
经历：${fullExp || '无'}
身份：${character.relationship || '朋友'}
好感度：${character.affection ?? 50}/100

生成一条该角色今天正在做的日常活动。

要求：
- 必须是一句话：角色正在做什么，以及当前感受（如"在蝙蝠洞训练，出了一身汗"）
- 要符合角色性格和身份
- 不要和已经生成过的重复
- 返回 JSON 格式：{"word":"在做什么","feelingWord":"当前感受","valence":0~1,"arousal":0~1}`;

  try {
    const raw = await generateAIResponse(charPrompt);
    const ev: DailyEvent = JSON.parse(raw.replace(/```json|```/g, '').trim());

    if (!ev || !ev.word) return;

    const valence = Math.max(0, Math.min(1, ev.valence ?? 0.5));
    const arousal = Math.max(0, Math.min(1, ev.arousal ?? 0.3));
    writeDecorationMoodToMemory(
      characterId,
      ev.word || '度过了普通的一天',
      ev.feelingWord || '平静',
      valence,
      arousal,
    );

    // 记录本次生成时间，用于随机间隔
    markDailyEventGenerated(characterId);
  } catch {
    // AI failed — silently skip, will retry on next interaction
  }
}
