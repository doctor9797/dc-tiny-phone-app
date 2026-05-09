import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, ImagePlus, MessageCircle, PenSquare, Plus, Send, Trash2, RefreshCcw, Ban, MessagesSquare, Save, SlidersHorizontal, X } from 'lucide-react';
import { ForumComment, ForumPost } from '../../types';
import ImageUploader from '../ImageUploader';
import { generateAIResponse } from '../../lib/ai';
import { BOARD_OPTIONS, FORUM_ICON, USER_HANDLE, generateForumReplyBatch, generateForumSeedPosts, getForumPersonaByHandle, scheduleNextReplyAt } from './forumUtils';

const getCommentDepthMap = (comments: ForumComment[]) => {
  const depthMap = new Map<string, number>();
  const commentMap = new Map(comments.map(comment => [comment.id, comment]));

  const resolveDepth = (comment: ForumComment, seen = new Set<string>()): number => {
    if (depthMap.has(comment.id)) return depthMap.get(comment.id)!;
    if (!comment.replyToId || seen.has(comment.id) || !commentMap.has(comment.replyToId)) {
      depthMap.set(comment.id, 0);
      return 0;
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

export default function ForumApp() {
  const {
    closeApp,
    forumPosts,
    saveForumPost,
    deleteForumPost,
    setNotification,
    addActivityLog,
    characters,
    chats,
    currentApp,
    settings,
    updateSettings,
    sendAdvancedMessage,
    forumDmThreads,
    saveForumDmThread,
    deleteForumDmThread,
  } = useAppStore();
  const [boardId, setBoardId] = useState<(typeof BOARD_OPTIONS)[number]['id']>('gossip');
  const [view, setView] = useState<'feed' | 'compose' | 'detail' | 'dm'>('feed');
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [composeTitle, setComposeTitle] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [composeImage, setComposeImage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [handleDraft, setHandleDraft] = useState(settings.forum?.userHandle || USER_HANDLE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [postRefreshDraft, setPostRefreshDraft] = useState(String(settings.forum?.postRefreshMinutes || 120));
  const [replyRefreshDraft, setReplyRefreshDraft] = useState(String(settings.forum?.replyRefreshMinutes || 45));
  const [dmHandle, setDmHandle] = useState<string | null>(null);
  const [dmSourceId, setDmSourceId] = useState<string | undefined>(undefined);
  const [dmInput, setDmInput] = useState('');
  const [loading, setLoading] = useState(false);
  const userHandle = settings.forum?.userHandle || USER_HANDLE;
  const blockedHandles = settings.forum?.blockedHandles || [];
  const seededRef = useRef(false);

  const boardPosts = useMemo(
    () => forumPosts.filter(post => post.boardId === boardId && !blockedHandles.includes(post.authorHandle)).sort((a, b) => b.updatedAt - a.updatedAt),
    [boardId, blockedHandles, forumPosts]
  );
  const activePost = useMemo(
    () => forumPosts.find(post => post.id === activePostId) || null,
    [activePostId, forumPosts]
  );
  const activePostVisibleComments = useMemo(
    () => activePost ? activePost.comments.filter(comment => !blockedHandles.includes(comment.authorHandle)) : [],
    [activePost, blockedHandles]
  );
  const activePostCommentDepths = useMemo(
    () => getCommentDepthMap(activePostVisibleComments),
    [activePostVisibleComments]
  );
  const replyTargetComment = useMemo(
    () => activePostVisibleComments.find(comment => comment.id === replyTargetId) || null,
    [activePostVisibleComments, replyTargetId]
  );
  const postRefreshMinutes = settings.forum?.postRefreshMinutes || 120;
  const replyRefreshMinutes = settings.forum?.replyRefreshMinutes || 45;
  const activeDmThread = dmHandle ? forumDmThreads[dmHandle] || { handle: dmHandle, sourceId: dmSourceId, messages: [], updatedAt: Date.now() } : null;

  useEffect(() => {
    setHandleDraft(userHandle);
    setPostRefreshDraft(String(postRefreshMinutes));
    setReplyRefreshDraft(String(replyRefreshMinutes));
  }, [userHandle, postRefreshMinutes, replyRefreshMinutes]);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    const seedPosts = async () => {
      const recentChatLines = Object.entries(chats)
        .flatMap(([charId, messages]) => messages.slice(-2).map(msg => `${characters[charId]?.name || charId}:${msg.text}`))
        .slice(-8)
        .join('\n');
      const seedPosts = await generateForumSeedPosts(recentChatLines, 3);
      seedPosts.forEach(post => saveForumPost(post));
      updateSettings({
        forum: {
          ...(settings.forum || {}),
          lastPostRefreshAt: Date.now()
        }
      });
    };

    seedPosts();
  }, [chats, characters, saveForumPost, settings.forum, updateSettings]);

  const refreshFeed = async (targetBoardId: string = boardId, force = false) => {
    const lastRefresh = settings.forum?.lastPostRefreshAt || 0;
    if (!force && Date.now() - lastRefresh < postRefreshMinutes * 60 * 1000) return;
    const recentChatLines = Object.entries(chats)
      .flatMap(([charId, messages]) => messages.slice(-2).map(msg => `${characters[charId]?.name || charId}:${msg.text}`))
      .slice(-8)
      .join('\n');
    const newPosts = await generateForumSeedPosts(recentChatLines, 2, targetBoardId);
    newPosts.forEach(post => saveForumPost(post));
    updateSettings({
      forum: {
        ...(settings.forum || {}),
        lastPostRefreshAt: Date.now()
      }
    });
  };

  const maybeRefreshReplies = async () => {
    const lastRefresh = settings.forum?.lastReplyRefreshAt || 0;
    if (Date.now() - lastRefresh < replyRefreshMinutes * 60 * 1000) return;
    const duePosts = forumPosts.filter(post => post.nextReplyAt && post.nextReplyAt <= Date.now() && (post.subscribed || post.authorHandle === userHandle));
    for (const post of duePosts) {
      const latestUserComment = [...post.comments].reverse().find(comment => comment.authorHandle === userHandle);
      const newComments = (await generateForumReplyBatch(post, latestUserComment))
        .filter(comment => !blockedHandles.includes(comment.authorHandle))
        .map((comment, index) => index === 0 && latestUserComment ? {
          ...comment,
          replyToId: latestUserComment.id,
          replyToHandle: latestUserComment.authorHandle
        } : comment);
      if (!newComments.length) continue;
      const finalPost: ForumPost = {
        ...post,
        comments: [...post.comments, ...newComments],
        updatedAt: Date.now(),
        nextReplyAt: scheduleNextReplyAt(replyRefreshMinutes)
      };
      saveForumPost(finalPost);
      setNotification({
        id: Date.now(),
        title: newComments[0].authorHandle,
        text: `${newComments[0].authorHandle}回复了您的评论`,
        sourceApp: 'forum',
        openApp: currentApp === 'forum' ? undefined : 'forum',
        avatar: FORUM_ICON,
        forumPostId: post.id,
      });
      const sourceCharacterId = newComments[0].authorSourceId;
      if (sourceCharacterId && characters[sourceCharacterId]) {
        sendAdvancedMessage(sourceCharacterId, {
          senderId: sourceCharacterId,
          text: `刚刷到你在论坛发的那条《${post.title}》。\n\n我在下面回你了。\n\n其实我还想多说两句。`
        });
      }
    }
    updateSettings({
      forum: {
        ...(settings.forum || {}),
        lastReplyRefreshAt: Date.now()
      }
    });
  };

  useEffect(() => {
    void refreshFeed();
    void maybeRefreshReplies();
  }, [boardId]);

  const saveHandle = () => {
    const nextHandle = handleDraft.trim();
    if (!nextHandle) return;
    updateSettings({
      forum: {
        ...(settings.forum || {}),
        userHandle: nextHandle
      }
    });
  };

  const saveFrequencySettings = () => {
    const nextPostMinutes = Math.max(5, Number(postRefreshDraft) || postRefreshMinutes);
    const nextReplyMinutes = Math.max(5, Number(replyRefreshDraft) || replyRefreshMinutes);
    updateSettings({
      forum: {
        ...(settings.forum || {}),
        postRefreshMinutes: nextPostMinutes,
        replyRefreshMinutes: nextReplyMinutes,
      }
    });
  };

  const openDm = (handle: string, sourceId?: string) => {
    if (blockedHandles.includes(handle)) return;
    setDmHandle(handle);
    setDmSourceId(sourceId);
    setView('dm');
  };

  const blockHandle = (handle: string) => {
    if (!confirm(`确定拉黑 ${handle} 吗？`)) return;
    updateSettings({
      forum: {
        ...(settings.forum || {}),
        blockedHandles: Array.from(new Set([...(settings.forum?.blockedHandles || []), handle]))
      }
    });
    if (dmHandle === handle) {
      setDmHandle(null);
      setView('feed');
    }
  };

  const sendDm = async () => {
    if (!dmHandle || !dmInput.trim() || blockedHandles.includes(dmHandle)) return;
    const now = Date.now();
    const baseThread = forumDmThreads[dmHandle] || { handle: dmHandle, sourceId: dmSourceId, messages: [], updatedAt: now };
    const userMessage = { id: `${now}_user`, sender: 'user' as const, text: dmInput.trim(), createdAt: now };
    const nextThread = {
      ...baseThread,
      sourceId: baseThread.sourceId || dmSourceId,
      messages: [...baseThread.messages, userMessage],
      updatedAt: now
    };
    saveForumDmThread(nextThread);
    const outgoingText = dmInput.trim();
    setDmInput('');
    setLoading(true);

    try {
      const persona = getForumPersonaByHandle(dmHandle);
      const prompt = `你正在扮演论坛匿名用户 ${dmHandle} 与我私信。
你的匿名气质：${persona?.vibe || '普通但真实的论坛用户'}
如果你有对应真实角色，也不要直接暴露真实身份。
最近对话：
${nextThread.messages.slice(-6).map(message => `${message.sender === 'user' ? userHandle : dmHandle}: ${message.text}`).join('\n')}

现在我发来的新消息是：
${userHandle}: ${outgoingText}

请你只回复 1 段简短自然的私信内容，像真人，不要 Markdown，不要括号动作。`;
      const replyText = (await generateAIResponse(prompt)).trim();
      saveForumDmThread({
        ...nextThread,
        messages: [
          ...nextThread.messages,
          { id: `${Date.now()}_other`, sender: 'other', text: replyText, createdAt: Date.now() }
        ],
        updatedAt: Date.now()
      });
    } catch {
      saveForumDmThread({
        ...nextThread,
        messages: [
          ...nextThread.messages,
          { id: `${Date.now()}_other`, sender: 'other', text: '我刚看到，晚点再和你说。', createdAt: Date.now() }
        ],
        updatedAt: Date.now()
      });
    } finally {
      setLoading(false);
    }
  };

  const openPost = async (post: ForumPost) => {
    setActivePostId(post.id);
    setView('detail');

    saveForumPost({ ...post, visitCount: (post.visitCount || 0) + 1 });
  };

  const handlePublishPost = () => {
    if (!composeContent.trim()) return;
    const now = Date.now();
    const newPost: ForumPost = {
      id: `${now}_forum_user`,
      boardId,
      authorHandle: userHandle,
      title: composeTitle.trim() || '无题',
      content: composeContent.trim(),
      imageUrl: composeImage || undefined,
      createdAt: now,
      updatedAt: now,
      comments: [],
      visitCount: 0,
      subscribed: true,
      nextReplyAt: scheduleNextReplyAt(replyRefreshMinutes),
    };
    saveForumPost(newPost);
    addActivityLog({
      id: `${now}_forum_post`,
      title: `论坛发帖：${newPost.title}`,
      detail: newPost.content.slice(0, 60),
      timestamp: now
    });
    setComposeTitle('');
    setComposeContent('');
    setComposeImage('');
    setView('feed');
  };

  const handleReply = () => {
    if (!activePost || !replyText.trim()) return;
    const now = Date.now();
    const nextPost: ForumPost = {
      ...activePost,
      comments: [
        ...activePost.comments,
        {
          id: `${now}_user_reply`,
          authorHandle: userHandle,
          text: replyText.trim(),
          createdAt: now,
          replyToId: replyTargetComment?.id,
          replyToHandle: replyTargetComment?.authorHandle,
        },
      ],
      updatedAt: now,
      subscribed: true,
      nextReplyAt: scheduleNextReplyAt(replyRefreshMinutes),
    };
    saveForumPost(nextPost);
    addActivityLog({
      id: `${now}_forum_reply`,
      title: `论坛回复：${activePost.title}`,
      detail: replyText.trim().slice(0, 60),
      timestamp: now
    });
    setReplyText('');
    setReplyTargetId(null);
  };

  const boardMeta = BOARD_OPTIONS.find(board => board.id === boardId);

  if (view === 'compose') {
    return (
      <div className="h-full flex flex-col bg-[#f5f1eb]">
        <div className="px-4 pt-12 pb-4 flex items-center justify-between border-b border-stone-200 bg-[#fcfaf7]">
          <button onClick={() => setView('feed')}><ChevronLeft size={28} /></button>
          <div className="font-black text-slate-800">发帖</div>
          <button onClick={handlePublishPost} className="text-sm font-bold text-amber-700">发布</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-[2rem] border border-stone-200 bg-white p-4 space-y-4 shadow-sm">
            <div className="text-sm font-bold text-slate-700">当前分论坛：{boardMeta?.name}</div>
            <input
              value={composeTitle}
              onChange={e => setComposeTitle(e.target.value)}
              placeholder="标题"
              className="w-full rounded-2xl border border-stone-200 bg-stone-50 p-3"
            />
            <textarea
              value={composeContent}
              onChange={e => setComposeContent(e.target.value)}
              placeholder="写点真实的东西，像真正在论坛里发帖一样。"
              className="w-full min-h-[220px] rounded-[1.6rem] border border-stone-200 bg-stone-50 p-4 resize-none leading-7"
            />
            <ImageUploader onImageSelected={setComposeImage}>
              <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm font-bold text-slate-600 flex items-center justify-center gap-2">
                <ImagePlus size={16} />
                {composeImage ? '更换帖子图片' : '给帖子加图片'}
              </div>
            </ImageUploader>
            {composeImage && <img src={composeImage} alt="" className="w-full h-44 object-cover rounded-[1.5rem] border border-stone-200" />}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'dm' && activeDmThread && dmHandle) {
    return (
      <div className="h-full flex flex-col bg-[#f5f1eb]">
        <div className="px-4 pt-12 pb-4 flex items-center justify-between border-b border-stone-200 bg-[#fcfaf7]">
          <button onClick={() => setView('feed')}><ChevronLeft size={28} /></button>
          <div className="font-black text-slate-800">{dmHandle}</div>
          <div className="flex items-center gap-3">
            <button onClick={() => blockHandle(dmHandle)} className="text-slate-500"><Ban size={18} /></button>
            <button onClick={() => { if (confirm('确定删除和这个用户的私信记录吗？')) deleteForumDmThread(dmHandle); }} className="text-rose-500"><Trash2 size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeDmThread.messages.map(message => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[84%] rounded-[1.5rem] px-4 py-3 ${message.sender === 'user' ? 'bg-slate-900 text-white' : 'bg-white border border-stone-200 text-slate-700'}`}>
                <div className="text-sm leading-7 whitespace-pre-wrap">{message.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-stone-200 bg-[#fcfaf7] p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={dmInput}
              onChange={e => setDmInput(e.target.value)}
              placeholder={`发私信给 ${dmHandle}`}
              className="flex-1 min-h-[52px] max-h-28 rounded-[1.5rem] border border-stone-200 bg-white p-3 resize-none"
            />
            <button onClick={() => void sendDm()} disabled={!dmInput.trim() || loading} className="rounded-[1.4rem] bg-slate-900 text-white px-4 py-3 font-bold disabled:opacity-50">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && activePost) {
    return (
      <div className="h-full flex flex-col bg-[#f5f1eb]">
        <div className="px-4 pt-12 pb-4 flex items-center justify-between border-b border-stone-200 bg-[#fcfaf7]">
          <button onClick={() => setView('feed')}><ChevronLeft size={28} /></button>
          <div className="font-black text-slate-800 line-clamp-1 px-3">{activePost.title}</div>
          {activePost.authorHandle === userHandle ? (
            <button onClick={() => { if (confirm('确定删除这篇帖子吗？')) { deleteForumPost(activePost.id); setView('feed'); } }} className="text-rose-500">
              <Trash2 size={18} />
            </button>
          ) : (
            <div className="w-5" />
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-[2rem] border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-400">{BOARD_OPTIONS.find(board => board.id === activePost.boardId)?.name}</div>
                <div className="text-lg font-black text-slate-800 mt-1">{activePost.title}</div>
              </div>
              <div className="text-xs text-slate-400">{new Date(activePost.createdAt).toLocaleString()}</div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-amber-700">{activePost.authorHandle}</div>
              {activePost.authorHandle !== userHandle && !blockedHandles.includes(activePost.authorHandle) && (
                <div className="flex items-center gap-3 text-slate-500">
                  <button onClick={() => openDm(activePost.authorHandle, activePost.authorSourceId)}><MessagesSquare size={16} /></button>
                  <button onClick={() => blockHandle(activePost.authorHandle)}><Ban size={16} /></button>
                </div>
              )}
            </div>
            <div className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-slate-700">{activePost.content}</div>
            {activePost.imageUrl && <img src={activePost.imageUrl} alt="" className="mt-4 w-full h-56 object-cover rounded-[1.4rem] border border-stone-200" />}
          </div>

          <div className="space-y-3">
            {activePostVisibleComments.map(comment => {
              const depth = activePostCommentDepths.get(comment.id) || 0;
              return (
                <div
                  key={comment.id}
                  className="relative"
                  style={{ marginLeft: `${Math.min(depth, 4) * 18}px` }}
                >
                  {depth > 0 && (
                    <div
                      className="absolute left-[-12px] top-0 bottom-0 w-px bg-stone-200"
                      style={{ opacity: 0.9 }}
                    />
                  )}
                  <div className={`rounded-[1.4rem] border p-3 ${comment.authorHandle === userHandle ? 'bg-amber-50 border-amber-100' : 'bg-white border-stone-200'}`}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-black text-slate-800">{comment.authorHandle}</div>
                        {comment.authorHandle !== userHandle && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <button onClick={() => openDm(comment.authorHandle, comment.authorSourceId)}><MessagesSquare size={14} /></button>
                            <button onClick={() => blockHandle(comment.authorHandle)}><Ban size={14} /></button>
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{new Date(comment.createdAt).toLocaleString()}</div>
                    </div>
                    {comment.replyToHandle && (
                      <div className="text-[11px] text-slate-400 mb-1">↳ 回复 {comment.replyToHandle}</div>
                    )}
                    <div className="text-sm leading-7 text-slate-700">{comment.text}</div>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => setReplyTargetId(comment.id)}
                        className="text-xs text-slate-500 font-semibold"
                      >
                        回复
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="border-t border-stone-200 bg-[#fcfaf7] p-3">
          {replyTargetComment && (
            <div className="mb-2 rounded-2xl bg-stone-100 border border-stone-200 px-3 py-2 flex items-center justify-between gap-3 text-xs text-slate-500">
              <div className="truncate">正在回复 {replyTargetComment.authorHandle}</div>
              <button onClick={() => setReplyTargetId(null)} className="text-slate-400">取消</button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder={replyTargetComment ? `回复 ${replyTargetComment.authorHandle}...` : '在这个帖子下回复...'}
              className="flex-1 min-h-[52px] max-h-28 rounded-[1.5rem] border border-stone-200 bg-white p-3 resize-none"
            />
            <button onClick={handleReply} disabled={!replyText.trim() || loading} className="rounded-[1.4rem] bg-slate-900 text-white px-4 py-3 font-bold disabled:opacity-50">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#f5f1eb]">
      <div className="px-4 pt-12 pb-4 flex items-center justify-between border-b border-stone-200 bg-[#fcfaf7]">
        <button onClick={closeApp}><ChevronLeft size={28} /></button>
        <div className="font-black text-slate-800">论坛</div>
        <div className="flex items-center gap-3">
          <button onClick={() => setView('compose')} className="text-slate-700">
            <PenSquare size={20} />
          </button>
          <button onClick={() => setSettingsOpen(true)} className="text-slate-700">
            <SlidersHorizontal size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {BOARD_OPTIONS.map(board => (
          <button
            key={board.id}
            onClick={() => setBoardId(board.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${boardId === board.id ? 'bg-slate-900 text-white' : 'bg-white border border-stone-200 text-slate-600'}`}
          >
            {board.name}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3 pb-2 text-xs text-slate-400">{boardMeta?.desc}</div>
      {Object.values(forumDmThreads).filter(thread => !blockedHandles.includes(thread.handle)).length > 0 && (
        <div className="px-4 pb-3 overflow-x-auto no-scrollbar">
          <div className="flex gap-2">
            {Object.values(forumDmThreads)
              .filter(thread => !blockedHandles.includes(thread.handle))
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map(thread => (
                <button
                  key={thread.handle}
                  onClick={() => openDm(thread.handle, thread.sourceId)}
                  className="shrink-0 rounded-full bg-white border border-stone-200 px-3 py-2 text-xs text-slate-600"
                >
                  私信 · {thread.handle}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        <button
          onClick={() => setView('compose')}
          className="w-full rounded-[1.7rem] border border-dashed border-stone-300 bg-white/80 px-4 py-4 text-left text-slate-500 flex items-center gap-2"
        >
          <Plus size={18} />
          在 {boardMeta?.name} 发一条新帖
        </button>

        {boardPosts.map(post => (
          <button key={post.id} onClick={() => openPost(post)} className="w-full text-left rounded-[1.8rem] border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-800 truncate">{post.title}</div>
                <div className="mt-1 text-xs text-amber-700 font-bold">{post.authorHandle}</div>
              </div>
              <div className="text-[11px] text-slate-400 shrink-0">{new Date(post.updatedAt).toLocaleDateString()}</div>
            </div>
            <div className="mt-2 line-clamp-3 text-sm leading-7 text-slate-600">{post.content}</div>
            {post.imageUrl && <img src={post.imageUrl} alt="" className="mt-3 h-36 w-full rounded-[1.3rem] object-cover border border-stone-200" />}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <MessageCircle size={14} />
              {post.comments.length} 条评论
            </div>
          </button>
        ))}
      </div>
      {settingsOpen && (
        <div className="absolute inset-0 z-40 bg-black/28 flex items-end">
          <div className="w-full rounded-t-[2rem] bg-[#fcfaf7] border-t border-stone-200 px-4 pt-4 pb-6 max-h-[78%] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="font-black text-slate-800">论坛设置</div>
              <button onClick={() => setSettingsOpen(false)} className="text-slate-500"><X size={20} /></button>
            </div>

            <div className="rounded-[1.6rem] border border-stone-200 bg-white p-4 mb-4">
              <div className="text-sm font-black text-slate-800 mb-3">名称</div>
              <div className="rounded-[1.2rem] bg-stone-50 border border-stone-200 px-3 py-3 flex items-center gap-2">
                <MessagesSquare size={15} className="text-slate-400 shrink-0" />
                <input
                  value={handleDraft}
                  onChange={e => setHandleDraft(e.target.value)}
                  placeholder="论坛昵称"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
                <button onClick={saveHandle} className="text-slate-600"><Save size={15} /></button>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-stone-200 bg-white p-4 mb-4">
              <div className="text-sm font-black text-slate-800 mb-3">刷新频率</div>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-500 mb-2">帖子刷新频率</div>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {[30, 60, 120, 240].map(value => (
                      <button
                        key={value}
                        onClick={() => setPostRefreshDraft(String(value))}
                        className={`px-3 py-2 rounded-full text-xs ${Number(postRefreshDraft) === value ? 'bg-slate-900 text-white' : 'bg-stone-100 text-slate-600'}`}
                      >
                        {value >= 60 ? `${value / 60}小时` : `${value}分钟`}
                      </button>
                    ))}
                  </div>
                  <input
                    value={postRefreshDraft}
                    onChange={e => setPostRefreshDraft(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="自定义分钟数"
                    className="w-full rounded-[1.1rem] border border-stone-200 bg-stone-50 px-3 py-3 text-sm"
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-2">回复频率</div>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {[15, 30, 45, 90].map(value => (
                      <button
                        key={value}
                        onClick={() => setReplyRefreshDraft(String(value))}
                        className={`px-3 py-2 rounded-full text-xs ${Number(replyRefreshDraft) === value ? 'bg-slate-900 text-white' : 'bg-stone-100 text-slate-600'}`}
                      >
                        {value >= 60 ? `${value / 60}小时` : `${value}分钟`}
                      </button>
                    ))}
                  </div>
                  <input
                    value={replyRefreshDraft}
                    onChange={e => setReplyRefreshDraft(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="自定义分钟数"
                    className="w-full rounded-[1.1rem] border border-stone-200 bg-stone-50 px-3 py-3 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveFrequencySettings} className="flex-1 rounded-[1.2rem] bg-slate-900 text-white py-3 text-sm font-bold">保存频率</button>
                <button onClick={() => { void refreshFeed(boardId, true); }} className="rounded-[1.2rem] bg-stone-100 text-slate-700 px-4 py-3 text-sm font-bold flex items-center gap-2">
                  <RefreshCcw size={14} />
                  刷新当前分区
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
