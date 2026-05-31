import { generateAIResponse } from '../../lib/ai';
import { ForumComment, ForumPost } from '../../types';
import { useAppStore } from '../../store';

export const FORUM_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="18" fill="#5b6473"/>
    <text x="32" y="40" text-anchor="middle" font-size="27" font-family="Arial, sans-serif" fill="white">论</text>
  </svg>
`)}`;

export const USER_HANDLE = '夜里不睡';
export const BOARD_OPTIONS = [
  { id: 'gossip', name: '城内闲聊', desc: '路人、八卦、生活流碎碎念' },
  { id: 'nightwatch', name: '夜巡目击', desc: '夜里看到的怪事和传闻' },
  { id: 'rumor', name: '都市怪谈', desc: '半真半假的传闻和分析' },
  { id: 'treehole', name: '树洞', desc: '心情贴、情绪贴、求安慰' },
  { id: 'market', name: '情报与二手', desc: '消息、装备、交换信息' },
] as const;

/** 角色对应的论坛匿名身份（不用真名） */
export const CHARACTER_PERSONAS: { id: string; handle: string; vibe: string }[] = [
  { id: 'bruce', handle: '旧巷雨伞', vibe: '说话克制，像见过很多事的成年人' },
  { id: 'alfred', handle: '红茶还热', vibe: '礼貌，带一点老派幽默' },
  { id: 'dick', handle: '蓝鸟夜跑', vibe: '轻松，会接梗' },
  { id: 'jason', handle: '雨棚下的头盔', vibe: '语气冲一点，但不是真的恶意' },
  { id: 'tim', handle: '第三备份', vibe: '分析欲很强，细节控' },
  { id: 'damian', handle: '幼狼不签名', vibe: '傲，挑剔，不耐烦' },
  { id: 'barbara', handle: '断线前在线', vibe: '聪明，擅长信息汇总' },
  { id: 'stephanie', handle: '紫色胶带', vibe: '活泼，会吐槽' },
  { id: 'cassandra', handle: '静音楼梯间', vibe: '话少，但观察很准' },
];

/** 根据handle查找完整信息 */
export const getForumPersonaByHandle = (handle: string) => {
  const char = CHARACTER_PERSONAS.find(p => p.handle === handle);
  if (char) return { ...char, isCharacter: true as const };
  // NPC handle 是 AI 自由生成的，返回默认信息
  return { handle, vibe: '普通论坛用户', isCharacter: false as const, id: undefined };
};

/** 从角色ID找论坛匿名 */
export const getCharacterHandle = (characterId: string) => {
  return CHARACTER_PERSONAS.find(p => p.id === characterId)?.handle || null;
};

export const parseJsonBlock = <T,>(text: string, fallback: T): T => {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
};

export const scheduleNextReplyAt = (replyRefreshMinutes: number) =>
  Date.now() + (replyRefreshMinutes * 60 * 1000) + Math.floor(Math.random() * replyRefreshMinutes * 40 * 1000);

/**
 * 检查用户发的帖子是否会让某些角色认出是 "你"
 * 用 AI 分析帖子和最近的聊天记录做匹配
 */
export async function checkCharacterRecognition(
  postTitle: string,
  postContent: string,
): Promise<Array<{ characterId: string; replyText: string }>> {
  const state = useAppStore.getState();
  const activeChars = Object.entries(state.characters)
    .filter(([, c]) => c.isWeChatFriend !== false)
    .map(([id, c]) => ({
      id,
      name: c.name,
      handle: getCharacterHandle(id),
      recentChats: (state.chats[id] || []).slice(-10).map(m => m.text).join(' | '),
    }))
    .filter(c => c.handle && c.recentChats);

  if (activeChars.length === 0) return [];

  const charInfo = activeChars.map(c =>
    `${c.name}（论坛匿名：${c.handle}）\n最近的聊天：${c.recentChats || '暂无'}`
  ).join('\n---\n');

  const prompt = `你是一个论坛帖子的"内容识别"系统。请判断：用户发的帖子，有没有可能让某些角色认出是"这个用户本人"？

帖子标题：${postTitle}
帖子内容：${postContent}

以下是有可能认出用户的角色（只从这里面选）：
${charInfo}

判断标准：
1. 帖子内容提到的经历、事件、话题，是否和角色与用户的聊天内容有明显关联？
2. 同一个梗、同一件事、同一个地点、同一种经历
3. 不要求100%确定，有"可能是ta"的感觉就算

请返回 JSON 数组，每项：{"characterId":"角色id","reason":"认出的理由"}
- 如果没有任何角色能认出，返回空数组 []
- 只返回 JSON，不要其他内容
- characterId 必须是上面列出的id中的一个`;

  try {
    const result = parseJsonBlock<Array<{ characterId: string; reason: string }>>(
      await generateAIResponse(prompt),
      []
    );

    if (!Array.isArray(result)) return [];

    // 为每个匹配的角色生成一条论坛评论
    const matches = result
      .filter(r => r.characterId && activeChars.some(c => c.id === r.characterId))
      .slice(0, 3); // 最多3个角色认出

    if (matches.length === 0) return [];

    const charDetails = matches.map(m => {
      const c = activeChars.find(c => c.id === m.characterId)!;
      return `${c.name}（论坛匿名：${c.handle}）\n认出理由：${m.reason}`;
    }).join('\n---\n');

    const replyPrompt = `以下角色认出了论坛帖子是"那个人"发的。请模拟每位角色用论坛匿名身份回一条评论。

帖子标题：${postTitle}
帖子内容：${postContent}

认出的角色：
${charDetails}

要求：
1. 每条评论用角色的论坛匿名身份回复，不能用真名
2. 语气要符合角色的论坛人设
3. 评论要暗示"我认出你了"但不要直接说破真实身份
4. 每条评论1-2句话，自然随意
5. 不要用引号或角色扮演格式

返回 JSON 数组，每项：{"characterId":"角色id","comment":"评论内容"}`;

    const replies = parseJsonBlock<Array<{ characterId: string; comment: string }>>(
      await generateAIResponse(replyPrompt),
      []
    );

    return replies
      .filter(r => r.characterId && r.comment)
      .map(r => ({
        characterId: r.characterId,
        replyText: r.comment.trim(),
      }));
  } catch {
    return [];
  }
}

export const generateForumSeedPosts = async (
  recentChatLines: string,
  count = 3,
  preferredBoardId?: string,
  skipHandle?: string,
  worldContext?: string,
) => {
  const boards = BOARD_OPTIONS.map(board => `${board.id}:${board.name}`).join('；');
  const worldSection = worldContext
    ? `世界观设定（所有帖子内容必须符合以下世界观）：\n${worldContext}\n\n`
    : '';
  const prompt = `${worldSection}请根据以下最近聊天内容，生成 ${count} 条贴合真人论坛语气的新帖子，只返回 JSON 数组。要求：
1. 发帖人使用随机生成的中文匿名昵称（听起来像真实论坛用户的ID），每次生成不同的昵称，不要使用任何预设名单。
2. 帖子来自同一世界观下的论坛用户，但不能使用真名或直接暴露身份。
3. boardId 只能从这些里选：${boards}
4. 每条帖子包含：{"boardId":"...","authorHandle":"...","title":"...","content":"..."}
5. 语气真实，不夸张，不要像角色扮演文案。
6. ${preferredBoardId ? `本次生成的帖子 boardId 必须全部是 ${preferredBoardId}。` : '帖子可以分布在不同分区。'}
7. ${skipHandle ? `严禁使用「${skipHandle}」作为发帖人。` : ''}
最近聊天内容：
${recentChatLines || '暂无明显聊天内容'}`;

  try {
    const aiPosts = parseJsonBlock<Array<{ boardId: string; authorHandle: string; title: string; content: string }>>(
      await generateAIResponse(prompt),
      []
    );
    return aiPosts.slice(0, count).map((post, index) => {
      return {
        id: `forum_seed_ai_${Date.now()}_${index}`,
        boardId: BOARD_OPTIONS.some(board => board.id === post.boardId) ? post.boardId : (preferredBoardId || 'gossip'),
        authorHandle: post.authorHandle || '路人甲',
        authorSourceId: CHARACTER_PERSONAS.find(p => p.handle === post.authorHandle)?.id,
        title: post.title || '有人遇到过这种事吗',
        content: post.content || '最近总觉得城里的氛围和以前不太一样。',
        createdAt: Date.now() - index * 1000 * 60 * 10,
        updatedAt: Date.now() - index * 1000 * 60 * 10,
        comments: [],
        likeCount: 0,
        repostCount: 0,
        likedBy: [],
        repostedBy: [],
        visitCount: 0,
        nextReplyAt: Date.now() + (30 + Math.floor(Math.random() * 60)) * 60 * 1000,
      } as ForumPost;
    });
  } catch {
    return [];
  }
};

export const generateForumReplyBatch = async (post: ForumPost, latestUserComment?: ForumComment | null, userHandle?: string): Promise<ForumComment[]> => {
  const existingHandles = post.comments.map(c => c.authorHandle);
  // 已有handle保留，这样同一帖子内保持连贯；新handle让AI自由生成
  const existingHandlesStr = existingHandles.length > 0 ? `已有评论的匿名名：${[...new Set(existingHandles)].join('、')}。新评论可以沿用这些匿名名，也可以创建新的。` : '所有评论的匿名名请自由生成。';

  const fallbackPool = [
    { h: '夜行记录员', t: '楼主这个描述挺具体的，最近确实不太平。' },
    { h: '转角观察者', t: '我懂你说的那种感觉，看着像小事，但其实会在意一整天。' },
    { h: '城市回声', t: '结论通常来得太早。再看看吧。' },
    { h: '河边的猫', t: '蹲一个后续，感觉这事没那么简单。' },
    { h: '旧书店常客', t: '这种事情在城里不稀奇，习惯就好。' },
    { h: '天没亮就醒', t: '我前两天也遇到了类似情况，当时没多想。' },
    { h: '末班车乘客', t: '楼主注意安全，最近夜里确实不太平。' },
    { h: '雨伞常忘', t: '说不上来为什么，但你写的东西让我有点在意。' },
  ];

  try {
    const prompt = `你在模拟一个真实论坛帖子的新增评论。请只返回 JSON 数组，长度 1 到 3，每项格式：
{"authorHandle":"匿名名","text":"评论内容"${userHandle ? `,"replyToHandle":"被回复者（可选）"` : ''}}
要求：
1. 评论作者使用随机生成的中文匿名昵称，每次生成不同的昵称。${existingHandlesStr}
2. 不能使用真名，不能直接暴露真实身份。
3. 评论语气像真人上网，不要太文学化。
4. 至少有一条要和楼主互动；如果有多条评论，其中一条可以轻微接一下前一条评论。
5. 不要重复已有评论意思。
${userHandle ? `6. 如果评论是专门回复 ${userHandle} 的，在 replyToHandle 字段填写 "${userHandle}"；否则不填 replyToHandle。` : ''}
帖子标题：${post.title}
帖子正文：${post.content}
楼主匿名名：${post.authorHandle}
${latestUserComment ? `用户最近回复的目标评论是：${latestUserComment.replyToHandle ? `回复 ${latestUserComment.replyToHandle} 说「${latestUserComment.text}」` : `${latestUserComment.authorHandle} 说「${latestUserComment.text}」`}。第一条新评论请优先顺着这条继续聊。` : ''}
已有最新评论：
${post.comments.slice(-4).map(comment => `${comment.authorHandle}:${comment.text}`).join('\n') || '暂无'}`;
    const aiComments = parseJsonBlock<Array<{ authorHandle: string; text: string; replyToHandle?: string }>>(
      await generateAIResponse(prompt),
      []
    );
    return aiComments
      .filter(comment => comment.text?.trim() && (userHandle ? comment.authorHandle !== userHandle : true))
      .slice(0, 3)
      .map((comment, index) => ({
        id: `${Date.now()}_${index}_${Math.random()}`,
        authorHandle: comment.authorHandle?.trim() ? comment.authorHandle : fallbackPool[index % fallbackPool.length].h,
        authorSourceId: CHARACTER_PERSONAS.find(p => p.handle === comment.authorHandle)?.id,
        text: comment.text.trim(),
        createdAt: Date.now() + index,
        ...(index === 0 && latestUserComment ? { replyToId: latestUserComment.id } : {}),
      }));
  } catch {
    // 随机选取不同于其他帖子的 fallback，避免多个帖子出现完全相同的回复
    const seed = Math.floor(Math.random() * 1000);
    const count = Math.max(1, Math.min(3, (post.visitCount % 3) + 1));
    return Array.from({ length: count }, (_, i): ForumComment => ({
      id: `${Date.now()}_fallback_${seed}_${i}`,
      authorHandle: fallbackPool[(seed + i) % fallbackPool.length].h,
      text: fallbackPool[(seed + i) % fallbackPool.length].t,
      createdAt: Date.now() + i,
    }));
  }
};

/** 检查待处理的角色 follow-up：如果用户没回复且超时，生成 WeChat 消息 */
export async function processCharacterFollowUps(posts: ForumPost[]): Promise<ForumPost[]> {
  const state = useAppStore.getState();
  const now = Date.now();
  const results: ForumPost[] = [];

  for (const post of posts) {
    if (!post.characterFollowUps?.length) continue;
    let updated = false;

    const newFollowUps = await Promise.all(
      post.characterFollowUps.map(async (fu) => {
        if (fu.followUpSent || fu.followUpAt > now) return fu;

        // 检查用户是否回复过该角色的评论
        const userReplied = post.comments.some(c =>
          c.authorHandle === post.authorHandle
          && (c.replyToId === fu.commentId || c.replyToHandle === fu.handle)
        );
        if (userReplied) {
          updated = true;
          return null; // 用户回复了，取消 follow-up
        }

        // 超时未回复 → 角色来微信找
        const char = state.characters[fu.characterId];
        if (char) {
          const handle = fu.handle;
          try {
            const wechatPrompt = `你正在扮演角色 ${char.name}。你在论坛上看到了"${post.title}"这个帖子，你认出发帖人是你认识的人。你用论坛匿名身份${handle}在下面留了言，但对方一直没回复你。

已经过去了几个小时，你现在决定在微信上给对方发一条消息。
语气要自然，不要提"论坛"这两个字，但要暗示你知道对方在做什么。
不要用括号动作，不要用Markdown。

发一条简短自然的微信消息。`;
            const wechatMsg = (await generateAIResponse(wechatPrompt)).trim();
            if (wechatMsg) {
              state.sendAdvancedMessage(fu.characterId, {
                senderId: fu.characterId,
                text: wechatMsg,
              });
            }
          } catch {
            // 静默失败，不影响游戏
          }
        }

        updated = true;
        return { ...fu, followUpSent: true };
      })
    );

    if (updated) {
      results.push({
        ...post,
        characterFollowUps: newFollowUps.filter((f): f is NonNullable<typeof f> => f !== null),
      });
    }
  }

  return results;
}
