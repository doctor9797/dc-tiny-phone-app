import { useState } from 'react';
import { Camera, Heart, MessageCircle, X, ChevronLeft } from 'lucide-react';
import type { MomentPost } from './data';

interface Props {
  posts: MomentPost[];
  ownerName: string;
  ownerAvatar: string;
  ownerCover?: string;
  isDark: boolean;
  onBack?: () => void;
  onPost: (content: string) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - ts) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 172800) return '昨天';
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function formatDetailTime(ts: number): string {
  const d = new Date(ts);
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
    d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

export default function MomentsApp({ posts, ownerName, ownerAvatar, ownerCover, isDark, onBack, onPost }: Props) {
  const [showPost, setShowPost] = useState(false);
  const [postText, setPostText] = useState('');
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  const handlePost = () => {
    if (postText.trim()) {
      onPost(postText.trim());
      setPostText('');
      setShowPost(false);
    }
  };

  const sorted = [...posts].sort((a, b) => b.timestamp - a.timestamp);
  const seen = new Set<string>();
  const unique = sorted.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

  return (
    <div className={'h-full flex flex-col ' + (isDark ? 'bg-black' : 'bg-gray-100')}>
      {/* Nav bar */}
      <div className={'shrink-0 flex items-center justify-between px-4 pt-7 pb-2 ' + (isDark ? 'bg-black text-white' : 'bg-white text-black')}>
        <button onClick={onBack} className="text-blue-500 p-1 -ml-1">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[17px] font-medium">朋友圈</h1>
        <button onClick={() => setShowPost(true)} className="text-blue-500 p-1 -mr-1">
          <Camera size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Cover banner */}
        <div className="h-32 shrink-0 bg-gradient-to-b from-blue-500 to-blue-700 relative mb-14 bg-cover bg-center"
          style={ownerCover ? { backgroundImage: 'url(' + ownerCover + ')', backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          <div className="absolute -bottom-10 right-4 flex items-end z-10">
            <span className="text-white font-bold text-xl mr-3 mb-1 drop-shadow-lg">{ownerName}</span>
            <div
              className="w-16 h-16 rounded-lg border-2 border-white shadow-lg"
              style={{ background: ownerAvatar.startsWith('#') ? ownerAvatar : 'url(' + ownerAvatar + ') center/cover', backgroundColor: ownerAvatar.startsWith('#') ? ownerAvatar : '#ccc' }}
            />
          </div>
        </div>

        {/* Posts */}
        <div className="px-4 space-y-4">
          {unique.length === 0 && (
            <div className="text-center mt-10 text-gray-400 text-sm">暂无朋友圈内容</div>
          )}
          {unique.map(post => (
            <div key={post.id} className={'rounded-xl p-4 shadow-sm border ' + (isDark ? 'bg-[#1c1c1c] border-white/5' : 'bg-white border-gray-100')}>
              <div className="flex gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-md flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
                  style={{ background: post.authorAvatar.startsWith('#') ? post.authorAvatar : 'url(' + post.authorAvatar + ') center/cover', backgroundColor: post.authorAvatar.startsWith('#') ? post.authorAvatar : '#999' }}
                >
                  {post.authorName[0]}
                </div>
                <div className="flex-1 flex justify-between">
                  <div>
                    <div className="font-medium text-sm text-[#576b95]">{post.authorName}</div>
                    <div className={'text-xs mt-0.5 ' + (isDark ? 'text-gray-500' : 'text-gray-400')}>{formatDetailTime(post.timestamp)}</div>
                  </div>
                </div>
              </div>

              <div className="pl-13">
                <div className={'text-[15px] mb-3 whitespace-pre-wrap leading-relaxed ' + (isDark ? 'text-gray-100' : 'text-gray-800')}>
                  {post.content}
                </div>

                <div className="flex justify-between items-center">
                  <span className={'text-xs ' + (isDark ? 'text-gray-500' : 'text-gray-400')}>{formatTime(post.timestamp)}</span>
                  <div className="flex items-center gap-4">
                    <span className={'flex items-center gap-1 text-xs ' + (isDark ? 'text-gray-500' : 'text-gray-400')}>
                      <Heart size={16} />
                    </span>
                    <button
                      onClick={() => setCommentingPostId(commentingPostId === post.id ? null : post.id)}
                      className={'flex items-center gap-1 text-xs ' + (isDark ? 'text-gray-500' : 'text-gray-400') + ' hover:text-[#576b95] ' + (commentingPostId === post.id ? 'text-[#576b95]' : '')}
                    >
                      <MessageCircle size={16} />
                      {post.comments && post.comments.filter(c => c.text.trim()).length > 0 && <span>{post.comments.filter(c => c.text.trim()).length}</span>}
                    </button>
                  </div>
                </div>

                {(post.comments && post.comments.some(c => c.text.trim())) || commentingPostId === post.id ? (
                  <div className={'mt-2 rounded-md text-sm overflow-hidden ' + (isDark ? 'bg-[#262626]' : 'bg-[#f7f7f7]')}>
                    {post.comments && post.comments.map((c, i) => (
                      c.text.trim() ? (
                        <div key={i} className={'px-3 py-1.5 leading-relaxed text-sm ' + (isDark ? 'text-gray-300' : 'text-gray-700')}>
                          <span className="text-[#576b95]">{c.authorName}</span>
                          <span>: {c.text}</span>
                        </div>
                      ) : null
                    ))}

                    {commentingPostId === post.id && (
                      <div className={'flex items-center gap-1.5 px-2 py-1.5 border-t ' + (isDark ? 'border-white/10 bg-[#2c2c2c]' : 'border-gray-200 bg-white')}>
                        <input
                          type="text"
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          placeholder="评论..."
                          className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (commentText.trim()) {
                                setCommentText('');
                                setCommentingPostId(null);
                              }
                            }
                          }}
                        />
                        <button
                          onClick={() => { setCommentText(''); setCommentingPostId(null); }}
                          className="text-xs shrink-0 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Post modal */}
      {showPost && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black/70">
          <div className={'mt-auto p-4 ' + (isDark ? 'bg-gray-900' : 'bg-white')}>
            <textarea
              className={'w-full p-3 rounded-lg border text-sm resize-none h-24 outline-none ' +
                (isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-black')
              }
              placeholder="说点什么..."
              value={postText}
              onChange={e => setPostText(e.target.value)}
            />
            <div className="flex justify-end space-x-3 mt-3">
              <button onClick={() => { setShowPost(false); setPostText(''); }} className="px-4 py-2 text-sm text-gray-500">
                取消
              </button>
              <button onClick={handlePost} className="px-4 py-2 text-sm text-white bg-[#07C160] rounded-lg">
                发表
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
