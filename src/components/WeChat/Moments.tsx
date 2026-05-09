import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '../../store';
import { Camera, Heart, ChevronRight, MessageCircle, MoreHorizontal, Trash2, Send, X, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import { generateAIResponse, generateMomentReply } from '../../lib/ai';
import { pinyin } from 'pinyin-pro';

import ImageUploader from '../ImageUploader';

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = '确认', cancelText = '取消', isDark }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDark: boolean;
}) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} rounded-2xl p-6 w-[280px] shadow-2xl`}>
        <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
        <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              isDark 
                ? 'bg-white/10 text-white hover:bg-white/20' 
                : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
            }`}
          >
            {cancelText}
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 py-3 rounded-xl font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Moments() {
  const { moments, characters, settings, updateSettings, closeApp, addMoment, toggleMomentLike, addMomentComment, deleteMoment, deleteMomentComment } = useAppStore();
  const [showPost, setShowPost] = useState(false);
  const [commentingMomentId, setCommentingMomentId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ authorId: string, text: string } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [showOptions, setShowOptions] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ type: 'moment' | 'comment'; momentId?: string; index?: number } | null>(null);
  
  const isDark = settings.wechatTheme === 'dark';

  const handleAddComment = async (momentId: string) => {
    if (!commentText.trim()) return;
    
    const moment = moments.find(m => m.id === momentId);
    if (!moment) return;
    
    let finalText = commentText.trim();
    if (replyingTo) {
      const authorName = replyingTo.authorId === 'user' ? settings.wechatName : characters[replyingTo.authorId]?.name;
      if (authorName) {
        finalText = `回复 ${authorName}: ${finalText}`;
      }
    }
    
    addMomentComment(momentId, 'user', finalText);
    setCommentText('');
    setCommentingMomentId(null);
    setReplyingTo(null);
    
    if (moment.authorId !== 'user') {
      setIsReplying(true);
      try {
        const reply = await generateMomentReply(moment.authorId, moment.content, commentText.trim());
        setTimeout(() => {
          addMomentComment(momentId, moment.authorId, reply);
        }, 1000 + Math.random() * 2000);
      } catch (e) {
        console.error('Failed to generate moment reply:', e);
      } finally {
        setIsReplying(false);
      }
    }
  };

  const handleDeleteMoment = (momentId: string) => {
    setDeleteModal({ type: 'moment', momentId });
  };

  const handleDeleteComment = (momentId: string, index: number) => {
    setDeleteModal({ type: 'comment', momentId, index });
  };

  const confirmDelete = () => {
    if (!deleteModal) return;
    
    if (deleteModal.type === 'moment' && deleteModal.momentId) {
      deleteMoment(deleteModal.momentId);
      setShowOptions(null);
    } else if (deleteModal.type === 'comment' && deleteModal.momentId !== undefined && deleteModal.index !== undefined) {
      deleteMomentComment(deleteModal.momentId, deleteModal.index);
    }
    
    setDeleteModal(null);
  };

  if (showPost) {
    return <PostMoment onBack={() => setShowPost(false)} />;
  }

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-black">
      <ConfirmModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={confirmDelete}
        title={deleteModal?.type === 'moment' ? '删除朋友圈' : '删除评论'}
        message={deleteModal?.type === 'moment' ? '确定要删除这条朋友圈吗？' : '确定要删除这条评论吗？'}
        confirmText="删除"
        isDark={isDark}
      />
      
      <div className="bg-gray-100 dark:bg-[#191919] px-4 pt-14 pb-3 flex items-center justify-between z-10 border-b dark:border-white/5">
        <div className="w-8"></div>
        <h1 className="text-lg font-medium dark:text-gray-100">朋友圈</h1>
        <button className="w-8 flex justify-end text-slate-800 dark:text-gray-100" onClick={() => setShowPost(true)}><Camera size={24} /></button>
      </div>

      <div className="flex-1 overflow-y-auto pb-14">
        <ImageUploader 
          onImageSelected={(url) => updateSettings({ wechatMomentsBg: url })}
          className="h-60 bg-gradient-to-b from-blue-500 to-blue-700 dark:from-blue-800 dark:to-blue-950 relative mb-14 cursor-pointer bg-cover bg-center"
        >
          {settings.wechatMomentsBg && (
             <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${settings.wechatMomentsBg})` }} />
          )}
          <div className="absolute -bottom-10 right-4 flex items-end z-10">
            <span className="text-white font-bold text-xl mr-3 mb-1 drop-shadow-lg">{settings.wechatName}</span>
            <div 
              className="w-16 h-16 rounded-lg border-2 border-white dark:border-black bg-white dark:bg-black shadow-lg"
              style={{ background: settings.wechatAvatar.startsWith('#') ? settings.wechatAvatar : `url(${settings.wechatAvatar}) center/cover` }}
            />
          </div>
        </ImageUploader>

        <div className="px-4 space-y-4">
          {moments.map(moment => {
            const isUser = moment.authorId === 'user';
            const author = isUser ? { name: settings.wechatName, avatar: settings.wechatAvatar, momentsBackground: settings.wechatMomentsBg } : characters[moment.authorId];
            if (!author) return null;
            const charBackground = !isUser && (author as any).momentsBackground;
            
            return (
              <div key={moment.id} className="bg-white dark:bg-[#1c1c1c] rounded-xl p-4 shadow-sm border dark:border-white/5">
                {charBackground && (
                  <div 
                    className="h-16 -mt-4 -mx-4 mb-3 rounded-t-xl bg-cover bg-center opacity-80"
                    style={{ backgroundImage: `url(${charBackground})` }}
                  />
                )}
                <div className="flex gap-3 mb-3">
                  <div 
                    className="w-10 h-10 rounded-md flex-shrink-0"
                    style={{ background: author.avatar.startsWith('#') ? author.avatar : `url(${author.avatar}) center/cover` }}
                  />
                  <div className="flex-1 flex justify-between">
                    <div>
                      <div className="font-medium text-[#576b95]">{author.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{format(moment.timestamp, 'yyyy年MM月dd日 HH:mm')}</div>
                    </div>
                  </div>
                </div>
                
                <div className="pl-13">
                  {moment.content && <div className="text-[15px] mb-3 whitespace-pre-wrap dark:text-gray-100 leading-relaxed">{moment.content}</div>}
                  {moment.imageUrl && (
                    <div className="mb-3">
                      <img src={moment.imageUrl} alt="moment" className="max-w-[240px] max-h-[320px] object-cover rounded-md shadow-sm" />
                    </div>
                  )}
                  {moment.musicUrl && (
                    <div className="bg-gray-100 dark:bg-[#2c2c2c] p-2 flex items-center gap-2 mb-3 rounded border dark:border-white/5">
                      <div className="w-10 h-10 bg-gray-300 dark:bg-zinc-700 rounded flex items-center justify-center text-xs dark:text-gray-400">
                        Music
                      </div>
                      <div className="text-sm truncate flex-1 dark:text-gray-200">{moment.musicUrl}</div>
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
                      {isUser && (
                        <button 
                          onClick={() => handleDeleteMoment(moment.id)}
                          className="text-gray-500 hover:text-red-500 transition-colors text-xs"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {commentingMomentId === moment.id && (
                    <div className="mt-2 flex gap-2 items-center">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder={replyingTo ? `回复 ${replyingTo.authorId === 'user' ? settings.wechatName : characters[replyingTo.authorId]?.name}...` : '评论...'}
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
                      {replyingTo && (
                        <button
                          onClick={() => setReplyingTo(null)}
                          className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                          取消
                        </button>
                      )}
                      <button
                        onClick={() => handleAddComment(moment.id)}
                        disabled={!commentText.trim() || isReplying}
                        className="px-4 py-2 bg-[#07c160] text-white text-sm rounded-lg disabled:opacity-50 transition-all hover:bg-[#06a853] font-medium"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  )}

                  {(moment.likes.length > 0 || moment.comments.length > 0) && (
                    <div className="mt-2 bg-[#f7f7f7] dark:bg-[#262626] p-2 rounded-md text-sm">
                      {moment.likes.length > 0 && (
                        <div className="flex items-center gap-1 text-[#576b95] mb-1">
                          <Heart size={12} className="fill-[#576b95]" />
                          <span>{moment.likes.map(id => id === 'user' ? settings.wechatName : characters[id]?.name).filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                      {moment.likes.length > 0 && moment.comments.length > 0 && <div className="border-b dark:border-white/5 my-1" />}
                      {moment.comments.map((c, i) => (
                        <div key={i} className="mb-0.5 flex items-start justify-between group">
                          <div className="flex-1">
                            <span 
                              className="text-[#576b95] font-medium cursor-pointer hover:bg-[#eaeaea] dark:hover:bg-[#333] rounded px-0.5"
                              onClick={() => {
                                if (c.authorId !== 'user') {
                                  setCommentingMomentId(moment.id);
                                  setReplyingTo(c);
                                }
                              }}
                            >
                              {c.authorId === 'user' ? settings.wechatName : characters[c.authorId]?.name}
                            </span>
                            <span className="dark:text-gray-100 ml-0.5">{c.text}</span>
                          </div>
                          {c.authorId === 'user' && (
                            <button
                              onClick={() => handleDeleteComment(moment.id, i)}
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
          })}
        </div>
      </div>
    </div>
  );
}

function PostMoment({ onBack }: { onBack: () => void }) {
  const { addMoment, characters, addMomentComment, toggleMomentLike, receiveMessage } = useAppStore();
  const { settings } = useAppStore();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [musicUrl, setMusicUrl] = useState('');
  const [location, setLocation] = useState('');
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [showContactSelector, setShowContactSelector] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [touchStartIndex, setTouchStartIndex] = useState<number | null>(null);
  
  const isDark = settings.wechatTheme === 'dark';
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      if (images.length >= 9) return;
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max_size = 800;
          if (width > max_size || height > max_size) {
            if (width > height) {
              height = Math.round((height * max_size) / width);
              width = max_size;
            } else {
              width = Math.round((width * max_size) / height);
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setImages(prev => [...prev, dataUrl]);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    setImages(prev => {
      const newImages = [...prev];
      const [removed] = newImages.splice(draggedIndex, 1);
      newImages.splice(index, 0, removed);
      return newImages;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleTouchStart = (index: number) => {
    setTouchStartIndex(index);
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent, index: number) => {
    e.preventDefault();
    if (touchStartIndex === null) return;
    
    const touch = e.touches[0];
    const container = e.currentTarget.parentElement;
    if (!container) return;
    
    const children = Array.from(container.children) as HTMLElement[];
    const currentIndex = children.findIndex(child => {
      const rect = child.getBoundingClientRect();
      return touch.clientX >= rect.left && 
             touch.clientX <= rect.right &&
             touch.clientY >= rect.top && 
             touch.clientY <= rect.bottom;
    });
    
    if (currentIndex !== -1 && currentIndex !== draggedIndex) {
      setImages(prev => {
        const newImages = [...prev];
        const [removed] = newImages.splice(draggedIndex, 1);
        newImages.splice(currentIndex, 0, removed);
        return newImages;
      });
      setDraggedIndex(currentIndex);
    }
  };

  const handleTouchEnd = () => {
    setTouchStartIndex(null);
    setDraggedIndex(null);
  };

  const { grouped, letters } = useMemo(() => {
    const chars = Object.values(characters).filter(c=>(c as any).isDisabled !== true).filter(c => c.isWeChatFriend !== false);
    const getPinyinStr = (str: string) => str ? pinyin(str, { toneType: 'none', type: 'string' }).replace(/\s/g, '').toUpperCase() : '';
    const grouped: Record<string, typeof chars> = {};
    chars.forEach(c => {
      const initial = /[A-Z]/.test(getPinyinStr(c.remark || c.name).charAt(0)) ? getPinyinStr(c.remark || c.name).charAt(0) : '#';
      if (!grouped[initial]) grouped[initial] = [];
      grouped[initial].push(c);
    });
    Object.keys(grouped).forEach(k => grouped[k].sort((a,b) => getPinyinStr(a.remark || a.name).localeCompare(getPinyinStr(b.remark || b.name))));
    const letters = Object.keys(grouped).sort((a,b) => a==='#'?1:b==='#'?-1:a.localeCompare(b));
    return { grouped, letters };
  }, [characters]);

  const handlePost = async () => {
    if (!content && images.length === 0 && !musicUrl) return;
    setIsPosting(true);
    
    const newMoment = {
      authorId: 'user',
      content,
      imageUrl: images[0] || '',
      musicUrl,
      location,
    };
    
    addMoment(newMoment);
    
    if (selectedChars.length > 0) {
      setTimeout(async () => {
        const state = useAppStore.getState();
        const momentId = state.moments[0].id;
        
        for (const charId of selectedChars) {
          const char = characters[charId];
          if (Math.random() > 0.3) {
            toggleMomentLike(momentId, charId);
          }
          
          try {
            const prompt = `用户发了一条朋友圈。内容是：${content}。图片数量：${images.length}张。音乐链接：${musicUrl}。位置：${location}。请你以${char.name}的身份，根据你们的关系（${char.relationship}）和性格，给这条朋友圈写一条简短的评论。只输出评论内容。`;
            const reply = await generateAIResponse(prompt);
            addMomentComment(momentId, charId, reply);
          } catch (e) {
            console.error(e);
          }
          
          try {
            const privatePrompt = `用户刚刚发了一条朋友圈，内容是："${content}"。图片${images.length}张。请你以${char.name}的身份，根据你们的关系（${char.relationship}）、${char.name}的性格（${char.personality}），判断是否应该给用户发私信讨论这条朋友圈。
            
            如果你觉得不应该发私信，只输出"不发"。
            如果你觉得应该发私信，根据你们的关系和这条朋友圈的内容，输出${char.name}会私聊用户说的一句话。要求自然、符合微信聊天风格，不要太长，10-30字左右。`;
            
            const privateReply = await generateAIResponse(privatePrompt);
            
            if (privateReply.trim() !== '不发' && privateReply.trim()) {
              const delayMs = (5 + Math.random() * 25) * 60 * 1000;
              setTimeout(() => {
                receiveMessage(charId, privateReply.trim());
              }, delayMs);
            }
          } catch (e) {
            console.error(e);
          }
        }
      }, 2000);
    }
    
    setIsPosting(false);
    onBack();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black transition-colors z-50 absolute inset-0">
      <div className="bg-gray-100 dark:bg-[#191919] px-4 pt-14 pb-3 flex items-center justify-between border-b dark:border-white/5 transition-colors shrink-0">
        <button onClick={onBack} className="text-gray-900 dark:text-gray-100">取消</button>
        <button onClick={handlePost} disabled={isPosting || (!content && images.length === 0 && !musicUrl)} className="bg-[#07c160] text-white px-4 py-1 rounded text-sm disabled:opacity-50">发表</button>
      </div>
      
      <div className="p-5 space-y-4 flex-1 overflow-y-auto w-full">
        <textarea 
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full h-24 resize-none outline-none text-[15px] bg-transparent dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          placeholder="这一刻的想法..."
        />
        
        <div 
          className="flex flex-wrap gap-2 mb-4"
          onTouchMove={(e) => {
            if (touchStartIndex !== null) {
              handleTouchMove(e, touchStartIndex);
            }
          }}
          onTouchEnd={handleTouchEnd}
        >
          {images.map((img, index) => (
            <div 
              key={index} 
              className={`relative w-24 h-24 ${draggedIndex === index ? 'opacity-50 scale-110' : ''} transition-all duration-150`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onTouchStart={() => handleTouchStart(index)}
            >
              <img src={img} alt="" className="w-full h-full object-cover rounded-md cursor-move" />
              <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">{index + 1}</div>
              <button 
                onClick={() => removeImage(index)} 
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow z-10"
              >
                <X size={14} />
              </button>
              <div className="absolute bottom-1 right-1 bg-black/50 text-white p-1 rounded cursor-move">
                <GripVertical size={12} />
              </div>
            </div>
          ))}
          {images.length < 9 && (
            <div 
              className="relative w-24 h-24 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-full h-full bg-gray-100 dark:bg-[#2c2c2c] flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 rounded-md hover:bg-gray-200 dark:hover:bg-[#3c3c3c] transition-colors border-none">
                <Camera size={28} className="mb-1 text-gray-400" />
                <span className="text-xs">{images.length}/9</span>
              </div>
            </div>
          )}
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*" 
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        <div>
          <input 
            type="text" 
            value={musicUrl}
            onChange={e => setMusicUrl(e.target.value)}
            className="w-full border-b dark:border-white/10 py-3 text-[15px] bg-transparent dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
            placeholder="音乐链接 (可选)"
          />
        </div>
        <div>
          <input 
            type="text" 
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="w-full border-b dark:border-white/10 py-3 text-[15px] bg-transparent dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
            placeholder="所在位置 (例如: 哥谭市)"
          />
        </div>
        
        <div className="pt-2">
          <div 
            className="flex items-center justify-between py-4 border-b dark:border-white/10 cursor-pointer text-gray-900 dark:text-gray-100"
            onClick={() => setShowContactSelector(true)}
          >
            <span className="text-[15px]">提醒谁看</span>
            <div className="flex items-center text-gray-400 dark:text-gray-500 text-[15px]">
              {selectedChars.length > 0 ? `已选 ${selectedChars.length} 人` : ''}
              <ChevronRight size={20} className="ml-1" />
            </div>
          </div>
        </div>
      </div>

      {showContactSelector && (
        <div className="absolute inset-0 bg-white dark:bg-black z-[60] flex flex-col transition-colors">
          <div className="bg-gray-100 dark:bg-[#191919] px-4 pt-14 pb-3 flex items-center justify-between border-b dark:border-white/5 shrink-0">
            <button onClick={() => setShowContactSelector(false)} className="text-gray-900 dark:text-gray-100">返回</button>
            <h1 className="text-lg font-medium dark:text-gray-100">提醒谁看</h1>
            <button onClick={() => setShowContactSelector(false)} className="text-[#07c160] font-medium">完成</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {letters.map(letter => (
               <div key={letter}>
                 <div className="bg-gray-100 dark:bg-[#191919] px-4 py-1 text-sm font-medium text-gray-500">{letter}</div>
                 {grouped[letter].map(char => {
                   const isSelected = selectedChars.includes(char.id);
                   return (
                     <div 
                       key={char.id} 
                       className="flex items-center px-4 py-3 border-b dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2c2c2c] transition-colors"
                       onClick={() => setSelectedChars(prev => isSelected ? prev.filter(id => id !== char.id) : [...prev, char.id])}
                     >
                       <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-4 shrink-0 transition-colors ${isSelected ? 'bg-[#07c160] border-[#07c160]' : 'border-gray-300 dark:border-gray-600'}`}>
                         {isSelected && <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-white -rotate-45 -translate-y-[2px]"></div>}
                       </div>
                       <div 
                         className="w-10 h-10 rounded text-center leading-10 text-white font-bold flex-shrink-0 mr-3"
                         style={{ background: char.avatar.startsWith('#') ? char.avatar : `url(${char.avatar}) center/cover` }}
                       />
                       <span className="text-[15px] dark:text-gray-100">{char.remark || char.name}</span>
                     </div>
                   );
                 })}
               </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
