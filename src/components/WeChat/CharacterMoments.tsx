import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { Heart, ChevronLeft, MessageCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { generateMomentReply } from '../../lib/ai';

export default function CharacterMoments({ characterId, onBack }: { characterId: string, onBack: () => void }) {
  const { moments, characters, settings, toggleMomentLike, addMomentComment, deleteMoment, deleteMomentComment } = useAppStore();
  const [commentingMomentId, setCommentingMomentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const character = characters[characterId];

  if (!character) return null;

  const isDark = settings.wechatTheme === 'dark';

  const characterMoments = moments.filter(m => m.authorId === characterId);

  const handleAddComment = async (momentId: string) => {
    if (!commentText.trim()) return;
    
    const moment = moments.find(m => m.id === momentId);
    if (!moment) return;
    
    addMomentComment(momentId, 'user', commentText.trim());
    setCommentText('');
    setCommentingMomentId(null);
    
    setIsReplying(true);
    try {
      const reply = await generateMomentReply(characterId, moment.content, commentText.trim());
      setTimeout(() => {
        addMomentComment(momentId, characterId, reply);
      }, 1000 + Math.random() * 2000);
    } catch (e) {
      console.error('Failed to generate moment reply:', e);
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-black' : 'bg-gray-100'}`}>
      <div className={`bg-gray-100 dark:bg-[#191919] px-4 pt-14 pb-3 flex items-center gap-4 border-b dark:border-white/5`}>
        <button onClick={onBack} className="text-slate-800 dark:text-gray-100">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-medium dark:text-gray-100">{character.remark || character.name}的朋友圈</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-14">
        <div className="h-48 bg-gradient-to-b from-blue-500 to-blue-700 dark:from-blue-800 dark:to-blue-950 relative mb-10">
          <div className="absolute -bottom-8 right-4 flex items-end z-10">
            <span className="text-white font-bold text-lg mr-3 mb-1 drop-shadow-lg">{character.remark || character.name}</span>
            <div 
              className="w-14 h-14 rounded-lg border-2 border-white dark:border-black bg-white dark:bg-black shadow-lg"
              style={{ background: character.avatar.startsWith('#') ? character.avatar : `url(${character.avatar}) center/cover` }}
            />
          </div>
        </div>

        <div className="px-4 space-y-4">
          {characterMoments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              暂无朋友圈内容
            </div>
          ) : (
            characterMoments.map(moment => {
              return (
                <div key={moment.id} className={`${isDark ? 'bg-[#1c1c1c] border-white/5' : 'bg-white'} rounded-xl p-4 shadow-sm border`}>
                  <div className="flex gap-3 mb-3">
                    <div 
                      className="w-10 h-10 rounded-md flex-shrink-0"
                      style={{ background: character.avatar.startsWith('#') ? character.avatar : `url(${character.avatar}) center/cover` }}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-[#576b95]">{character.remark || character.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{format(moment.timestamp, 'yyyy年MM月dd日 HH:mm')}</div>
                    </div>
                  </div>
                  
                  <div className="pl-13">
                    {moment.content && <div className="text-[15px] mb-3 whitespace-pre-wrap dark:text-gray-100 leading-relaxed">{moment.content}</div>}
                    {moment.imageUrl && (
                      <div className="mb-3">
                        <img src={moment.imageUrl} alt="moment" className="max-w-[240px] max-h-[320px] object-cover rounded-md shadow-sm" />
                      </div>
                    )}
                    {moment.location && (
                      <div className="text-xs text-[#576b95] mb-3">
                        📍 {moment.location}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400">{format(moment.timestamp, 'HH:mm')}</span>
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => toggleMomentLike(moment.id, 'user')} 
                          className={`flex items-center gap-1.5 transition-colors text-xs ${moment.likes.includes('user') ? 'text-[#576b95]' : 'text-gray-500'}`}
                        >
                          <Heart size={16} className={moment.likes.includes('user') ? 'fill-[#576b95]' : ''} />
                          <span>{moment.likes.length > 0 ? moment.likes.length : ''}</span>
                        </button>
                        <button 
                          onClick={() => setCommentingMomentId(commentingMomentId === moment.id ? null : moment.id)} 
                          className={`flex items-center gap-1.5 text-gray-500 hover:text-[#576b95] transition-colors text-xs ${commentingMomentId === moment.id ? 'text-[#576b95]' : ''}`}
                        >
                          <MessageCircle size={16} />
                          <span>{moment.comments.length > 0 ? moment.comments.length : ''}</span>
                        </button>
                      </div>
                    </div>

                    {commentingMomentId === moment.id && (
                      <div className="mt-2 flex gap-2 items-center">
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="评论..."
                          className={`flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#07c160] transition-all ${
                            isDark 
                              ? 'bg-[#2c2c2c] border-white/10 text-white placeholder-gray-500 focus:bg-[#333]' 
                              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white'
                          }`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddComment(moment.id);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleAddComment(moment.id)}
                          disabled={!commentText.trim() || isReplying}
                          className="px-3 py-1.5 bg-[#07c160] text-white text-sm rounded-lg disabled:opacity-50 transition-all hover:bg-[#06a853] font-medium"
                        >
                          {isReplying ? '发送中' : '发送'}
                        </button>
                      </div>
                    )}

                    {(moment.likes.length > 0 || moment.comments.length > 0) && (
                      <div className="mt-2 bg-[#f7f7f7] dark:bg-[#262626] p-2 rounded-md text-sm">
                        {moment.likes.length > 0 && (
                          <div className="flex items-center gap-1 text-[#576b95] mb-1">
                            <Heart size={12} className="fill-[#576b95]" />
                            <span>{moment.likes.map(id => id === 'user' ? settings.wechatName : (id === characterId ? (character.remark || character.name) : characters[id]?.name)).filter(Boolean).join(', ')}</span>
                          </div>
                        )}
                        {moment.likes.length > 0 && moment.comments.length > 0 && <div className="border-b dark:border-white/5 my-1" />}
                        {moment.comments.map((c, i) => (
                          <div key={i} className="mb-0.5 flex items-start justify-between group">
                            <div className="flex-1">
                              <span className="text-[#576b95] font-medium">{c.authorId === 'user' ? settings.wechatName : (c.authorId === characterId ? (character.remark || character.name) : characters[c.authorId]?.name)}</span>
                              <span className="dark:text-gray-100 ml-0.5">{c.text}</span>
                            </div>
                            {c.authorId === 'user' && (
                              <button
                                onClick={() => {
                                  if (window.confirm('确定删除这条评论吗？')) {
                                    deleteMomentComment(moment.id, i);
                                  }
                                }}
                                className="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
