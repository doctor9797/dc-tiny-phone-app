import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Heart, MessageCircle, Repeat2, Eye, ImagePlus, Plus, Send, Trash2, Ban, MessagesSquare, X, User, ArrowLeft, Settings, Camera, FileText, MoreHorizontal } from 'lucide-react';
import { ForumComment, ForumPost } from '../../types';
import ImageUploader from '../ImageUploader';
import { generateAIResponse } from '../../lib/ai';
import { saveInteractionMemory } from '../../lib/characterMemory';
import { BOARD_OPTIONS, FORUM_ICON, USER_HANDLE, generateForumReplyBatch, generateForumSeedPosts, getForumPersonaByHandle, scheduleNextReplyAt, checkCharacterRecognition, processCharacterFollowUps, getCharacterHandle } from './forumUtils';

const getCommentDepthMap = (comments: ForumComment[]) => {
  const depthMap = new Map<string, number>();
  const commentMap = new Map(comments.map(comment => [comment.id, comment]));
  const resolveDepth = (comment: ForumComment, seen = new Set<string>()): number => {
    if (depthMap.has(comment.id)) return depthMap.get(comment.id)!;
    if (!comment.replyToId || seen.has(comment.id) || !commentMap.has(comment.replyToId)) {
      depthMap.set(comment.id, 0); return 0;
    }
    seen.add(comment.id);
    const parent = commentMap.get(comment.replyToId)!;
    const depth = Math.min(4, resolveDepth(parent, seen) + 1);
    depthMap.set(comment.id, depth);
    return depth;
  };
  comments.forEach(comment => resolveDepth(comment));
  return depthMap;
};

const formatCount = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(ts).toLocaleDateString();
};

const RECENT_POST_MS = 24 * 60 * 60 * 1000; // 24小时内算"最近"
const STATS_REFRESH_INTERVAL = 15000; // 15秒刷新一次

function getAvatarBg(handle: string): string {
  const colors = ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ec4899', '#6366f1'];
  return colors[Math.abs(hashCode(handle)) % colors.length];
}

function Avatar({ handle, avatar, size = 'md' }: { handle: string; avatar?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-20 h-20 text-3xl' };
  const sizeClass = sizeMap[size];
  if (avatar) {
    return (
      <div className={`${sizeClass} rounded-full shrink-0 overflow-hidden border-2 border-white shadow-sm`}>
        <img src={avatar} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold shrink-0`}
      style={{ background: getAvatarBg(handle), color: '#fff' }}
    >
      {handle[0]?.toUpperCase() || '?'}
    </div>
  );
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) { hash = ((hash << 5) - hash) + s.charCodeAt(i); hash |= 0; }
  return hash;
}

function StatButton({ icon, count, active, activeColor, onClick }: {
  icon: React.ReactNode; count: number; active?: boolean; activeColor?: string; onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 text-sm transition-colors ${active ? activeColor || 'text-rose-500' : 'text-slate-400 hover:text-slate-600'}`}
    >
      {icon}
      <span className="text-xs">{formatCount(count)}</span>
    </button>
  );
}

function PostCard({ post, userHandle, forumPosts, onOpen, onLike, onRepost }: {
  post: ForumPost; userHandle: string; forumPosts: ForumPost[];
  onOpen: () => void; onLike: () => void; onRepost: () => void; key?: string;
}) {
  const originalPost = post.parentPostId ? forumPosts.find(p => p.id === post.parentPostId) : null;

  // X-style repost layout
  if (originalPost) {
    return (
      <button onClick={onOpen} className="w-full text-left">
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm hover:shadow-md transition-all active:scale-[0.99]">
          {/* Repost header */}
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
            <Repeat2 size={14} />
            <span>{post.authorHandle} 转发了</span>
          </div>
          {/* Reposter info */}
          <div className="flex items-center gap-2.5 mb-3">
            <Avatar handle={post.authorHandle} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-800 truncate">{post.authorHandle}</span>
                <span className="text-xs text-slate-400 shrink-0">{timeAgo(post.createdAt)}</span>
              </div>
            </div>
          </div>
          {/* Quote text */}
          <div className="text-sm leading-7 text-slate-700 mb-3">{post.content}</div>
          {/* Quoted original post */}
          <div className="rounded-xl border border-stone-200 p-4 bg-white/50">
            <div className="flex items-center gap-2.5 mb-2">
              <Avatar handle={originalPost.authorHandle} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-700 truncate">{originalPost.authorHandle}</span>
                  <span className="text-xs text-slate-400">@{originalPost.authorHandle}</span>
                </div>
              </div>
            </div>
            <div className="text-sm leading-7 text-slate-600 line-clamp-5">{originalPost.content}</div>
            {originalPost.imageUrl && (
              <img src={originalPost.imageUrl} alt="" className="mt-2 h-36 w-full rounded-lg object-cover border border-stone-100" />
            )}
          </div>
          {/* Stats */}
          <div className="flex items-center pt-3 mt-3 border-t border-stone-50">
            <div className="flex-1 flex justify-center">
              <StatButton icon={<MessageCircle size={16} />} count={post.comments.length} />
            </div>
            <div className="flex-1 flex justify-center">
              <StatButton icon={<Repeat2 size={16} />} count={post.repostCount || 0}
                active={post.repostedBy?.includes(userHandle)} activeColor="text-emerald-500"
                onClick={(e) => { e.stopPropagation(); onRepost(); }} />
            </div>
            <div className="flex-1 flex justify-center">
              <StatButton icon={<Heart size={16} />} count={post.likeCount || 0}
                active={post.likedBy?.includes(userHandle)}
                onClick={(e) => { e.stopPropagation(); onLike(); }} />
            </div>
            <div className="flex-1 flex justify-center">
              <StatButton icon={<Eye size={16} />} count={post.visitCount || 0} />
            </div>
          </div>
        </div>
      </button>
    );
  }

  // Regular post
  return (
    <button onClick={onOpen} className="w-full text-left">
      <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm hover:shadow-md transition-all active:scale-[0.99]">
        <div className="flex items-start gap-3 mb-3">
          <Avatar handle={post.authorHandle} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-800 truncate">{post.authorHandle}</span>
              <span className="text-xs text-slate-400 shrink-0">{timeAgo(post.createdAt)}</span>
            </div>
            <div className="text-xs text-slate-400">{BOARD_OPTIONS.find(b => b.id === post.boardId)?.name}</div>
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-800 mb-1.5">{post.title}</div>
        <div className="text-sm leading-7 text-slate-600 line-clamp-4 mb-3">{post.content}</div>
        {post.imageUrl && (
          <img src={post.imageUrl} alt="" className="mb-3 h-48 w-full rounded-xl object-cover border border-stone-100" />
        )}
        <div className="flex items-center pt-3 border-t border-stone-50">
          <div className="flex-1 flex justify-center">
            <StatButton icon={<MessageCircle size={16} />} count={post.comments.length} />
          </div>
          <div className="flex-1 flex justify-center">
            <StatButton icon={<Repeat2 size={16} />} count={post.repostCount || 0}
              active={post.repostedBy?.includes(userHandle)} activeColor="text-emerald-500"
              onClick={(e) => { e.stopPropagation(); onRepost(); }} />
          </div>
          <div className="flex-1 flex justify-center">
            <StatButton icon={<Heart size={16} />} count={post.likeCount || 0}
              active={post.likedBy?.includes(userHandle)}
              onClick={(e) => { e.stopPropagation(); onLike(); }} />
          </div>
          <div className="flex-1 flex justify-center">
            <StatButton icon={<Eye size={16} />} count={post.visitCount || 0} />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ForumApp() {
  const {
    closeApp, forumPosts, saveForumPost, deleteForumPost,
    toggleLikePost, toggleLikeComment, repostPost,
    setNotification, addActivityLog, characters, chats, currentApp,
    settings, updateSettings, sendAdvancedMessage,
    forumDmThreads, saveForumDmThread, deleteForumDmThread,
  } = useAppStore();

  const [boardId, setBoardId] = useState<(typeof BOARD_OPTIONS)[number]['id']>('gossip');
  const [view, setView] = useState<'feed' | 'compose' | 'detail' | 'dm' | 'dmlist' | 'profile' | 'profile-settings'>('feed');
  const [profileTab, setProfileTab] = useState<'posts' | 'replies'>('posts');
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [composeContent, setComposeContent] = useState('');
  const [composeImage, setComposeImage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [handleDraft, setHandleDraft] = useState(settings.forum?.userHandle || USER_HANDLE);
  const [avatarDraft, setAvatarDraft] = useState(settings.forum?.avatar || '');
  const [dmHandle, setDmHandle] = useState<string | null>(null);
  const [dmSourceId, setDmSourceId] = useState<string | undefined>(undefined);
  const [dmInput, setDmInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [repostModal, setRepostModal] = useState<{ postId: string } | null>(null);
  const [repostContent, setRepostContent] = useState('');
  const userHandle = settings.forum?.userHandle || USER_HANDLE;
  const blockedHandles = settings.forum?.blockedHandles || [];
  const seededRef = useRef(false);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [postCustomInput, setPostCustomInput] = useState('');
  const [replyCustomInput, setReplyCustomInput] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const boardPosts = useMemo(
    () => forumPosts.filter(p => p.boardId === boardId && !blockedHandles.includes(p.authorHandle))
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [boardId, blockedHandles, forumPosts]
  );
  const activePost = useMemo(
    () => forumPosts.find(p => p.id === activePostId) || null, [activePostId, forumPosts]
  );
  const activePostVisibleComments = useMemo(
    () => activePost ? activePost.comments.filter(c => !blockedHandles.includes(c.authorHandle)) : [],
    [activePost, blockedHandles]
  );
  const activePostCommentDepths = useMemo(
    () => getCommentDepthMap(activePostVisibleComments), [activePostVisibleComments]
  );
  const replyTargetComment = useMemo(
    () => activePostVisibleComments.find(c => c.id === replyTargetId) || null,
    [activePostVisibleComments, replyTargetId]
  );
  const postRefreshMinutes = settings.forum?.postRefreshMinutes ?? 120;
  const replyRefreshMinutes = settings.forum?.replyRefreshMinutes ?? 45;

  const myPosts = useMemo(
    () => forumPosts.filter(p => p.authorHandle === userHandle).sort((a, b) => b.createdAt - a.createdAt),
    [forumPosts, userHandle]
  );
  const repliesToMe = useMemo(() => {
    const myPostIds = new Set(forumPosts.filter(p => p.authorHandle === userHandle).map(p => p.id));
    const replies: { post: ForumPost; comment: ForumComment }[] = [];
    for (const post of forumPosts) {
      for (const comment of post.comments) {
        if (comment.authorHandle !== userHandle && !blockedHandles.includes(comment.authorHandle) && myPostIds.has(post.id)) {
          replies.push({ post, comment });
        }
      }
    }
    return replies.sort((a, b) => b.comment.createdAt - a.comment.createdAt);
  }, [forumPosts, userHandle, blockedHandles]);

  const totalLikes = useMemo(
    () => myPosts.reduce((sum, p) => sum + (p.likeCount || 0), 0),
    [myPosts]
  );

  const dmThreadList = useMemo(
    () => Object.values(forumDmThreads)
      .filter(t => !blockedHandles.includes(t.handle))
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [forumDmThreads, blockedHandles]
  );

  // Sync drafts from settings
  useEffect(() => {
    setHandleDraft(settings.forum?.userHandle || USER_HANDLE);
    setAvatarDraft(settings.forum?.avatar || '');
  }, [settings.forum?.userHandle, settings.forum?.avatar]);

  // Seed initial posts
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const seed = async () => {
      const s = useAppStore.getState().settings.forum || {};
      if ((s.postRefreshMinutes ?? 120) <= 0) return;
      const recentChatLines = Object.entries(chats)
        .flatMap(([charId, msgs]) => msgs.slice(-2).map(m => `${characters[charId]?.name || charId}:${m.text}`))
        .slice(-8).join('\n');
      const posts = (await generateForumSeedPosts(recentChatLines, 3, undefined, userHandle))
        .filter(p => p.authorHandle !== userHandle);
      posts.forEach(p => saveForumPost(p));
      updateSettings({ forum: { ...(settings.forum || {}), lastPostRefreshAt: Date.now() } });
    };
    seed();
  }, []);

  // Periodic stats refresh — 实时从 store 拿数据，不依赖闭包避免间隔重置
  const refreshStats = useCallback(() => {
    const state = useAppStore.getState();
    const s = state.settings.forum || {};
    if ((s.postRefreshMinutes ?? 120) <= 0) return;
    const now = Date.now();
    const updated: ForumPost[] = [];
    for (const post of state.forumPosts) {
      if (now - post.createdAt > RECENT_POST_MS) continue; // 超过24小时的帖子不涨数据
      // 15秒一次：越老的帖子增速越慢（24小时内线性衰减）
      const ageHours = (now - post.createdAt) / (3600 * 1000);
      const factor = Math.max(0.3, 1 - ageHours / 24 * 0.7);
      const viewBump = Math.floor(Math.random() * 8 * factor) + Math.ceil(3 * factor);
      const likeBump = Math.random() < 0.4 * factor ? (Math.floor(Math.random() * 2) + 1) : 0;
      const repostBump = Math.random() < 0.25 * factor ? (Math.floor(Math.random() * 2) + 1) : 0;
      if (likeBump > 0 || repostBump > 0 || viewBump > 0) {
        updated.push({
          ...post,
          visitCount: (post.visitCount || 0) + viewBump,
          likeCount: (post.likeCount || 0) + likeBump,
          repostCount: (post.repostCount || 0) + repostBump,
        });
      }
    }
    for (const p of updated) saveForumPost(p);
  }, [saveForumPost]);

  // 只挂一次间隔，不再依赖 refreshStats 重建
  useEffect(() => {
    statsTimerRef.current = setInterval(refreshStats, STATS_REFRESH_INTERVAL);
    return () => { if (statsTimerRef.current) clearInterval(statsTimerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown menu on outside click
  useEffect(() => {
    const close = () => setMenuOpenId(null);
    if (menuOpenId) {
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [menuOpenId]);

  // Refresh feed posts & replies on board change, with periodic background check
  useEffect(() => {
    const refreshFeed = async (targetBoardId: string, force = false) => {
      const pMin = useAppStore.getState().settings.forum?.postRefreshMinutes ?? 120;
      if (pMin <= 0) return;
      const lastRefresh = settings.forum?.lastPostRefreshAt || 0;
      if (!force && Date.now() - lastRefresh < pMin * 60 * 1000) return;
      const recentChatLines = Object.entries(chats)
        .flatMap(([charId, msgs]) => msgs.slice(-2).map(m => `${characters[charId]?.name || charId}:${m.text}`))
        .slice(-8).join('\n');
      const newPosts = (await generateForumSeedPosts(recentChatLines, 2, targetBoardId, userHandle))
        .filter(p => p.authorHandle !== userHandle);
      newPosts.forEach(p => saveForumPost(p));
      updateSettings({ forum: { ...(settings.forum || {}), lastPostRefreshAt: Date.now() } });
    };
    const maybeRefreshReplies = async () => {
      const rMin = useAppStore.getState().settings.forum?.replyRefreshMinutes ?? 45;
      if (rMin <= 0) return;
      const lastReplyRefresh = settings.forum?.lastReplyRefreshAt || 0;
      if (Date.now() - lastReplyRefresh < rMin * 60 * 1000) return;
      try { const ups = await processCharacterFollowUps(forumPosts); ups.forEach(p => saveForumPost(p)); } catch {}
      const duePosts = forumPosts.filter(p => p.nextReplyAt && p.nextReplyAt <= Date.now() && (p.subscribed || p.authorHandle === userHandle));
      for (const post of duePosts) {
        const latestUserComment = [...post.comments].reverse().find(c => c.authorHandle === userHandle);
        const newComments = (await generateForumReplyBatch(post, latestUserComment))
          .filter(c => !blockedHandles.includes(c.authorHandle) && c.authorHandle !== userHandle)
	          // also filter in generateForumReplyBatch via userHandle param
          .map((c, i) => i === 0 && latestUserComment ? { ...c, replyToId: latestUserComment.id, replyToHandle: latestUserComment.authorHandle } : c);
        if (!newComments.length) continue;
        saveForumPost({ ...post, comments: [...post.comments, ...newComments], updatedAt: Date.now(), nextReplyAt: scheduleNextReplyAt(rMin) });
        setNotification({
          id: Date.now(), title: newComments[0].authorHandle, text: `${newComments[0].authorHandle}回复了您`,
          sourceApp: 'forum', openApp: currentApp === 'forum' ? undefined : 'forum',
          avatar: FORUM_ICON, forumPostId: post.id,
        });
      }
      updateSettings({ forum: { ...(settings.forum || {}), lastReplyRefreshAt: Date.now() } });
    };
    refreshFeed(boardId);
    maybeRefreshReplies();
    const s0 = useAppStore.getState().settings.forum || {};
    const hasAnyEnabled = (s0.postRefreshMinutes ?? 120) > 0 || (s0.replyRefreshMinutes ?? 45) > 0;
    let periodicTimer;
    if (hasAnyEnabled) {
      periodicTimer = setInterval(() => {
        refreshFeed(boardId);
        maybeRefreshReplies();
      }, 300000);
    }
    return () => { if (periodicTimer) clearInterval(periodicTimer); };
  }, [boardId]);

  const openDm = (handle: string, sourceId?: string) => {
    if (blockedHandles.includes(handle)) return;
    setDmHandle(handle); setDmSourceId(sourceId); setView('dm');
  };

  const blockHandle = (handle: string) => {
    if (!confirm(`拉黑 ${handle}？`)) return;
    updateSettings({ forum: { ...(settings.forum || {}), blockedHandles: Array.from(new Set([...(settings.forum?.blockedHandles || []), handle])) } });
    if (dmHandle === handle) { setDmHandle(null); setView('feed'); }
  };

  const sendDm = async () => {
    if (!dmHandle || !dmInput.trim() || blockedHandles.includes(dmHandle)) return;
    const now = Date.now();
    const baseThread = forumDmThreads[dmHandle] || { handle: dmHandle, sourceId: dmSourceId, messages: [], updatedAt: now };
    const userMessage = { id: `${now}_user`, sender: 'user' as const, text: dmInput.trim(), createdAt: now };
    const nextThread = { ...baseThread, sourceId: baseThread.sourceId || dmSourceId, messages: [...baseThread.messages, userMessage], updatedAt: now };
    saveForumDmThread(nextThread);
    const outgoingText = dmInput.trim();
    setDmInput(''); setLoading(true);
    try {
      const persona = getForumPersonaByHandle(dmHandle);
      const prompt = `你正在扮演论坛匿名用户 ${dmHandle} 与我私信。你的匿名气质：${persona?.vibe || '普通论坛用户'}。如果你有对应真实角色也不要暴露身份。最近对话：${nextThread.messages.slice(-6).map(m => `${m.sender === 'user' ? userHandle : dmHandle}: ${m.text}`).join('\n')}\n\n我: ${outgoingText}\n\n回复1段简短自然的私信，不要Markdown，不要括号动作。`;
      const replyText = (await generateAIResponse(prompt)).trim();
      saveForumDmThread({ ...nextThread, messages: [...nextThread.messages, { id: `${Date.now()}_other`, sender: 'other', text: replyText, createdAt: Date.now() }], updatedAt: Date.now() });
      if (persona.isCharacter && persona.id) saveInteractionMemory(persona.id, `论坛私信${dmHandle}`, outgoingText);
    } catch {
      saveForumDmThread({ ...nextThread, messages: [...nextThread.messages, { id: `${Date.now()}_other`, sender: 'other', text: '刚看到，晚点和你说。', createdAt: Date.now() }], updatedAt: Date.now() });
    } finally { setLoading(false); }
  };

  const openPost = async (post: ForumPost) => {
    setActivePostId(post.id); setView('detail');
    saveForumPost({ ...post, visitCount: (post.visitCount || 0) + 1 });
  };

  const handlePublishPost = async () => {
    if (!composeContent.trim()) return;
    const now = Date.now();
    const newPost: ForumPost = {
      id: `${now}_forum_user`, boardId,
      authorHandle: userHandle, title: composeContent.trim().slice(0, 60),
      content: composeContent.trim(), imageUrl: composeImage || undefined,
      createdAt: now, updatedAt: now, comments: [],
      visitCount: 0, likeCount: 0, repostCount: 0, likedBy: [], repostedBy: [],
      subscribed: replyRefreshMinutes > 0, nextReplyAt: replyRefreshMinutes > 0 ? scheduleNextReplyAt(replyRefreshMinutes) : undefined,
    };
    saveForumPost(newPost);
    addActivityLog({ id: `${now}_forum_post`, title: `论坛发帖：${newPost.title}`, detail: newPost.content.slice(0, 60), timestamp: now });
    setComposeContent(''); setComposeImage(''); setView('feed');
    try {
      const recognition = await checkCharacterRecognition(newPost.title, newPost.content);
      if (recognition.length > 0) {
        const now2 = Date.now();
        const followUps = recognition.map((r, i) => ({
          characterId: r.characterId, handle: getCharacterHandle(r.characterId) || '',
          commentId: `${now2}_recog_${i}`, recognizedAt: now2,
          followUpAt: now2 + (2 + Math.floor(Math.random() * 60)) * 60 * 1000, followUpSent: false,
        }));
        const recogComments: ForumComment[] = recognition
          .filter(r => r.replyText?.trim() && r.characterId)
          .map((r, i) => ({
          id: followUps[i]?.commentId || `${now2}_recog_${i}`, authorHandle: followUps[i]?.handle || '', authorSourceId: r.characterId,
          text: r.replyText, createdAt: now2 + i,
        })).filter(c => c.authorHandle !== userHandle && c.authorHandle);
        saveForumPost({ ...newPost, comments: recogComments, updatedAt: now2, characterFollowUps: followUps });
      }
    } catch {}
  };

  const handleReply = () => {
    if (!activePost || !replyText.trim()) return;
    const now = Date.now();
    let clearedFollowUps = activePost.characterFollowUps;
    if (replyTargetComment?.authorSourceId && clearedFollowUps?.length) {
      clearedFollowUps = clearedFollowUps.map(fu =>
        fu.characterId === replyTargetComment.authorSourceId || fu.handle === replyTargetComment.authorHandle
          ? { ...fu, followUpSent: true } : fu
      );
    }
    saveForumPost({
      ...activePost, comments: [...activePost.comments, {
        id: `${now}_user_reply`, authorHandle: userHandle, text: replyText.trim(), createdAt: now,
        replyToId: replyTargetComment?.id, replyToHandle: replyTargetComment?.authorHandle,
      }], updatedAt: now, subscribed: replyRefreshMinutes > 0,
      nextReplyAt: replyRefreshMinutes > 0 ? scheduleNextReplyAt(replyRefreshMinutes) : undefined,
      ...(clearedFollowUps ? { characterFollowUps: clearedFollowUps } : {}),
    });
    setReplyText(''); setReplyTargetId(null);
  };

  const handleLikePost = (postId: string) => toggleLikePost(postId, userHandle);
  const handleLikeComment = (postId: string, commentId: string) => toggleLikeComment(postId, commentId, userHandle);

  const handleRepost = (postId: string) => {
    const post = forumPosts.find(p => p.id === postId);
    if (!post) return;
    if (post.authorHandle === userHandle) { repostPost(postId, userHandle, post.title, post.content); return; }
    setRepostModal({ postId });
  };

  const confirmRepost = () => {
    if (!repostModal) return;
    const post = forumPosts.find(p => p.id === repostModal.postId);
    if (!post) return;
    repostPost(repostModal.postId, userHandle, post.title, repostContent || post.content);
    setRepostModal(null); setRepostContent('');
  };

  const activeDmThread = dmHandle ? forumDmThreads[dmHandle] || { handle: dmHandle, sourceId: dmSourceId, messages: [], updatedAt: Date.now() } : null;
  const boardMeta = BOARD_OPTIONS.find(b => b.id === boardId);

  // ─── COMPOSE VIEW ───
  if (view === 'compose') {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-5 pt-14 pb-3 flex items-center justify-between border-b border-stone-50">
          <button onClick={() => setView('feed')}><ChevronLeft size={22} className="text-slate-600" /></button>
          <span className="font-semibold text-slate-800">新帖</span>
          <button onClick={handlePublishPost} className="text-sm font-semibold text-sky-500">发布</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4">
          <div className="flex items-start gap-3 mb-4">
            <Avatar handle={userHandle} avatar={settings.forum?.avatar} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800">{userHandle}</div>
              <div className="text-xs text-slate-400 mt-0.5">{boardMeta?.name}</div>
            </div>
          </div>
          <textarea
            value={composeContent}
            onChange={e => setComposeContent(e.target.value)}
            placeholder="有什么想说的？"
            className="w-full min-h-[180px] text-lg leading-8 resize-none outline-none text-slate-800 placeholder:text-slate-300"
            autoFocus
          />
          {composeImage && (
            <div className="relative mt-3">
              <img src={composeImage} alt="" className="w-full h-48 object-cover rounded-2xl border border-stone-100" />
              <button onClick={() => setComposeImage('')} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center"><X size={14} /></button>
            </div>
          )}
        </div>
        <div className="border-t border-stone-50 px-5 py-3 flex items-center justify-between">
          <ImageUploader onImageSelected={setComposeImage}>
            <button className="text-sky-500"><ImagePlus size={20} /></button>
          </ImageUploader>
          <button onClick={handlePublishPost} disabled={!composeContent.trim()} className="rounded-full bg-sky-500 text-white px-6 py-2 text-sm font-semibold disabled:opacity-40">发布</button>
        </div>
      </div>
    );
  }

  // ─── PROFILE SETTINGS SUB-VIEW ───
  if (view === 'profile-settings') {
    const activePostRefresh = settings.forum?.postRefreshMinutes ?? 120;
    const activeReplyRefresh = settings.forum?.replyRefreshMinutes ?? 45;

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => { setAvatarDraft(ev.target?.result as string); };
      reader.readAsDataURL(file);
    };

    const saveAll = () => {
      updateSettings({
        forum: {
          ...(settings.forum || {}),
          userHandle: handleDraft.trim() || userHandle,
          avatar: avatarDraft,
        }
      });
      setView('profile');
    };

    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-5 pt-14 pb-3 flex items-center justify-between border-b border-stone-50">
          <button onClick={() => { setHandleDraft(settings.forum?.userHandle || USER_HANDLE); setAvatarDraft(settings.forum?.avatar || ''); setView('profile'); }}><ArrowLeft size={22} className="text-slate-600" /></button>
          <span className="font-semibold text-slate-800">设置</span>
          <button onClick={saveAll} className="text-sm font-semibold text-sky-500">保存</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Avatar + Handle */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-5">个人资料</div>
            <div className="flex items-center gap-5">
              <div className="relative group">
                <Avatar handle={handleDraft || userHandle} avatar={avatarDraft} size="lg" />
                <label className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 cursor-pointer flex items-center justify-center transition-all">
                  <Camera size={22} className="text-white opacity-0 group-hover:opacity-100" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
              </div>
              <div className="flex-1">
                <input value={handleDraft} onChange={e => setHandleDraft(e.target.value)}
                  className="w-full text-lg font-bold text-slate-800 bg-stone-50 rounded-xl px-4 py-3 border border-stone-200 outline-none focus:border-sky-300 focus:bg-white transition-colors"
                />
                <div className="text-xs text-slate-400 mt-1.5">点击头像更换图片</div>
              </div>
            </div>
          </div>

          <div className="h-px bg-stone-50" />

          {/* Refresh settings */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-5">刷新频率</div>
            <div className="space-y-6">
              <div>
                <div className="text-sm text-slate-600 mb-1">帖子刷新间隔</div>
                <p className="text-xs text-slate-300 mb-3">首页帖子列表的自动数据刷新</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => updateSettings({ forum: { ...(settings.forum || {}), postRefreshMinutes: 0 } })}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${activePostRefresh === 0 ? 'bg-red-500 text-white shadow-md' : 'bg-stone-50 text-slate-500 hover:bg-stone-100'}`}
                  >关闭</button>
                  {[30, 60, 120, 240].map(v => (
                    <button key={v} onClick={() => updateSettings({ forum: { ...(settings.forum || {}), postRefreshMinutes: v } })}
                      className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${activePostRefresh === v ? 'bg-slate-800 text-white shadow-md' : 'bg-stone-50 text-slate-500 hover:bg-stone-100'}`}
                    >{v >= 60 ? `${v / 60}h` : `${v}min`}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input value={postCustomInput} onChange={e => setPostCustomInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="自定义分钟"
                    className="w-28 text-xs text-slate-600 bg-stone-50 rounded-lg px-3 py-2 border border-stone-200 outline-none focus:border-sky-300"
                  />
                  <button onClick={() => { const v = parseInt(postCustomInput); if (v > 0) { updateSettings({ forum: { ...(settings.forum || {}), postRefreshMinutes: v } }); setPostCustomInput(''); } }}
                    className="text-xs font-medium text-sky-500 hover:text-sky-600 transition-colors"
                  >应用</button>
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-600 mb-1">回复刷新间隔</div>
                <p className="text-xs text-slate-300 mb-3">角色自动回复你的频率</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => updateSettings({ forum: { ...(settings.forum || {}), replyRefreshMinutes: 0 } })}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${activeReplyRefresh === 0 ? 'bg-red-500 text-white shadow-md' : 'bg-stone-50 text-slate-500 hover:bg-stone-100'}`}
                  >关闭</button>
                  {[15, 30, 45, 90].map(v => (
                    <button key={v} onClick={() => updateSettings({ forum: { ...(settings.forum || {}), replyRefreshMinutes: v } })}
                      className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${activeReplyRefresh === v ? 'bg-slate-800 text-white shadow-md' : 'bg-stone-50 text-slate-500 hover:bg-stone-100'}`}
                    >{v >= 60 ? `${v / 60}h` : `${v}min`}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input value={replyCustomInput} onChange={e => setReplyCustomInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="自定义分钟"
                    className="w-28 text-xs text-slate-600 bg-stone-50 rounded-lg px-3 py-2 border border-stone-200 outline-none focus:border-sky-300"
                  />
                  <button onClick={() => { const v = parseInt(replyCustomInput); if (v > 0) { updateSettings({ forum: { ...(settings.forum || {}), replyRefreshMinutes: v } }); setReplyCustomInput(''); } }}
                    className="text-xs font-medium text-sky-500 hover:text-sky-600 transition-colors"
                  >应用</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── PROFILE VIEW ───
  if (view === 'profile') {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="px-5 pt-14 pb-3 flex items-center justify-between border-b border-stone-50">
          <button onClick={() => setView('feed')}><ArrowLeft size={22} className="text-slate-600" /></button>
          <span className="font-semibold text-slate-800">个人主页</span>
          <button onClick={() => { setHandleDraft(settings.forum?.userHandle || USER_HANDLE); setAvatarDraft(settings.forum?.avatar || ''); setView('profile-settings'); }} className="text-slate-400">
            <Settings size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Banner area */}
          <div className="h-24 bg-gradient-to-r from-sky-100 via-stone-50 to-amber-100" />

          {/* Avatar + info */}
          <div className="px-6 relative">
            <div className="-mt-10 mb-3">
              <Avatar handle={userHandle} avatar={settings.forum?.avatar} size="lg" />
            </div>
            <div className="mb-5">
              <div className="text-xl font-bold text-slate-800">{userHandle}</div>
              <div className="text-sm text-slate-400 mt-0.5">@{userHandle}</div>
            </div>

            {/* Stats */}
            <div className="flex gap-6 pb-5 border-b border-stone-50">
              <div className="text-center">
                <div className="text-lg font-bold text-slate-800">{myPosts.length}</div>
                <div className="text-xs text-slate-400 mt-0.5">帖子</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-800">{repliesToMe.length}</div>
                <div className="text-xs text-slate-400 mt-0.5">回复</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-800">{totalLikes}</div>
                <div className="text-xs text-slate-400 mt-0.5">获赞</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex mx-6 border-b border-stone-100">
            <button onClick={() => setProfileTab('posts')}
              className={`flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors ${profileTab === 'posts' ? 'border-sky-500 text-sky-500' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >我的帖子</button>
            <button onClick={() => setProfileTab('replies')}
              className={`flex-1 py-4 text-sm font-semibold text-center border-b-2 transition-colors ${profileTab === 'replies' ? 'border-sky-500 text-sky-500' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >回复我的</button>
          </div>

          {/* Posts / Replies */}
          <div className="px-6 py-5 space-y-3 pb-20">
            {profileTab === 'posts' ? (
              myPosts.length === 0 ? (
                <div className="flex flex-col items-center text-slate-300 py-20">
                  <FileText size={40} strokeWidth={1.5} className="mb-4 text-slate-200" />
                  <p className="text-sm">还没有发过帖子</p>
                </div>
              ) : (
                myPosts.map(post => (
                  <PostCard key={post.id} post={post} userHandle={userHandle} forumPosts={forumPosts}
                    onOpen={() => openPost(post)} onLike={() => handleLikePost(post.id)} onRepost={() => handleRepost(post.id)} />
                ))
              )
            ) : (
              repliesToMe.length === 0 ? (
                <div className="flex flex-col items-center text-slate-300 py-20">
                  <MessageCircle size={40} strokeWidth={1.5} className="mb-4 text-slate-200" />
                  <p className="text-sm">还没有人回复你</p>
                </div>
              ) : (
                repliesToMe.map(({ post, comment }) => (
                  <button key={comment.id} onClick={() => { setActivePostId(post.id); setView('detail'); }}
                    className="w-full text-left bg-white rounded-2xl border border-stone-100 p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <Avatar handle={comment.authorHandle} size="sm" />
                      <span className="text-sm font-semibold text-slate-700">{comment.authorHandle}</span>
                      <span className="text-xs text-slate-400">{timeAgo(comment.createdAt)}</span>
                    </div>
                    <div className="text-sm leading-7 text-slate-600 bg-stone-50 rounded-xl px-4 py-3 mb-2">{comment.text}</div>
                    <div className="text-xs text-sky-500">在「{post.title}」中回复了你</div>
                  </button>
                ))
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── DM LIST VIEW ───
  if (view === 'dmlist') {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-5 pt-14 pb-3 flex items-center justify-between border-b border-stone-50">
          <button onClick={() => setView('feed')}><ChevronLeft size={22} className="text-slate-600" /></button>
          <span className="font-semibold text-slate-800">私信</span>
          <div className="w-5" />
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {dmThreadList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <MessagesSquare size={40} strokeWidth={1} className="mb-4 text-slate-200" />
              <p className="text-sm">暂无私信记录</p>
              <p className="text-xs mt-1">在帖子中点击私信按钮即可发起对话</p>
            </div>
          ) : (
            <div className="space-y-1">
              {dmThreadList.map(thread => (
                <button key={thread.handle} onClick={() => { setDmHandle(thread.handle); setDmSourceId(thread.sourceId); setView('dm'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-stone-50 transition-colors"
                >
                  <Avatar handle={thread.handle} size="sm" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-semibold text-slate-800">{thread.handle}</div>
                    <div className="text-xs text-slate-400 truncate mt-0.5">
                      {thread.messages.length > 0 ? thread.messages[thread.messages.length - 1].text : '暂无消息'}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 shrink-0">{timeAgo(thread.updatedAt)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── DM CONVERSATION VIEW ───
  if (view === 'dm' && activeDmThread && dmHandle) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-5 pt-14 pb-3 flex items-center justify-between border-b border-stone-50">
          <button onClick={() => setView('dmlist')}><ChevronLeft size={22} className="text-slate-600" /></button>
          <span className="font-semibold text-slate-800">{dmHandle}</span>
          <button onClick={() => { if (confirm('删除私信记录？')) { deleteForumDmThread(dmHandle); setView('dmlist'); } }} className="text-rose-400"><Trash2 size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {activeDmThread.messages.length === 0 && (
            <div className="text-center text-slate-400 py-16 text-sm">开始对话吧</div>
          )}
          {activeDmThread.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.sender === 'user' ? 'bg-sky-500 text-white rounded-br-md' : 'bg-stone-100 text-slate-700 rounded-bl-md'}`}>
                <div className="text-sm leading-7 whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-stone-50 px-5 py-3">
          <div className="flex items-end gap-2">
            <textarea value={dmInput} onChange={e => setDmInput(e.target.value)}
              placeholder={`发给 ${dmHandle}...`}
              className="flex-1 min-h-[44px] max-h-28 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 resize-none text-sm outline-none"
            />
            <button onClick={() => void sendDm()} disabled={!dmInput.trim() || loading}
              className="rounded-full bg-sky-500 text-white p-3 disabled:opacity-40"
            ><Send size={16} /></button>
          </div>
        </div>
      </div>
    );
  }

  // ─── DETAIL VIEW ───
  if (view === 'detail' && activePost) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-5 pt-14 pb-3 flex items-center justify-between border-b border-stone-50">
          <button onClick={() => setView('feed')}><ChevronLeft size={22} className="text-slate-600" /></button>
          <span className="font-semibold text-slate-800">帖子</span>
          {activePost.authorHandle === userHandle ? (
            <button onClick={() => { if (confirm('删除？')) { deleteForumPost(activePost.id); setView('feed'); } }} className="text-rose-400"><Trash2 size={16} /></button>
          ) : <div className="w-5" />}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-start gap-3 mb-4">
              <Avatar handle={activePost.authorHandle} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-800">{activePost.authorHandle}</span>
                  <span className="text-xs text-slate-400">{timeAgo(activePost.createdAt)}</span>
                </div>
                <div className="text-xs text-slate-400">{BOARD_OPTIONS.find(b => b.id === activePost.boardId)?.name}</div>
              </div>
              {activePost.authorHandle !== userHandle && !blockedHandles.includes(activePost.authorHandle) && (
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === '__post__' ? null : '__post__'); }} className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={20} /></button>
                  {menuOpenId === '__post__' && (
                    <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-stone-200 py-2 min-w-[170px] z-50" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { openDm(activePost.authorHandle, activePost.authorSourceId); setMenuOpenId(null); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-800 hover:bg-stone-50"
                      ><MessagesSquare size={16} className="text-slate-700" /> Send Message</button>
                      <button onClick={() => { blockHandle(activePost.authorHandle); setMenuOpenId(null); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-stone-50"
                      ><Ban size={16} className="text-red-400" /> Block User</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="text-lg font-bold text-slate-800 mb-2">{activePost.title}</div>
            <div className="text-[15px] leading-8 text-slate-700 whitespace-pre-wrap">{activePost.content}</div>
            {activePost.imageUrl && <img src={activePost.imageUrl} alt="" className="mt-3 w-full h-64 object-cover rounded-2xl border border-stone-100" />}
            {activePost.parentPostId && (() => {
              const orig = forumPosts.find(p => p.id === activePost.parentPostId);
              if (!orig) return null;
              return (
                <div className="mt-4 rounded-xl border border-stone-200 p-4 bg-white/50">
                  <div className="flex items-center gap-2.5 mb-2">
                    <Avatar handle={orig.authorHandle} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-700 truncate">{orig.authorHandle}</span>
                        <span className="text-xs text-slate-400">@{orig.authorHandle}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">{orig.content}</div>
                  {orig.imageUrl && (
                    <img src={orig.imageUrl} alt="" className="mt-2 h-48 w-full rounded-lg object-cover border border-stone-100" />
                  )}
                </div>
              );
            })()}
            <div className="flex items-center gap-5 mt-4 pt-3 border-t border-stone-50 text-sm text-slate-400">
              <span><strong className="text-slate-700">{activePost.comments.length}</strong> 评论</span>
              <span><strong className="text-slate-700">{activePost.repostCount || 0}</strong> 转发</span>
              <span><strong className="text-slate-700">{activePost.likeCount || 0}</strong> 点赞</span>
              <span><strong className="text-slate-700">{activePost.visitCount || 0}</strong> 浏览</span>
            </div>
            <div className="flex items-center justify-around py-3 mt-2 border-b border-stone-50">
              <StatButton icon={<Heart size={20} />} count={activePost.likeCount || 0}
                active={activePost.likedBy?.includes(userHandle)}
                onClick={() => handleLikePost(activePost.id)} />
              <StatButton icon={<Repeat2 size={20} />} count={activePost.repostCount || 0}
                active={activePost.repostedBy?.includes(userHandle)} activeColor="text-emerald-500"
                onClick={() => handleRepost(activePost.id)} />
              <StatButton icon={<Eye size={20} />} count={activePost.visitCount || 0} />
            </div>
          </div>
          <div className="px-5 py-3 space-y-3">
            {activePostVisibleComments.map(comment => {
              const depth = activePostCommentDepths.get(comment.id) || 0;
              const isLiked = comment.likedBy?.includes(userHandle);
              return (
                <div key={comment.id} className="relative" style={{ marginLeft: `${Math.min(depth, 4) * 16}px` }}>
                  {depth > 0 && <div className="absolute left-[-8px] top-0 bottom-0 w-px bg-stone-100" />}
                  <div className={`rounded-2xl border p-3 bg-white border-stone-100`}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2">
                        <Avatar handle={comment.authorHandle} size="sm" />
                        <span className="text-sm font-semibold text-slate-800">{comment.authorHandle}</span>
                        <span className="text-xs text-slate-400">{timeAgo(comment.createdAt)}</span>
                      </div>
                      {comment.authorHandle !== userHandle && (
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === comment.id ? null : comment.id); }} className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={16} /></button>
                          {menuOpenId === comment.id && (
                            <div className="absolute right-0 top-7 bg-white rounded-xl shadow-lg border border-stone-200 py-2 min-w-[170px] z-50" onClick={e => e.stopPropagation()}>
                              <button onClick={() => { openDm(comment.authorHandle, comment.authorSourceId); setMenuOpenId(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-800 hover:bg-stone-50"
                              ><MessagesSquare size={16} className="text-slate-700" /> Send Message</button>
                              <button onClick={() => { blockHandle(comment.authorHandle); setMenuOpenId(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-stone-50"
                              ><Ban size={16} className="text-red-400" /> Block User</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {comment.replyToHandle && <div className="text-xs text-sky-500 mb-1">回复 @{comment.replyToHandle}</div>}
                    <div className="text-sm leading-7 text-slate-700">{comment.text}</div>
                    <div className="mt-2 flex items-center gap-4">
                      <button onClick={() => setReplyTargetId(comment.id)} className="text-xs text-slate-400 hover:text-sky-500">回复</button>
                      <button onClick={() => handleLikeComment(activePost.id, comment.id)}
                        className={`flex items-center gap-1 text-xs ${isLiked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                      ><Heart size={12} fill={isLiked ? 'currentColor' : 'none'} /><span>{formatCount(comment.likedBy?.length || 0)}</span></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {activePostVisibleComments.length === 0 && (
              <div className="text-center text-slate-400 py-10 text-sm">还没有评论</div>
            )}
          </div>
        </div>
        <div className="border-t border-stone-50 px-5 py-3">
          {replyTargetComment && (
            <div className="mb-2 rounded-xl bg-stone-50 px-3 py-2 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span className="truncate">回复 @{replyTargetComment.authorHandle}</span>
              <button onClick={() => setReplyTargetId(null)} className="text-slate-400">取消</button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
              placeholder={replyTargetComment ? `回复 @${replyTargetComment.authorHandle}...` : '说点什么...'}
              className="flex-1 min-h-[44px] max-h-28 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 resize-none text-sm outline-none"
            />
            <button onClick={handleReply} disabled={!replyText.trim()} className="rounded-full bg-sky-500 text-white p-3 disabled:opacity-40"><Send size={16} /></button>
          </div>
        </div>
      </div>
    );
  }

  // ─── FEED VIEW ───
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-5 pt-14 pb-3 flex items-center justify-between border-b border-stone-50">
        <button onClick={closeApp}><ChevronLeft size={22} className="text-slate-600" /></button>
        <span className="font-bold text-lg text-slate-800">论坛</span>
        <div className="flex items-center gap-4">
          <button onClick={() => setView('dmlist')} className="text-slate-500 relative">
            <MessagesSquare size={20} />
            {dmThreadList.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] flex items-center justify-center font-bold">
                {dmThreadList.length > 9 ? '9+' : dmThreadList.length}
              </span>
            )}
          </button>
          <button onClick={() => setView('profile')} className="text-slate-500">
            <User size={20} />
          </button>
        </div>
      </div>

      {/* Board tabs */}
      <div className="px-5 pt-3 flex gap-2 overflow-x-auto no-scrollbar">
        {BOARD_OPTIONS.map(board => (
          <button key={board.id} onClick={() => setBoardId(board.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${boardId === board.id ? 'bg-slate-800 text-white' : 'bg-stone-100 text-slate-600'}`}
          >{board.name}</button>
        ))}
      </div>
      <div className="px-5 pt-2 pb-1 text-xs text-slate-400">{boardMeta?.desc}</div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-3 space-y-3 pb-20">
          {/* Compose CTA */}
          <button onClick={() => setView('compose')}
            className="w-full rounded-2xl border border-dashed border-stone-200 bg-white/60 px-5 py-4 text-left text-slate-400 text-sm flex items-center gap-2 hover:border-stone-300 transition-colors"
          ><Plus size={18} />在 {boardMeta?.name} 发帖</button>

          {boardPosts.map(post => (
            <PostCard key={post.id} post={post} userHandle={userHandle} forumPosts={forumPosts}
              onOpen={() => openPost(post)} onLike={() => handleLikePost(post.id)} onRepost={() => handleRepost(post.id)} />
          ))}
          {boardPosts.length === 0 && (
            <div className="text-center text-slate-400 py-16">
              <p className="text-sm">这个分区还没有帖子</p>
              <button onClick={() => { /* manual refresh */ }} className="mt-3 text-sky-500 text-sm font-semibold">刷新</button>
            </div>
          )}
        </div>
      </div>

      {/* Repost modal */}
      {repostModal && (
        <div className="absolute inset-0 z-50 bg-black/30 flex items-end justify-center" onClick={() => { setRepostModal(null); setRepostContent(''); }}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-6 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-slate-800">转发帖子</span>
              <button onClick={() => { setRepostModal(null); setRepostContent(''); }} className="text-slate-400"><X size={20} /></button>
            </div>
            <textarea value={repostContent} onChange={e => setRepostContent(e.target.value)}
              placeholder="说说你的看法..."
              className="w-full min-h-[100px] rounded-2xl border border-stone-200 bg-stone-50 p-4 resize-none text-sm outline-none"
              autoFocus
            />
            <div className="flex justify-end mt-4">
              <button onClick={confirmRepost} className="rounded-full bg-sky-500 text-white px-6 py-2 text-sm font-semibold">转发</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
