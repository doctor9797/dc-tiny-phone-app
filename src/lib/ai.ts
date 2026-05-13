import { GoogleGenAI } from '@google/genai';
import { useAppStore } from '../store';
import { getTopMemoriesForPrompt, extractMemoryFromConversation } from './characterMemory';
import { writeDecorationMoodToMemory } from './moodPool';
import { lookupEmotion } from './emotionDictionary';
import { getCurrentMood, buildMoodPrompt } from './moodLoop';

const cleanAiText = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, match => match.replace(/```/g, ''))
    .replace(/^[#*\-\s>]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
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

  // Server proxy mode: no local key → 走服务端代理（部署环境）
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
      throw new Error(errText || `代理请求失败 (${res.status})`);
    } catch (e: any) {
      throw new Error(e.message?.includes('配置') ? e.message : `AI 服务未配置（请在设置中填入 API Key）`);
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
         endpoint = `${endpoint.replace(/\/$/, '')}/chat/completions`;
      }

      const messages: any[] = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });

      if (images?.length) {
        const content: any[] = [{ type: 'text', text: prompt }];
        for (const img of images) {
          content.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
        }
        messages.push({ role: 'user', content });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey !== 'sk-local' ? `Bearer ${apiKey}` : ''
        },
        body: JSON.stringify({ model: modelName, messages }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`API 返回错误: ${res.status} - ${errorData}`);
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

  // Write today's decoration mood to ambient memory (first interaction of the day)
  writeDecorationMoodToMemory(characterId);

  // Phase 5: Mood Loop — compute current emotional state and build mood prompt
  const currentMood = getCurrentMood(characterId);
  const moodPrompt = buildMoodPrompt(currentMood);

  const character = state.characters[characterId];
  const settings = state.settings;
  // 只取包含当前角色的那条世界书，避免其他世界书的干扰
  const relevantWorld = state.worldSettings.find(ws =>
    ws.characters.some(c => c.id === characterId)
  );
  const worldContext = relevantWorld
    ? `${relevantWorld.title}: ${relevantWorld.content}`
    : 'DC宇宙';
  const persona = `${settings.persona.name},${settings.persona.age}岁,${settings.persona.profession},${settings.persona.identity}`;
  
  // Look up character in WorldBook for settings
  let card = null;
  for (const ws of state.worldSettings) {
    const found = ws.characters.find(c => c.id === characterId);
    if (found) { card = found; break; }
  }

  const personality = card?.personality || character.personality || '';
  const experience = card?.experience || '';
  const relationship = card?.relationship || character.relationship || '';
  const viewOnMe = card?.viewOnMe || '';
  const characterForceRequirements = normalizeForceRuleText(card?.forceRequirements);
  // 只取当前角色所在世界书的 baseCode，避免其他世界书的干扰
  const worldForceRequirements = relevantWorld
    ? normalizeForceRuleText(relevantWorld.baseCode)
    : '';
  const characterMemories = getTopMemoriesForPrompt(characterId, 250);
  const latestNewsIssue = (state.newsIssues || [])[0];
  const newsContext = latestNewsIssue
    ? `[新闻] 最新报道：${latestNewsIssue.articles.slice(0, 2).map(a => a.title).join('、')}`
    : '';

  // Apply timezone offset and get accurate local time
  const timeOffsetMs = (settings.timeOffsetMinutes || 0) * 60 * 1000;
  const localCurrentTime = currentTime + timeOffsetMs;
  const now = new Date(localCurrentTime);
  
  // Format time clearly for AI
  const formattedTime = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  
  // Calculate time period description
  const hour = now.getHours();
  let timePeriod = '';
  if (hour >= 5 && hour < 12) timePeriod = '早晨/上午';
  else if (hour >= 12 && hour < 14) timePeriod = '中午';
  else if (hour >= 14 && hour < 18) timePeriod = '下午';
  else if (hour >= 18 && hour < 22) timePeriod = '晚上';
  else if (hour >= 22 || hour < 5) timePeriod = '深夜/凌晨';

  // Calculate time gap (approximate)
  const history = state.chats[characterId] || [];
  let timeContext = '';
  if (history.length > 0) {
    const lastMsg = history[history.length - 1];
    const gapMs = localCurrentTime - lastMsg.timestamp;
    const gapMinutes = Math.floor(gapMs / (1000 * 60));
    const gapHours = Math.floor(gapMinutes / 60);
    
    if (gapMinutes > 1) {
      if (gapMinutes < 60) {
        timeContext = `距离上次聊天已经过去了 ${gapMinutes} 分钟。现在是 ${formattedTime}，属于${timePeriod}。`;
      } else if (gapHours < 24) {
        timeContext = `距离上次聊天已经过去了 ${gapHours} 小时。现在是 ${formattedTime}，属于${timePeriod}。`;
      } else {
        const gapDays = Math.floor(gapHours / 24);
        timeContext = `距离上次聊天已经过去了 ${gapDays} 天。现在是 ${formattedTime}，属于${timePeriod}。`;
      }
    } else {
      timeContext = `现在是 ${formattedTime}，属于${timePeriod}。`;
    }
  } else {
    timeContext = `现在是 ${formattedTime}，属于${timePeriod}。`;
  }


  // 使用世界书中该角色的设定（如果有的话），否则用默认角色数据
  const characterName = card?.name || character.name;
  const systemInstruction = `你现在扮演角色：${characterName}。

【世界观】${worldContext}
【我】${persona}

【角色设定】：
- 性格：${personality}
- 个人经历：${experience}
- 与【我】的关系：${relationship}
- 你对【我】的看法：${viewOnMe}
- 你对【我】的称呼：${character.userNickname || '你'}

${characterMemories ? "【记忆】：\n" + characterMemories + "\n" : ""}
${newsContext}

⚠️ 禁止编造过去。不知道就说不知道，只回应当前消息，不要虚构。

【规则】
- 像真人微信聊天，禁止括号/星号等动作描写
- 发2-4条短消息，用\n\n分隔
- 转账：[转账] ¥金额 - 说明
- 礼物：[礼物] 礼物名称
- 当前${timePeriod}，问候必须匹配时间段：
      早5-12:早上好 中午12-14:中午好 下午14-18:下午好 晚上18-22:晚上好 深夜22-5:这么晚了
${settings.bilingual ? '必须双语：第一行中文，第二行英文。' : ''}

${moodPrompt}

${worldForceRequirements ? `【强制】${worldForceRequirements}` : ''}
${characterForceRequirements ? `【强制】${characterForceRequirements}` : ''}
${worldForceRequirements || characterForceRequirements ? '输出前检查以上强制，冲突则重写。' : ''}`;

  const recentHistory = history.slice(-1).map(msg =>
    `${msg.senderId === 'user' ? settings.persona.name : character.name}: ${msg.text}`
  ).join('\n');

  const prompt = `[上一条]${recentHistory}\n${extraContext ? `[场景]${extraContext}\n` : ''}[消息]${userMessage}`;

  const draftReply = cleanAiText(await generateAIResponse(prompt, systemInstruction, images));

  if (!worldForceRequirements && !characterForceRequirements) {
    return draftReply;
  }

  const revisedReply = cleanAiText(await generateAIResponse(
    `你是严格的规则审核员。检查下面的回复是否违反了强制规则。如果有任何违反，必须彻底重写；如果完全合规，就原样输出。不要解释，只输出最终文本。

【强制规则（必须逐条遵守，违者重写）】
${worldForceRequirements ? `【世界书底层代码】\n${worldForceRequirements}\n` : ''}
${characterForceRequirements ? `【角色卡强制要求】\n${characterForceRequirements}\n` : ''}

【原始回复草稿】
${draftReply}`,
    `你是一个严格的规则审核机器人。你唯一的任务就是检查并修正回复。不要添加任何解释、标记或额外内容。`
  ));

  const finalReply = revisedReply || draftReply;

  // Fire-and-forget memory extraction
  extractMemoryFromConversation(characterId, userMessage, finalReply).catch(() => {});

  // Fire-and-forget AI emotion scoring (Phase 3)
  scoreConversationEmotion(characterId, userMessage, finalReply).catch(() => {});

  return finalReply;
}

// ── Phase 3: AI Emotion Scoring ──
// AI selects the emotion word, dictionary provides the V/A coordinates.
// Fusion: 70% dictionary + 30% AI self-assessment.
// Anti-sycophancy: strict prompt requiring honest scoring.

const SCORE_SYSTEM_PROMPT = `你是一个严格的对话情感评分员。你的任务是从角色的视角评估一段对话带来的情感变化。

规则（必须严格遵守）：
1. 使用 PANAS 双轴模型：PA（正向情感）和 NA（负向情感）是两个独立维度
2. 冷场就是冷场（PA低、NA低），敷衍就是敷衍（PA低），不要美化
3. 禁止正面偏移 —— 不是每段对话都让人开心，请诚实评分
4. 输出必须是 JSON 格式，不要任何其他内容

输出 JSON 字段：
- pa_delta: 正向情感变化 (-0.3 ~ 0.5)，对话让角色感觉越好值越大
- na_delta: 负向情感变化 (-0.3 ~ 0.5)，对话让角色越不安/难过值越大
- valence: AI自评情感效价 (-1 ~ 1)，负=负面 正=正面
- arousal: AI自评唤醒度 (0 ~ 1)，0=平静 1=强烈
- word: 最贴切的情绪词（1-2个中文字）
- backup: 另外3个备选情绪词（用于词典匹配兜底）
- reason: 评分理由（一句话）`;

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
  const charName = state.characters[characterId]?.name || characterId;

  try {
    const prompt = `评估以下对话对${charName}的情感影响。

用户说：${userMessage}
${charName}回复：${characterReply}

请从${charName}的视角评估。`;

    const raw = await generateAIResponse(prompt, SCORE_SYSTEM_PROMPT);
    const parsed: AIEmotionScore = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // Sanitize
    const paDelta = Math.max(-0.3, Math.min(0.5, parsed.pa_delta ?? 0));
    const naDelta = Math.max(-0.3, Math.min(0.5, parsed.na_delta ?? 0));
    const aiValence = Math.max(-1, Math.min(1, parsed.valence ?? 0));
    const aiArousal = Math.max(0, Math.min(1, parsed.arousal ?? 0.5));
    const word = (parsed.word || '平静').trim();
    const backups = (parsed.backup || []).filter((b): b is string => typeof b === 'string').map(b => b.trim());

    // Look up dictionary V/A (multi-layer: word → backups → substring → free_form)
    const lookup = lookupEmotion(word, backups);

    // Fusion: 70% dictionary anchors the direction, 30% AI provides scene variation
    const fusedValence = 0.7 * lookup.v + 0.3 * aiValence;
    const fusedArousal = 0.7 * lookup.a + 0.3 * aiArousal;

    // Record emotion event
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

    // Affection update: 0.6 × (pa - na) + 0.4 × dictionary V
    const affectionChange = 0.6 * (paDelta - naDelta) + 0.4 * lookup.v;
    const currentAffection = state.characters[characterId]?.affection ?? 50;
    const newAffection = Math.max(0, Math.min(100, currentAffection + affectionChange * 10));
    state.updateCharacter(characterId, { affection: Math.round(newAffection) });

  } catch {
    // Silently fail — scoring is non-critical
  }
}

export async function sendCharacterActivityFollowup(characterId: string, topicPrompt: string) {
  const state = useAppStore.getState();
  if (!isCharacterEnabled(characterId)) return;
  const char = state.characters[characterId];
  if (!char) return;

  state.addActivityLog({
    id: `${Date.now()}_${Math.random()}`,
    title: topicPrompt.replace(/请你.*$/, '').replace(/[。！!？?]/g, '').slice(0, 28).trim() || '最近活动',
    detail: topicPrompt.slice(0, 140),
    timestamp: Date.now(),
    relatedCharacterIds: [characterId]
  });

  const prompt = `${topicPrompt}
请你以 ${char.name} 的身份，给我发一条简短自然的微信消息，内容要和刚才的事情直接相关，像刚结束事情后主动来找我说话。不要使用括号、星号或 Markdown。`;

  try {
    const reply = cleanAiText(await getCharacterReply(characterId, prompt));
    if (reply) {
      useAppStore.getState().receiveMessage(characterId, reply);
    }
  } catch {
    // ignore follow-up failures
  }
}

export async function textToSpeech(text: string, voiceId?: string): Promise<string> {
  const settings = useAppStore.getState().settings;
  const groupId = settings.voiceApiGroupId;
  const apiKey = settings.voiceApiKey;
  const baseUrl = settings.voiceApiBaseUrl;
  const model = settings.voiceTtsModel || 'speech-02';
  const defaultVoiceId = settings.voiceApiVoiceId || 'female-shaonv';

  if (!groupId || !apiKey || !baseUrl) {
    throw new Error('语音API未配置');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    let endpoint = baseUrl.trim();
    if (!endpoint.endsWith('/text_to_speech')) {
      endpoint = `${endpoint.replace(/\/$/, '')}/text_to_speech`;
    }
    // Add GroupId to URL
    endpoint = `${endpoint}?GroupId=${groupId}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
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
      throw new Error(`语音生成失败: ${res.status} - ${errorData}`);
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

export async function translateText(text: string, targetLang = '中文'): Promise<string> {
  try {
    const prompt = `请将以下内容翻译成${targetLang}，只输出翻译结果，不要解释：\n\n${text}`;
    return await generateAIResponse(prompt);
  } catch {
    return text;
  }
}

export async function speechToText(audioBlob: Blob, language?: string): Promise<string> {
  const settings = useAppStore.getState().settings;
  const apiKey = settings.voiceApiKey;
  const baseUrl = settings.voiceApiBaseUrl;
  const model = settings.voiceSttModel || 'whisper-1';

  if (!apiKey || !baseUrl) {
    throw new Error('语音API未配置');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    let endpoint = baseUrl.trim();
    if (!endpoint.endsWith('/audio/transcriptions')) {
      endpoint = `${endpoint.replace(/\/$/, '')}/audio/transcriptions`;
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', model);
    formData.append('response_format', 'json');
    if (language) formData.append('language', language);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorData = await res.text();
      throw new Error(`语音识别失败: ${res.status} - ${errorData}`);
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

  const now = new Date();
  const formattedTime = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const prompt = `你现在扮演角色：${character.name}。
你的性格：${card.personality || character.personality}
你的经历：${card.experience || ''}
你与用户的关系：${card.relationship || character.relationship}
当前时间：${formattedTime}

请以${character.name}的身份发一条朋友圈。要求：
1. 内容要符合角色的性格和当前时间
2. 可以是日常生活、心情、美食、风景、感悟等
3. 内容要自然真实，像真人发的朋友圈
4. 不要太长，1-3句话即可
5. 可以选择性地添加一个位置（比如：咖啡厅、公园、家里、公司等）

请直接输出朋友圈内容，格式如下：
内容：[你的朋友圈内容]
位置：[可选的位置]`;

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

  const prompt = `你现在扮演角色：${character.name}。
你的性格：${card.personality || character.personality}
你与用户的关系：${card.relationship || character.relationship}

你发了一条朋友圈：${momentContent}

用户评论了你的朋友圈：${commentText}

请以${character.name}的身份回复这条评论。要求：
1. 回复要符合角色性格
2. 简短自然，像真人回复朋友圈评论
3. 只输出回复内容，不要其他内容`;

  try {
    const response = await generateAIResponse(prompt);
    return response.trim();
  } catch (error) {
    throw new Error('生成回复失败');
  }
}
