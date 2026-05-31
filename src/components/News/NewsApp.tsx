import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { Settings, ChevronLeft, RefreshCcw, Newspaper, Archive } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';
import { format } from 'date-fns';
import { sendCharacterActivityFollowup } from '../../lib/ai';
import { saveInteractionMemory } from '../../lib/characterMemory';

const NEWS_CHANNELS = [
  '头条',
  '本地',
  '社会',
  '财经',
  '科技',
  '国际',
  '文娱',
  '体育',
  '评论',
  '深度'
];

export default function NewsApp() {
  const { closeApp, characters, worldSettings, newsIssues, saveNewsIssue, addActivityLog } = useAppStore();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(NEWS_CHANNELS[0]);
  const [view, setView] = useState<'channels' | 'issue' | 'archive'>('channels');

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const savedCount = localStorage.getItem('news_count');
    if (savedCount) setCount(parseInt(savedCount));
    setLoading(false);
  }, []);

  const issueId = `${today}_${selectedChannel}`;
  const currentIssue = newsIssues.find(issue => issue.id === issueId);

  const generateNews = async (articleCount: number, category = selectedChannel) => {
    const targetIssueId = `${today}_${category}`;
    setGenerating(true);
    setLoading(true);
    setSelectedChannel(category);
    setView('issue');
    setArticles([]);

    try {
      const enabledCharList = Object.values(characters).filter(c => (c as any).isDisabled !== true).map(c => c.name);
      const worldSetting = worldSettings[0]?.content || '';
      const worldCharacterNames = worldSettings
        .flatMap(setting => setting.characters || [])
        .filter(char => char.isEnabled !== false)
        .map(char => char.name)
        .filter(Boolean);
      
      const prompt = `你是《每日号角报》主编。请围绕“${category}”栏目，根据以下世界观和角色，生成今天的报纸头条和几篇简短报道。
要求：
1. 必须生成准确的 ${articleCount} 篇报道。
2. 世界设定参考：${worldSetting}
3. 可以出现世界观中存在但不一定在当前角色卡列表里的角色，也可以少量自创符合世界观气质的路人、反派、记者、警员、公司人物。比如小丑、黑帮成员、市民、警探、记者等都可以出现。
4. 当前可参考角色名单：${[...new Set([...enabledCharList, ...worldCharacterNames])].join('、') || '暂无固定角色'}。但不要只围着这些角色写，不要每篇都强行写角色卡人物。
5. 每篇报道要贴合栏目“${category}”，语言像真实手机新闻客户端里的短报道。每篇在 80-150 字之间。
6. 允许少量出现角色卡没有、但世界观合理的人物；只要符合世界观即可，但不要让同一个非主要人物占比过高。
5. 请务必返回合法的 JSON 格式，如下所示，不要包含其他字符：
[
  { "title": "蝙蝠侠昨夜现身", "content": "内容详情...", "category": "${category}" },
  { "title": "韦恩集团股价大涨", "content": "内容详情...", "category": "${category}" }
]
`;

      const res = await generateAIResponse(prompt);
      const cleaned = res.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      const raw = JSON.parse(cleaned);
      const list = Array.isArray(raw) ? raw : [];
      const parsed = list.map((article: any, index: number) => ({
        ...article,
        id: `${targetIssueId}_${index}`
      }));
      
      setArticles(parsed);
      saveNewsIssue({
        id: targetIssueId,
        date: today,
        category,
        articles: parsed,
        createdAt: Date.now()
      });
      addActivityLog({
        id: `${Date.now()}_${category}`,
        title: `阅读新闻 ${category}`,
        detail: parsed.slice(0, 3).map((article: any) => article.title).join('；'),
        timestamp: Date.now()
      });
      // 日报记忆+情绪
      const store = useAppStore.getState();
      Object.keys(store.characters).forEach(charId => {
        if ((store.characters[charId] as any).isDisabled) return;
        saveInteractionMemory(charId, `看了日报${category}栏目`, parsed.slice(0, 2).map((a: any) => a.title).join('；'), 'event', 2);
        store.addEmotionEvent({ characterId: charId, paDelta: 0.08, naDelta: -0.02, word: '关注', valence: 0.3, arousal: 0.3, matchSource: 'free_form', source: 'manual' });
      });
      const enabledCharacters = Object.values(characters).filter(char => (char as any).isDisabled !== true);
      const followupChar = enabledCharacters.length > 0 ? enabledCharacters[Math.floor(Math.random() * enabledCharacters.length)] : null;
      if (followupChar) {
        sendCharacterActivityFollowup(followupChar.id, `我刚刚阅读了今天“${category}”栏目的日报，共 ${parsed.length} 篇报道。请你主动来和我聊一句和这些报道相关的话。`);
      }
    } catch (err) {
      console.error(err);
      setArticles([
        { id: `${targetIssueId}_fallback`, title: `${category} 暂时无法生成`, content: '这一栏的日报生成失败了，请重新点一次或稍后刷新。', category }
      ]);
      setView('issue');
    }
    setLoading(false);
    setGenerating(false);
  };

  const handleManualRefresh = () => {
    generateNews(count);
  };

  const saveCount = (newCount: number) => {
    setCount(newCount);
    localStorage.setItem('news_count', newCount.toString());
  };

  if (showSettings) {
    return (
      <div className="h-full flex flex-col bg-stone-100 text-stone-900 font-serif">
        <div className="px-4 pt-7 pb-3 flex items-center justify-between border-b border-stone-300 bg-stone-200">
          <button onClick={() => setShowSettings(false)} className="text-stone-700 active:scale-95"><ChevronLeft size={28} /></button>
          <h1 className="text-lg font-bold">报社设置</h1>
          <div className="w-8"></div>
        </div>
        <div className="p-6">
           <label className="block text-sm font-bold mb-2">每日报道篇数（当即生效并重新生成）</label>
           <select 
             value={count} 
             onChange={(e) => {
               saveCount(parseInt(e.target.value));
               setShowSettings(false);
             }}
             className="w-full p-2 rounded border border-stone-300 bg-white"
           >
             {[1, 2, 3, 4, 5, 8, 10].map(n => <option key={n} value={n}>{n} 篇</option>)}
           </select>
        </div>
      </div>
    );
  }

  if (view === 'archive') {
    return (
      <div className="h-full flex flex-col bg-[#f4f1ea] text-[#2c2c2c] font-serif overflow-hidden">
        <div className="px-4 pt-7 pb-3 border-b border-stone-300 flex items-center justify-between shrink-0">
          <button onClick={() => setView('channels')}><ChevronLeft size={28} /></button>
          <div className="font-bold">往期报纸</div>
          <div className="w-8" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {newsIssues.length === 0 ? (
            <div className="text-center text-stone-500 mt-20">暂无报纸存档</div>
          ) : (
            newsIssues.sort((a, b) => b.createdAt - a.createdAt).map(issue => (
              <button
                key={issue.id}
                onClick={() => {
                  setSelectedChannel(issue.category);
                  setArticles(issue.articles);
                  setView('issue');
                }}
                className="w-full text-left rounded-2xl border border-stone-300 bg-white p-4"
              >
                <div className="text-xs text-stone-500 mb-1">{issue.date}</div>
                <div className="font-bold mb-1">{issue.category}</div>
                <div className="text-sm text-stone-600">{issue.articles.length} 篇报道</div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === 'channels') {
    return (
      <div className="h-full flex flex-col bg-[#f4f1ea] text-[#2c2c2c] font-serif overflow-hidden">
        <div className="px-6 pt-7 pb-4 border-b-4 border-double border-stone-800 flex flex-col items-center relative z-10 shrink-0 shadow-sm">
          <button className="absolute left-4 top-12 opacity-60 hover:opacity-100" onClick={closeApp}>
            <ChevronLeft size={28} />
          </button>
          <div className="absolute right-4 top-12 flex items-center gap-4">
            <button onClick={() => setView('archive')} className="opacity-60 hover:opacity-100">
              <Archive size={20} />
            </button>
            <button onClick={() => setShowSettings(true)} className="opacity-60 hover:opacity-100">
              <Settings size={20} />
            </button>
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase font-serif mt-2 mb-1" style={{ fontFamily: '"Playfair Display", serif' }}>
            Daily Bugle
          </h1>
          <div className="text-xs text-stone-600">选择一个栏目查看当日报道</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3">
          {NEWS_CHANNELS.map(channel => (
            <button
              key={channel}
              onClick={() => {
                setSelectedChannel(channel);
                const issue = newsIssues.find(item => item.id === `${today}_${channel}`);
                if (issue) {
                  setArticles(issue.articles);
                  setView('issue');
                } else {
                  generateNews(count, channel);
                }
              }}
              className="rounded-3xl border border-stone-300 bg-white p-4 text-left min-h-[120px]"
            >
              <div className="mb-3 text-stone-500"><Newspaper size={20} /></div>
              <div className="font-bold mb-1">{channel}</div>
              <div className="text-xs text-stone-500">{newsIssues.find(item => item.id === `${today}_${channel}`) ? '今日已生成，可直接查看' : '点击生成今日报道'}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#f4f1ea] text-[#2c2c2c] font-serif overflow-hidden">
      {/* Newspaper Header */}
      <div className="px-6 pt-7 pb-4 border-b-4 border-double border-stone-800 flex flex-col items-center relative z-10 shrink-0 shadow-sm">
        <button 
          className="absolute left-4 top-12 opacity-60 hover:opacity-100" 
          onClick={() => setView('channels')}
        >
          <ChevronLeft size={28} />
        </button>
        <div className="absolute right-4 top-12 flex items-center gap-4">
          <button onClick={handleManualRefresh} className={`opacity-60 hover:opacity-100 ${generating ? 'animate-spin' : ''}`}>
            <RefreshCcw size={20} />
          </button>
          <button onClick={() => setShowSettings(true)} className="opacity-60 hover:opacity-100">
            <Settings size={20} />
          </button>
        </div>
        
        <h1 className="text-4xl font-black tracking-tighter uppercase font-serif mt-2 mb-1" style={{ fontFamily: '"Playfair Display", serif' }}>
          Daily Bugle
        </h1>
        <div className="text-sm font-bold">{selectedChannel}</div>
        <div className="flex w-full justify-between items-center text-[10px] font-bold uppercase border-t border-b border-stone-800 py-1 mt-2">
          <span>Vol. {Math.floor(Math.random() * 1000)}</span>
          <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
          <span>$1.50</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-500 gap-4 opacity-50">
            <RefreshCcw className="animate-spin" size={32} />
            <p className="font-italic text-sm">印刷机正在运转...</p>
          </div>
        ) : (
          <div className="columns-1 gap-6">
            {articles.map((article, i) => (
              <div key={article.id || i} className="mb-6 break-inside-avoid">
                 <div className="flex items-center gap-2 mb-2">
                   <div className="h-[2px] bg-stone-800 flex-1"></div>
                   <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600 px-2 border border-stone-800 rounded-sm">
                     {article.category}
                   </span>
                   <div className="h-[2px] bg-stone-800 w-12"></div>
                 </div>
                 <h2 className={`font-black uppercase mb-3 leading-tight ${i === 0 ? 'text-3xl' : 'text-xl'}`} style={{ fontFamily: '"Playfair Display", serif' }}>
                   {article.title}
                 </h2>
                 <p className="text-sm leading-relaxed text-justify first-letter:text-4xl first-letter:font-black first-letter:float-left first-letter:mr-2">
                   {article.content}
                 </p>
                 {i !== articles.length - 1 && <div className="mt-6 border-b border-stone-300 w-1/2 mx-auto"></div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(0,0,0,0.2);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
