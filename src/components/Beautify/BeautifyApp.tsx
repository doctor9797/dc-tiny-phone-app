import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Plus, X, Music, Image as ImageIcon, Calendar, Edit3, Trash2 } from 'lucide-react';
import { WidgetType, DesktopWidget } from '../../types';
import ImageUploader from '../ImageUploader';
import { findAvailableWidgetSlot, getWidgetSpan } from '../DesktopWidgets';

const WIDGET_TEMPLATES: { type: WidgetType; name: string; desc: string; icon: React.ReactNode; defaultData: any }[] = [
  { type: 'music_player', name: '黑胶唱片', desc: 'ins风音乐播放器小组件', icon: <Music />, defaultData: { title: 'Lover', artist: 'Taylor Swift', cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200' } },
  { type: 'sticky_note', name: '便签本', desc: '可爱的桌面便签', icon: <Edit3 />, defaultData: { text: 'To the world you may be one person, but to one person you may be the world.', bgColor: '#fef3c7', textColor: '#92400e', font: 'font-serif' } },
  { type: 'photo_2x2', name: '拍立得照片', desc: '正方形圆角相框', icon: <ImageIcon />, defaultData: { url: 'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?q=80&w=300', text: 'Sweet Memory', font: 'font-serif' } },
  { type: 'photo_4x2', name: '全景长图', desc: '宽幅风景照片组件', icon: <ImageIcon />, defaultData: { url: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=600' } },
  { type: 'listen_together', name: '一起听', desc: '情侣双人共同听歌', icon: <Music />, defaultData: { charId: null, song: 'Sunset Lover' } },
  { type: 'profile_intro', name: '个人简介', desc: '你的名片', icon: <Edit3 />, defaultData: { name: 'Jiuqi', desc: 'Stay hungry, stay foolish.', avatar: '', bgColor: '#f1f5f9' } },
  { type: 'time_bar', name: '时光记录条', desc: '毛玻璃风格长条时钟', icon: <Calendar />, defaultData: { customText: 'Today is a gift', font: 'font-serif' } },
  { type: 'countdown', name: '纪念日倒数', desc: '重要的日子都在这里', icon: <Calendar />, defaultData: { url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=300', text: '在一起', days: 100, font: 'font-sans' } },
  { type: 'quote_4x2', name: '大字报引言', desc: '每日一句格言', icon: <Edit3 />, defaultData: { url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=600', text: 'Where there is love, there is life.', font: 'font-serif' } },
  { type: 'calendar_widget', name: '手账日历', desc: '复古日历小组件', icon: <Calendar />, defaultData: { bgColor: '#ffffff', textColor: '#334155', font: 'font-sans', url: 'https://images.unsplash.com/photo-1563281577-a7be47e20db9?q=80&w=200' } },
];

export default function BeautifyApp() {
  const { closeApp, widgets, characters, addWidget, removeWidget, updateWidget } = useAppStore();
  const [view, setView] = useState<'home' | 'add' | 'edit'>('home');
  const [editingWidget, setEditingWidget] = useState<{ widget: DesktopWidget, isNew: boolean } | null>(null);
  const maxPage = Math.max(2, ...widgets.map(widget => (widget.page || 0) + 1));

  const handleAddClick = (template: typeof WIDGET_TEMPLATES[0]) => {
    const span = getWidgetSpan(template.type);
    const initialPage = 0;
    const initialSlot = findAvailableWidgetSlot(widgets, initialPage, span.width, span.height);
    const newWidget: DesktopWidget = {
      id: Date.now().toString(),
      type: template.type,
      page: initialPage,
      slotIndex: initialSlot,
      width: span.width,
      height: span.height,
      data: { ...template.defaultData }
    };
    setEditingWidget({ widget: newWidget, isNew: true });
    setView('edit');
  };

  const handleSave = () => {
    if (editingWidget) {
      if (editingWidget.isNew) {
        addWidget(editingWidget.widget);
      } else {
        updateWidget(editingWidget.widget.id, editingWidget.widget);
      }
    }
    setView('home');
  };

  const handleCancel = () => {
     setEditingWidget(null);
     setView('home');
  };

  if (view === 'add') {
    return (
      <div className="h-full flex flex-col bg-slate-50 text-slate-800">
        <div className="px-4 pt-14 pb-4 flex items-center justify-between border-b border-slate-200 bg-white shadow-sm z-10">
          <button onClick={() => setView('home')} className="text-slate-500"><X size={24} /></button>
          <span className="font-bold text-lg">添加组件</span>
          <div className="w-6"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {WIDGET_TEMPLATES.map(t => (
            <div key={t.type} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 active:scale-95 transition-transform" onClick={() => handleAddClick(t)}>
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                {t.icon}
              </div>
              <div className="flex-1">
                <div className="font-bold">{t.name}</div>
                <div className="text-xs text-slate-400">{t.desc}</div>
              </div>
              <button className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                <Plus size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'edit' && editingWidget) {
    const wConfig = editingWidget.widget;
    const d = wConfig.data;
    const setD = (newD: any) => setEditingWidget({ ...editingWidget, widget: { ...wConfig, data: { ...d, ...newD } } });

    return (
      <div className="h-full flex flex-col bg-slate-50 text-slate-800">
        <div className="px-4 pt-14 pb-4 flex items-center justify-between border-b border-slate-200 bg-white shadow-sm z-10">
          <button onClick={handleCancel} className="text-rose-400 font-medium">放弃</button>
          <span className="font-bold text-lg">配置组件</span>
          <button onClick={handleSave} className="text-indigo-500 font-bold">保存</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Edit Forms based on type */}
          {(wConfig.type === 'photo_2x2' || wConfig.type === 'photo_4x2' || wConfig.type === 'music_player' || wConfig.type === 'countdown' || wConfig.type === 'quote_4x2' || wConfig.type === 'calendar_widget') && (
            <div className="space-y-2">
               <label className="text-sm font-bold text-slate-500">更换图片</label>
               <ImageUploader onImageSelected={(url) => setD({ [wConfig.type === 'music_player' ? 'cover' : 'url']: url })}>
                  <div className="w-full h-32 bg-slate-200 rounded-xl overflow-hidden flex items-center justify-center text-slate-400 bg-cover bg-center" style={{ backgroundImage: `url(${d.url || d.cover})` }}>
                     <div className="bg-black/50 text-white px-4 py-2 rounded-full text-sm backdrop-blur">点击更换照片</div>
                  </div>
               </ImageUploader>
            </div>
          )}

          {(wConfig.type === 'photo_2x2' || wConfig.type === 'sticky_note' || wConfig.type === 'quote_4x2') && (
            <div className="space-y-2">
               <label className="text-sm font-bold text-slate-500">文字内容</label>
               <textarea value={d.text} onChange={e => setD({ text: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-400 transition-colors h-24" />
            </div>
          )}

          {wConfig.type === 'countdown' && (
             <>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-500">文字描述</label>
                 <input type="text" value={d.text} onChange={e => setD({ text: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-400 transition-colors" />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-500">天数</label>
                 <input type="number" value={d.days} onChange={e => setD({ days: parseInt(e.target.value) || 0 })} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-400 transition-colors" />
               </div>
             </>
          )}

          {wConfig.type === 'time_bar' && (
             <div className="space-y-2">
               <label className="text-sm font-bold text-slate-500">座右铭 / 留空不显示</label>
               <input type="text" value={d.customText} onChange={e => setD({ customText: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-400 transition-colors" />
             </div>
          )}

          {wConfig.type === 'music_player' && (
             <>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-500">歌曲名称</label>
                 <input type="text" value={d.title} onChange={e => setD({ title: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-400" />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-500">歌手</label>
                 <input type="text" value={d.artist} onChange={e => setD({ artist: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-400" />
               </div>
             </>
          )}

          {wConfig.type === 'listen_together' && (
             <>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-500">选择一起听的角色</label>
                 <select value={d.charId || ''} onChange={e => setD({ charId: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-400">
                    <option value="">（不选择角色）</option>
                    {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-500">歌曲名称</label>
                 <input type="text" value={d.song} onChange={e => setD({ song: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-400" />
               </div>
             </>
          )}

          {(wConfig.type === 'sticky_note' || wConfig.type === 'photo_2x2' || wConfig.type === 'time_bar' || wConfig.type === 'countdown' || wConfig.type === 'quote_4x2' || wConfig.type === 'calendar_widget') && (
            <div className="space-y-2">
               <label className="text-sm font-bold text-slate-500">选择字体</label>
               <div className="flex gap-2">
                 <button onClick={() => setD({ font: 'font-sans' })} className={`flex-1 py-2 rounded-lg border ${d.font === 'font-sans' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white'} font-sans`}>无衬线</button>
                 <button onClick={() => setD({ font: 'font-serif' })} className={`flex-1 py-2 rounded-lg border ${d.font === 'font-serif' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white'} font-serif`}>衬线</button>
                 <button onClick={() => setD({ font: 'font-mono' })} className={`flex-1 py-2 rounded-lg border ${d.font === 'font-mono' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white'} font-mono`}>等宽</button>
               </div>
            </div>
          )}

          {(wConfig.type === 'profile_intro' || wConfig.type === 'sticky_note' || wConfig.type === 'calendar_widget') && (
             <div className="space-y-2">
               <label className="text-sm font-bold text-slate-500">背景颜色</label>
               <div className="flex flex-wrap gap-2">
                 {/* Match OS theme palettes */}
                 {[
                   { name: '冰水蓝', value: '#bae6fd' }, // cyan
                   { name: '樱花粉', value: '#fbcfe8' }, // pink
                   { name: '珍珠白', value: '#ffffff' }, // white
                   { name: '薄荷绿', value: '#a7f3d0' }, // green
                   { name: '香芋紫', value: '#ddd6fe' }, // purple
                   { name: '深幽黑', value: '#0a0a0a' }, // black
                   { name: '高级灰', value: '#e2e8f0' }, // gray
                   { name: '复古黄', value: '#fef3c7' }  // default note
                 ].map(c => (
                    <button 
                      key={c.value}
                      title={c.name}
                      onClick={() => setD({ bgColor: c.value, textColor: c.value === '#0a0a0a' ? '#ffffff' : '#334155' })}
                      className={`w-8 h-8 rounded-full border-2 ${d.bgColor === c.value ? 'border-indigo-500 scale-110 shadow-sm' : 'border-slate-200'}`}
                      style={{ backgroundColor: c.value }}
                    />
                 ))}
               </div>
             </div>
          )}

          {wConfig.type === 'profile_intro' && (
             <>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-500">头像</label>
                 <ImageUploader onImageSelected={(url) => setD({ avatar: url })}>
                    <div className="w-16 h-16 rounded-full bg-slate-200 flex justify-center items-center overflow-hidden">
                       {d.avatar ? <img src={d.avatar} className="w-full h-full object-cover" /> : <div className="text-xs text-slate-400">点击</div>}
                    </div>
                 </ImageUploader>
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-500">名字</label>
                 <input type="text" value={d.name} onChange={e => setD({ name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none" />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-500">个性签名</label>
                 <input type="text" value={d.desc} onChange={e => setD({ desc: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl p-3 outline-none" />
               </div>
             </>
          )}

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500">放置页面</label>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: maxPage + 1 }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setEditingWidget({ ...editingWidget, widget: { ...wConfig, page: index } })}
                  className={`py-3 rounded-xl border text-sm font-bold ${((wConfig.page || 0) === index) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500'}`}
                >
                  第 {index + 1} 页
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] text-slate-800 font-sans">
      <div className="px-6 pt-16 pb-4 flex items-center justify-between sticky top-0 bg-[#f8fafc]/80 backdrop-blur z-10 border-b border-transparent transition-all">
        <button onClick={closeApp} className="w-10 h-10 flex -ml-3 items-center text-slate-400 hover:text-slate-800 transition-colors"><ChevronLeft size={28} /></button>
        <span className="font-black text-xl tracking-widest uppercase">Beautify</span>
        <button onClick={() => setView('add')} className="w-10 h-10 flex justify-end items-center text-indigo-500 hover:text-indigo-600 transition-colors ml-3"><Plus size={28} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
             <div className="text-6xl mb-4 opacity-50">✨</div>
             <p className="font-bold tracking-widest text-sm">你的桌面空空如也</p>
             <button onClick={() => setView('add')} className="mt-6 px-6 py-2 bg-slate-800 text-white rounded-full font-bold text-sm shadow-md">去添加</button>
          </div>
        ) : (
          widgets.map(w => {
            const template = WIDGET_TEMPLATES.find(t => t.type === w.type);
            return (
              <div key={w.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-indigo-400 shrink-0">
                    {template?.icon}
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{template?.name}</div>
                    <div className="text-xs text-slate-400 truncate">
                       {w.type === 'music_player' && w.data.title}
                       {w.type === 'sticky_note' && w.data.text}
                       {w.type === 'photo_2x2' && '图片组件'}
                       {w.type === 'photo_4x2' && '横向图'}
                       {w.type === 'listen_together' && w.data.song}
                       {w.type === 'profile_intro' && w.data.name}
                       {w.type === 'time_bar' && '顶部时间条'}
                       {w.type === 'countdown' && w.data.text}
                       {w.type === 'quote_4x2' && w.data.text}
                       {w.type === 'calendar_widget' && '日历组件'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">第 {(w.page || 0) + 1} 页</div>
                 </div>
                 <button onClick={() => { setEditingWidget({ widget: w, isNew: false }); setView('edit'); }} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full"><Edit3 size={16} /></button>
                 <button onClick={() => { if(confirm('删除这个组件？')) removeWidget(w.id); }} className="p-2 text-rose-300 hover:text-rose-500 bg-rose-50 rounded-full"><Trash2 size={16} /></button>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}
