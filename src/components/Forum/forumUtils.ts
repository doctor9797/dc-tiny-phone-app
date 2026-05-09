import { generateAIResponse } from '../../lib/ai';
import { ForumComment, ForumPost } from '../../types';

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

export const FORUM_PERSONAS = [
  { id: 'bruce', handle: '旧巷雨伞', vibe: '说话克制，像见过很多事的成年人' },
  { id: 'alfred', handle: '红茶还热', vibe: '礼貌，带一点老派幽默' },
  { id: 'dick', handle: '蓝鸟夜跑', vibe: '轻松，会接梗' },
  { id: 'jason', handle: '雨棚下的头盔', vibe: '语气冲一点，但不是真的恶意' },
  { id: 'tim', handle: '第三备份', vibe: '分析欲很强，细节控' },
  { id: 'damian', handle: '幼狼不签名', vibe: '傲，挑剔，不耐烦' },
  { id: 'barbara', handle: '断线前在线', vibe: '聪明，擅长信息汇总' },
  { id: 'stephanie', handle: '紫色胶带', vibe: '活泼，会吐槽' },
  { id: 'cassandra', handle: '静音楼梯间', vibe: '话少，但观察很准' },
  { id: 'joker_side', handle: '笑口裂缝', vibe: '语气怪，像在逗人玩，但不明说身份' },
  { id: 'riddler_side', handle: '问号落地灯', vibe: '喜欢绕弯和反问' },
  { id: 'penguin_side', handle: '北港旧礼帽', vibe: '商人腔，消息灵' },
  { id: 'harley_side', handle: '粉锤停机位', vibe: '很会起哄，情绪外放' },
  { id: 'scarecrow_side', handle: '稻穗门诊', vibe: '阴森、冷不丁插一句' },
];

export const parseJsonBlock = <T,>(text: string, fallback: T): T => {
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
};

export const fallbackSeedPosts = (): ForumPost[] => [
  {
    id: 'forum_seed_1',
    boardId: 'gossip',
    authorHandle: '北港旧礼帽',
    title: '最近城里雨夜出租是不是更难打了',
    content: '不是抱怨，就是单纯感觉这两周夜里十点以后更难叫车。路边还总有人绕路走，搞得司机一个比一个警惕。有人也这样吗？',
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    updatedAt: Date.now() - 1000 * 60 * 60 * 5,
    comments: [
      { id: 'seed_1_c1', authorHandle: '紫色胶带', text: '有，我上周在风口站了二十分钟，最后是步行回去的。', createdAt: Date.now() - 1000 * 60 * 60 * 4.6 },
      { id: 'seed_1_c2', authorHandle: '第三备份', text: '不是错觉，近几周夜间封路点比以前多。', createdAt: Date.now() - 1000 * 60 * 60 * 4.3 },
    ],
    visitCount: 0,
  },
  {
    id: 'forum_seed_2',
    boardId: 'nightwatch',
    authorHandle: '蓝鸟夜跑',
    title: '凌晨一点在高架下看到有人把受伤流浪猫装箱带走',
    content: '不是坏事的那种带走，更像是处理得很熟练，车也停得很快。就是全程一句话没说，动作很利落。感觉城里还是有好人的。',
    createdAt: Date.now() - 1000 * 60 * 60 * 3.2,
    updatedAt: Date.now() - 1000 * 60 * 60 * 3.2,
    comments: [
      { id: 'seed_2_c1', authorHandle: '红茶还热', text: '愿意在这种时间停下来的，总归不会太差。', createdAt: Date.now() - 1000 * 60 * 60 * 2.8 },
      { id: 'seed_2_c2', authorHandle: '笑口裂缝', text: '也可能只是有人比猫更早受了伤，顺手罢了。', createdAt: Date.now() - 1000 * 60 * 60 * 2.5 },
    ],
    visitCount: 0,
  },
  {
    id: 'forum_seed_3',
    boardId: 'treehole',
    authorHandle: '静音楼梯间',
    title: '有时候觉得城里每个人都很累，但谁都装没事',
    content: '今天在便利店排队，前面的人明明眼眶都红了，还能很平静地问店员有没有热咖啡。突然就觉得，这地方的人好像都习惯硬撑。',
    createdAt: Date.now() - 1000 * 60 * 60 * 2.2,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2.2,
    comments: [
      { id: 'seed_3_c1', authorHandle: '红茶还热', text: '偶尔撑不住也不是坏事，停一停总比折断好。', createdAt: Date.now() - 1000 * 60 * 60 * 1.9 },
    ],
    visitCount: 0,
  }
];

export const scheduleNextReplyAt = (replyRefreshMinutes: number) =>
  Date.now() + (replyRefreshMinutes * 60 * 1000) + Math.floor(Math.random() * replyRefreshMinutes * 40 * 1000);

export const generateForumSeedPosts = async (
  recentChatLines: string,
  count = 3,
  preferredBoardId?: string
) => {
  const fallback = fallbackSeedPosts();
  const handles = FORUM_PERSONAS.map(p => p.handle).join('、');
  const boards = BOARD_OPTIONS.map(board => `${board.id}:${board.name}`).join('；');
  const prompt = `请根据以下最近聊天内容，生成 ${count} 条贴合真人论坛语气的新帖子，只返回 JSON 数组。要求：
1. 帖子来自同一世界观下的论坛用户，但不能使用真名或直接暴露身份。
2. 发帖人 handle 必须只从这些里选：${handles}
3. boardId 只能从这些里选：${boards}
4. 每条帖子包含：{"boardId":"...","authorHandle":"...","title":"...","content":"..."}
5. 语气真实，不夸张，不要像角色扮演文案。
6. ${preferredBoardId ? `本次生成的帖子 boardId 必须全部是 ${preferredBoardId}。` : '帖子可以分布在不同分区。'}
最近聊天内容：
${recentChatLines || '暂无明显聊天内容'}`;

  try {
    const aiPosts = parseJsonBlock<Array<{ boardId: string; authorHandle: string; title: string; content: string }>>(
      await generateAIResponse(prompt),
      []
    );
    return aiPosts.slice(0, count).map((post, index) => ({
      id: `forum_seed_ai_${Date.now()}_${index}`,
      boardId: preferredBoardId || (BOARD_OPTIONS.some(board => board.id === post.boardId) ? post.boardId : fallback[index % fallback.length]?.boardId || 'gossip'),
      authorHandle: FORUM_PERSONAS.some(persona => persona.handle === post.authorHandle) ? post.authorHandle : fallback[index % fallback.length]?.authorHandle || '旧巷雨伞',
      authorSourceId: FORUM_PERSONAS.find(persona => persona.handle === post.authorHandle)?.id,
      title: post.title || fallback[index % fallback.length]?.title || '有人遇到过这种事吗',
      content: post.content || fallback[index % fallback.length]?.content || '最近总觉得城里的氛围和以前不太一样。',
      createdAt: Date.now() - index * 1000 * 60 * 10,
      updatedAt: Date.now() - index * 1000 * 60 * 10,
      comments: [],
      visitCount: 0,
    } as ForumPost));
  } catch {
    return fallback
      .filter(post => !preferredBoardId || post.boardId === preferredBoardId)
      .slice(0, count)
      .map((post, index) => ({
        ...post,
        id: `${post.id}_${Date.now()}_${index}`,
        createdAt: Date.now() - index * 1000 * 60 * 10,
        updatedAt: Date.now() - index * 1000 * 60 * 10,
      }));
  }
};

export const generateForumReplyBatch = async (post: ForumPost, latestUserComment?: ForumComment | null) => {
  const fallbackComments: ForumComment[] = [
    {
      id: `${Date.now()}_fallback_1`,
      authorHandle: '第三备份',
      authorSourceId: 'tim',
      text: '楼主这个描述挺具体的，我倾向于不是你想多了，最近这一片确实不太平。',
      createdAt: Date.now(),
    },
    {
      id: `${Date.now()}_fallback_2`,
      authorHandle: '紫色胶带',
      authorSourceId: 'stephanie',
      text: `回 ${post.authorHandle}：我懂你说的那种感觉，看着像小事，但其实会在意一整天。`,
      createdAt: Date.now() + 1,
    },
    {
      id: `${Date.now()}_fallback_3`,
      authorHandle: '问号落地灯',
      authorSourceId: 'riddler_side',
      text: '楼上说得像结论，但结论通常来得太早。再看看吧。',
      createdAt: Date.now() + 2,
    },
  ];

  try {
    const prompt = `你在模拟一个真实论坛帖子的新增评论。请只返回 JSON 数组，长度 1 到 3，每项格式：
{"authorHandle":"匿名名","text":"评论内容"}
要求：
1. 评论作者只能从这些匿名名里选：${FORUM_PERSONAS.map(p => p.handle).join('、')}
2. 不能使用真名，不能直接暴露真实身份。
3. 评论语气像真人上网，不要太文学化。
4. 至少有一条要和楼主互动；如果有多条评论，其中一条可以轻微接一下前一条评论。
5. 不要重复已有评论意思。
帖子标题：${post.title}
帖子正文：${post.content}
楼主匿名名：${post.authorHandle}
${latestUserComment ? `用户最近回复的目标评论是：${latestUserComment.replyToHandle ? `回复 ${latestUserComment.replyToHandle} 说「${latestUserComment.text}」` : `${latestUserComment.authorHandle} 说「${latestUserComment.text}」`}。第一条新评论请优先顺着这条继续聊。` : ''}
已有最新评论：
${post.comments.slice(-4).map(comment => `${comment.authorHandle}:${comment.text}`).join('\n') || '暂无'}`;
    const aiComments = parseJsonBlock<Array<{ authorHandle: string; text: string }>>(
      await generateAIResponse(prompt),
      []
    );
    return aiComments
      .slice(0, 3)
      .filter(comment => comment.text?.trim())
      .map((comment, index) => ({
        id: `${Date.now()}_${index}_${Math.random()}`,
        authorHandle: FORUM_PERSONAS.some(persona => persona.handle === comment.authorHandle) ? comment.authorHandle : fallbackComments[index]?.authorHandle || '旧巷雨伞',
        authorSourceId: FORUM_PERSONAS.find(persona => persona.handle === comment.authorHandle)?.id,
        text: comment.text.trim(),
        createdAt: Date.now() + index,
      }));
  } catch {
    return fallbackComments.slice(0, Math.max(1, Math.min(3, (post.visitCount % 3) + 1)));
  }
};

export const getForumPersonaByHandle = (handle: string) =>
  FORUM_PERSONAS.find(persona => persona.handle === handle) || null;
