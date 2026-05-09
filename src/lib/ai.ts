import { GoogleGenAI } from '@google/genai';
import { useAppStore } from '../store';

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

export const updateWorldCharacterCard = (characterId: string, updates: Record<string, any>) => {
  const state = useAppStore.getState();
  for (const setting of state.worldSettings) {
    const found = setting.characters.find(char => char.id === characterId);
    if (found) {
      state.updateWorldSetting(setting.id, {
        characters: setting.characters.map(char => char.id === characterId ? { ...char, ...updates } : char)
      });
      break;
    }
  }
};

const compactChatLines = (messages: any[], state: ReturnType<typeof useAppStore.getState>) =>
  messages
    .map(msg => `${msg.senderId === 'user' ? '我' : state.characters[msg.senderId]?.name || msg.senderId}:${(msg.text || '').replace(/\s+/g, ' ').slice(0, 36)}`)
    .join('\n');

export async function refreshCharacterMemoryDigest(characterId: string, options?: { force?: boolean }) {
  const state = useAppStore.getState();
  const history = state.chats[characterId] || [];
  const card = state.worldSettings.flatMap(setting => setting.characters).find(char => char.id === characterId);
  const memoryRounds = Math.max(2, Math.min(20, card?.memoryRounds || 8));
  const olderMessages = history.slice(0, Math.max(0, history.length - memoryRounds));
  const recentMessages = history.slice(-memoryRounds);
  const weeklyLogs = (state.activityLogs || [])
    .filter(log => log.timestamp >= Date.now() - 7 * 24 * 60 * 60 * 1000)
    .filter(log => !log.relatedCharacterIds || log.relatedCharacterIds.includes(characterId))
    .slice(0, 12);

  const groupChatMessages = Object.values(state.wechatGroups || {}).flatMap(group => {
    if (!group.members.includes(characterId)) return [];
    return group.messages.map(msg => ({
      ...msg,
      groupName: group.name
    }));
  }).sort((a, b) => b.timestamp - a.timestamp).slice(0, memoryRounds * 2);

  const userMoments = (state.moments || []).filter(m => m.authorId === 'user').slice(-6);

  const shouldRefreshSummary = options?.force
    ? true
    : olderMessages.length >= Math.max(6, memoryRounds) &&
      (!card?.memorySummary || history.length - (card.memoryDigestMessageCount || 0) >= memoryRounds);

  const shouldRefreshWeekly = options?.force
    ? true
    : (recentMessages.length >= Math.max(4, Math.min(memoryRounds, 6)) || weeklyLogs.length > 0 || groupChatMessages.length > 0) &&
      (!card?.weeklyActivitySummary || history.length - (card.weeklyDigestMessageCount || 0) >= memoryRounds);

  if (!shouldRefreshSummary && !shouldRefreshWeekly) return;

  const updates: Record<string, any> = {};

  if (shouldRefreshSummary) {
    const privateChatHistory = compactChatLines(olderMessages.slice(-16), state);
    const groupChatHistory = groupChatMessages.slice(-12).map(msg => {
      const senderName = msg.senderId === 'user' ? '我' : state.characters[msg.senderId]?.name || msg.senderId;
      return `${msg.groupName}[${senderName}]:${(msg.text || '').replace(/\s+/g, ' ').slice(0, 36)}`;
    }).join('\n');
    
    const momentsHistory = userMoments.map(m => `朋友圈:${(m.content || '').replace(/\s+/g, ' ').slice(0, 48)}`).join('\n');
    
    const compactHistory = [privateChatHistory, groupChatHistory, momentsHistory].filter(Boolean).join('\n');
    
    if (!compactHistory) {
      updates.memorySummary = '';
      updates.memoryUpdatedAt = undefined;
    } else {
      try {
        updates.memorySummary = cleanAiText(await generateAIResponse(`请把以下长期聊天记录、群聊内容和朋友圈动态压缩成90字以内的长期记忆摘要，只保留关系变化、反复提到的偏好和重要事件，不要分点，不要Markdown。\n${compactHistory}`));
      } catch {
        updates.memorySummary = compactHistory.slice(-90);
      }
      updates.memoryUpdatedAt = Date.now();
    }
    updates.memoryDigestMessageCount = history.length;
  }

  if (shouldRefreshWeekly) {
    const recentChatDigest = compactChatLines(recentMessages.slice(-8), state);
    const groupChatDigest = groupChatMessages.slice(-6).map(msg => {
      const senderName = msg.senderId === 'user' ? '我' : state.characters[msg.senderId]?.name || msg.senderId;
      return `${msg.groupName}[${senderName}]:${(msg.text || '').replace(/\s+/g, ' ').slice(0, 36)}`;
    }).join('\n');
    const momentsDigest = userMoments.map(m => `朋友圈:${(m.content || '').replace(/\s+/g, ' ').slice(0, 36)}`).join('\n');
    const weeklyLogDigest = weeklyLogs
      .slice(0, 10)
      .map(log => `${new Date(log.timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}${log.title}：${log.detail.slice(0, 24)}`)
      .join('\n');

    const allContent = [recentChatDigest, groupChatDigest, momentsDigest, weeklyLogDigest].filter(Boolean);
    
    if (allContent.length === 0) {
      updates.weeklyActivitySummary = '';
    } else {
      try {
        updates.weeklyActivitySummary = cleanAiText(await generateAIResponse(`请把以下“最近一周互动”、“群聊内容”、“朋友圈动态”和“最近几轮聊天”压缩成70字以内的近期记忆摘要，只保留最近的共同话题、近况和正在延续的情绪，不要分点，不要Markdown。\n最近聊天：\n${recentChatDigest || '暂无'}\n群聊内容：\n${groupChatDigest || '暂无'}\n朋友圈动态：\n${momentsDigest || '暂无'}\n最近一周活动：\n${weeklyLogDigest || '暂无'}`));
      } catch {
        updates.weeklyActivitySummary = allContent.join('；').slice(0, 70);
      }
    }
    updates.weeklyDigestMessageCount = history.length;
  }

  if (Object.keys(updates).length === 0) return;
  updateWorldCharacterCard(characterId, updates);
}

export async function generateAIResponse(
  prompt: string,
  systemInstruction?: string,
  images?: { mimeType: string; data: string }[],
): Promise<string> {
  const settings = useAppStore.getState().settings;
  const apiKey = settings.apiKey || process.env.GEMINI_API_KEY || 'sk-local';

  const modelName = settings.apiModel || 'gemini-2.5-flash';
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
  const character = state.characters[characterId];
  const settings = state.settings;
  const worldSettings = state.worldSettings.map(ws => `${ws.title}: ${ws.content}\n${ws.baseCode ? `[底层代码/强制执行]: ${ws.baseCode}` : ''}`).join('\n\n');
  const persona = `姓名: ${settings.persona.name}, 年龄: ${settings.persona.age}, 职业: ${settings.persona.profession}, 身份: ${settings.persona.identity}, 外貌: ${settings.persona.appearance}, 经历: ${settings.persona.experience}`;
  
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
  const worldForceRequirements = state.worldSettings
    .map(ws => normalizeForceRuleText(ws.baseCode))
    .filter(Boolean)
    .join('\n');
  const memoryRounds = Math.max(2, Math.min(20, card?.memoryRounds || 8));
  const memorySummary = card?.memorySummary || '';
  const weeklyActivitySummary = card?.weeklyActivitySummary || '';
  const latestNewsIssue = (state.newsIssues || [])[0];
  const newsContext = latestNewsIssue
    ? `你记得最近一期报纸日期是 ${latestNewsIssue.date}，主题是 ${latestNewsIssue.category}。其中几篇报道包括：${latestNewsIssue.articles.slice(0, 4).map(article => `${article.title}：${article.content}`).join('；')}。如果我聊到新闻、报道、日报或某篇新闻内容，你应该基于这些报道来回应，而不是装作不知道。`
    : '目前没有可参考的报纸报道。';

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

  refreshCharacterMemoryDigest(characterId).catch(() => {});

  const systemInstruction = `你现在扮演角色：${character.name}。
世界观设定：
${worldSettings}

与你对话的【我】（用户）设定：
${persona}

你的性格和个人经历：${personality}。 ${experience}
你与【我】的关系：${relationship}
你对【我】的看法：${viewOnMe}
你对【我】的称呼：${character.userNickname || '你'}
你保留的长期记忆摘要：${memorySummary || '暂无'}
你对最近一周共同活动的精简记忆：${weeklyActivitySummary || '暂无'}
${newsContext}

【核心强制规则】：
1. 像真实活人一样在微信里交流。禁止使用括号或星号等任何动作描写、神态描写心理描写或旁白段落！（例如绝对不要出现"(微笑)"、"*叹气*"或"（揉揉你的头）"之类的描述，也不要出现描述动作的句子）。
2. 禁止说话油腻，禁止使用霸总语录或俗套撩人话术，自然交流。
3. 【禁止胡编乱造】：你只能基于你已知的记忆和世界观设定来回答。如果用户问到你不知道的事情，你必须诚实地说"我不清楚"或"这个我不记得了"，绝对不能编造、猜测或联想你不知道的信息。例如：用户问你TA叫什么名字，你只能从我给你的角色设定和聊天记忆中回答，不能自己编造。
4. 请尽可能贴近真人的微信聊天习惯。优先发送 2 到 4 条短消息，每条尽量短、像真人微信碎碎念，而不是发一整段长文，多条消息之间必须用连续的两个换行符 "\\n\\n" 分隔。（注意不能超过4条）
5. 如果你想给【我】发微信转账，请发送独立的一条长这样的格式的消息：[转账] ¥金额 - 说明 （比如：[转账] ¥520 - 节日快乐）。
6. 如果你想送【我】微信礼物，请发送独立的一条消息：[礼物] 礼物名称 （比如：[礼物] 迪奥口红）。
7. 【重要时间感知规则】：时间是 ${formattedTime}，属于${timePeriod}。你必须严格根据这个时间来说话！
   - 早上5点到12点之间：只能说"早上好"、"上午好"、"早"等，不能说"下午"、"中午"、"晚上"
   - 中午12点到14点之间：只能说"中午好"、"中午"、"午饭"等
   - 下午14点到18点之间：只能说"下午好"、"下午"、"下午茶"等，不能说"早上"、"上午"、"晚上"
   - 晚上18点到22点之间：只能说"晚上好"、"晚上"、"夜"等，不能说"下午"、"中午"、"早上"
   - 深夜22点到次日5点之间：只能说"这么晚了"、"深夜了"、"还不睡"等，不能说"早上"、"下午"、"中午"
   - 如果消息内容涉及问候、时间或打招呼，必须严格符合当前时间段！例如：${timePeriod}说"早安"或"早上好"是错的，应该说"晚上好"才对！

请严格按照角色性格和当前准确时间(${formattedTime}，${timePeriod})来回复。
${settings.bilingual ? '必须双语：第一行中文，第二行英文。' : '请用中文回复。'}

【世界书强制执行规则】：
${worldForceRequirements || '暂无'}

【当前角色卡强制要求】：
${characterForceRequirements || '暂无'}

【执行要求】：
1. 在你输出最终回复之前，必须逐条检查是否违反了上面的“世界书强制执行规则”和“当前角色卡强制要求”。
2. 只要有任何冲突，必须优先服从这些强制要求，重写回复。
3. 如果这些强制要求为空，才按普通设定自由回复。`;

  const recentHistory = history.slice(-memoryRounds).map(msg => 
    `${msg.senderId === 'user' ? settings.persona.name : character.name}: ${msg.text} (时间:${new Date(msg.timestamp).toLocaleTimeString()})`
  ).join('\n');

  const prompt = `历史聊天记录：\n${recentHistory}\n\n${extraContext ? `[当前场景] ${extraContext}\n\n` : ''}[当前新消息] ${settings.persona.name}: ${userMessage}\n请以 ${character.name} 的身份回复：`;

  const draftReply = cleanAiText(await generateAIResponse(prompt, systemInstruction, images));

  if (!worldForceRequirements && !characterForceRequirements) {
    return draftReply;
  }

  const revisedReply = cleanAiText(await generateAIResponse(
    `请检查下面这条角色回复是否严格遵循强制要求；如果完全符合，就原样输出；如果有任何不符合，就改写成符合要求的最终回复。不要解释，不要Markdown，只输出最终回复文本。

【世界书强制执行规则】
${worldForceRequirements || '暂无'}

【角色卡强制要求】
${characterForceRequirements || '暂无'}

【原始回复草稿】
${draftReply}`,
    systemInstruction
  ));

  return revisedReply || draftReply;
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
