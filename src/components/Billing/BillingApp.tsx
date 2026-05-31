import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, Plus, X, PieChart as PieChartIcon, Settings, User, Trash2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getCharacterReply, sendCharacterActivityFollowup } from '../../lib/ai';
import { saveInteractionMemory } from '../../lib/characterMemory';

export default function BillingApp() {
  const { 
    closeApp, 
    billingCategories, 
    billingRecords, 
    billingManagerId,
    characters,
    addBillingRecord,
    updateBillingRecord,
    deleteBillingRecord,
    updateBillingManager,
    addBillingCategory,
    updateBillingCategory,
    deleteBillingCategory,
    addActivityLog
  } = useAppStore();

  const [view, setView] = useState<'home' | 'add' | 'record' | 'charts' | 'categories' | 'manager'>('home');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  
  // Charts state
  const [chartPeriod, setChartPeriod] = useState<'month' | 'all'>('month');

  // New category state
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🛒');
  const [newCatColor, setNewCatColor] = useState('#fbcfe8');

  const manager = billingManagerId ? characters[billingManagerId] : null;

  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0,0,0,0);

  const filteredRecords = useMemo(() => {
    let sorted = [...billingRecords].sort((a,b) => b.timestamp - a.timestamp);
    if (chartPeriod === 'month') {
      return sorted.filter(r => r.timestamp >= currentMonthStart.getTime());
    }
    return sorted;
  }, [billingRecords, chartPeriod]);

  const totalExpense = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + r.amount, 0);
  }, [filteredRecords]);

  const chartData = useMemo(() => {
    const data: Record<string, number> = {};
    filteredRecords.forEach(r => {
      data[r.categoryId] = (data[r.categoryId] || 0) + r.amount;
    });
    return Object.keys(data).map(catId => {
      const cat = billingCategories.find(c => c.id === catId);
      return {
        name: cat?.name || '未知',
        value: data[catId],
        color: cat?.color || '#cbd5e1',
        icon: cat?.icon || '❓'
      };
    }).sort((a,b) => b.value - a.value);
  }, [filteredRecords, billingCategories]);

  const handleAddRecord = async () => {
    if (!amount || isNaN(parseFloat(amount)) || !selectedCatId) return;
    setIsAdding(true);
    const cost = parseFloat(amount);
    
    let comment = '';
    if (manager) {
      const cat = billingCategories.find(c => c.id === selectedCatId);
      const prompt = `这是一笔普通的账单支出记录。用户花费了${cost}元，类别是${cat?.name}，备注是"${note}"。你作为 ${manager.name} (${manager.personality})，帮助用户管理账单。请用一两句话（20字以内）简短地对这笔支出发表你的看法。你可以根据角色性格夸奖、吐槽或心疼。`;
      try {
        comment = await getCharacterReply(manager.id, prompt);
      } catch(e) {
        comment = '记下啦。';
      }
    }

    addBillingRecord({
      id: Date.now().toString(),
      amount: cost,
      categoryId: selectedCatId,
      note,
      timestamp: Date.now(),
      managerComment: comment
    });

    // 记账记忆+情绪
    const cat = billingCategories.find(c => c.id === selectedCatId);
    if (manager) {
      saveInteractionMemory(manager.id, `记账了${cost}元(${cat?.name})`, note || '', 'event', 3);
      const store = useAppStore.getState();
      store.addEmotionEvent({ characterId: manager.id, paDelta: cost > 1000 ? -0.15 : 0.05, naDelta: cost > 1000 ? 0.1 : -0.02, word: cost > 1000 ? '心疼' : '满意', valence: cost > 1000 ? -0.2 : 0.2, arousal: 0.3, matchSource: 'free_form', source: 'manual' });
    }
    
    setAmount('');
    setNote('');
    setSelectedCatId('');
    setIsAdding(false);
    setView('home');
    const recentOfCategory = billingRecords.filter(record => record.categoryId === selectedCatId).slice(0, 5);
    const avg = recentOfCategory.length > 0 ? (recentOfCategory.reduce((sum, record) => sum + record.amount, 0) / recentOfCategory.length).toFixed(1) : cost.toFixed(1);
    addActivityLog({
      id: `${Date.now()}_billing`,
      title: `记账 ${billingCategories.find(c => c.id === selectedCatId)?.name || '未知类别'}`,
      detail: `本次 ${cost} 元，近期同类平均 ${avg} 元，备注:${note || '无'}`,
      timestamp: Date.now(),
      relatedCharacterIds: manager ? [manager.id] : undefined
    });
    if (manager) {
      const cat = billingCategories.find(c => c.id === selectedCatId);
      sendCharacterActivityFollowup(
        manager.id,
        `我刚刚记了一笔账，金额是 ${cost} 元，类别是 ${cat?.name || '未知类别'}，备注是“${note || '无'}”。请你主动给我发一条和这次记账相关的微信消息。`
      );
    }
  };

  const selectedRecord = selectedRecordId ? billingRecords.find(r => r.id === selectedRecordId) || null : null;

  const openRecordDetail = (recordId: string) => {
    const record = billingRecords.find(r => r.id === recordId);
    if (!record) return;
    setSelectedRecordId(recordId);
    setAmount(record.amount.toString());
    setNote(record.note || '');
    setSelectedCatId(record.categoryId);
    setView('record');
  };

  const handleUpdateRecord = () => {
    if (!selectedRecord || !amount || isNaN(parseFloat(amount)) || !selectedCatId) return;
    updateBillingRecord(selectedRecord.id, {
      amount: parseFloat(amount),
      categoryId: selectedCatId,
      note
    });
    setView('home');
    setSelectedRecordId(null);
    setAmount('');
    setNote('');
    setSelectedCatId('');
  };

  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  const handleAddCategory = () => {
    if(!newCatName || !newCatIcon) return;
    if (editingCatId) {
      updateBillingCategory(editingCatId, {
        name: newCatName,
        icon: newCatIcon,
        color: newCatColor
      });
      setEditingCatId(null);
    } else {
      addBillingCategory({
        id: Date.now().toString(),
        name: newCatName,
        icon: newCatIcon,
        color: newCatColor
      });
    }
    setNewCatName('');
    setNewCatIcon('🛒');
    setNewCatColor('#fbcfe8');
  };

  const handleEditClick = (cat: import('../../types').BillingCategory) => {
    setEditingCatId(cat.id);
    setNewCatName(cat.name);
    setNewCatIcon(cat.icon);
    setNewCatColor(cat.color);
  };

  const getPastelColor = () => {
    const colors = ['#fecaca', '#fca5a5', '#fde047', '#bbf7d0', '#86efac', '#bfdbfe', '#93c5fd', '#e9d5ff', '#d8b4fe', '#fbcfe8', '#f9a8d4'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  if (view === 'add') {
    return (
      <div className="h-full flex flex-col bg-[#fafaf9] text-stone-800 font-sans">
        <div className="px-4 pt-14 pb-4 flex items-center justify-between border-b border-stone-200/50 bg-white shadow-sm z-10">
          <button onClick={() => setView('home')} className="text-stone-500"><X size={24} /></button>
          <span className="font-bold text-lg">记一笔</span>
          <div className="w-6"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col items-center">
            <span className="text-stone-400 text-sm font-medium mb-2">支出金额 (元)</span>
            <input 
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="text-4xl font-bold bg-transparent outline-none text-center w-full placeholder:text-stone-300"
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div>
            <h3 className="text-sm font-bold text-stone-400 pl-2 mb-3">选择类别</h3>
            <div className="grid grid-cols-4 gap-4">
              {billingCategories.map(cat => (
                <button 
                  key={cat.id} 
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${selectedCatId === cat.id ? 'bg-stone-800 text-white shadow-lg scale-105' : 'bg-white text-stone-600 shadow-sm border border-stone-100 hover:bg-stone-50'}`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-inner" style={{backgroundColor: cat.color}}>
                    {cat.icon}
                  </div>
                  <span className="text-xs font-semibold">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-100">
            <input 
               type="text" 
               value={note}
               onChange={e => setNote(e.target.value)}
               placeholder="写点备注吧..."
               className="w-full outline-none bg-transparent text-stone-700 text-sm"
            />
          </div>
        </div>

        <div className="p-4 bg-white border-t border-stone-100 pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <button 
            onClick={handleAddRecord}
            disabled={!amount || !selectedCatId || isAdding}
            className="w-full bg-stone-800 text-white rounded-2xl py-4 font-bold text-lg disabled:opacity-50 disabled:bg-stone-300 active:scale-95 transition-all flex justify-center items-center h-14"
          >
            {isAdding ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '保存该笔支出'}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'charts') {
    return (
      <div className="h-full flex flex-col bg-[#fafaf9] text-stone-800 font-sans">
        <div className="px-4 pt-14 pb-4 flex items-center justify-between bg-white shadow-sm z-10 sticky top-0 border-b border-stone-100">
          <button onClick={() => setView('home')} className="text-stone-500"><ChevronLeft size={28} /></button>
          <span className="font-bold text-lg">账单统计</span>
          <div className="w-7"></div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 flex justify-center">
            <div className="bg-stone-200/50 p-1 rounded-full flex gap-1 shadow-inner">
              <button onClick={() => setChartPeriod('month')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${chartPeriod === 'month' ? 'bg-white shadow text-stone-800' : 'text-stone-500'}`}>本月</button>
              <button onClick={() => setChartPeriod('all')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${chartPeriod === 'all' ? 'bg-white shadow text-stone-800' : 'text-stone-500'}`}>总计</button>
            </div>
          </div>

          <div className="px-6 flex flex-col items-center">
             <div className="text-stone-400 font-medium text-sm mb-1">{chartPeriod === 'month' ? '本月总支出' : '历史总支出'}</div>
             <div className="text-4xl font-black tabular-nums tracking-tighter">¥{totalExpense.toFixed(2)}</div>
          </div>

          {totalExpense > 0 ? (
            <div className="mt-8 mb-8 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `¥${value.toFixed(2)}`}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'}}
                    itemStyle={{ color: '#444', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-12 mb-8 flex items-center justify-center text-stone-400 h-64">暂无数据</div>
          )}

          <div className="px-6 pb-12 space-y-3">
             <h3 className="font-bold text-stone-500 mb-4 px-2">支出排行</h3>
             {chartData.map((d, i) => (
               <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-full flex justify-center items-center text-xl shadow-inner shrink-0" style={{backgroundColor: d.color}}>{d.icon}</div>
                 <div className="flex-1 font-bold text-stone-700">{d.name}</div>
                 <div className="text-right">
                   <div className="font-bold text-lg">¥{d.value.toFixed(2)}</div>
                   <div className="text-xs text-stone-400 font-medium">{((d.value/totalExpense)*100).toFixed(1)}%</div>
                 </div>
               </div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'record' && selectedRecord) {
    return (
      <div className="h-full flex flex-col bg-[#fafaf9] text-stone-800 font-sans">
        <div className="px-4 pt-14 pb-4 flex items-center justify-between border-b border-stone-200/50 bg-white shadow-sm z-10">
          <button onClick={() => setView('home')} className="text-stone-500"><ChevronLeft size={24} /></button>
          <span className="font-bold text-lg">账单详情</span>
          <button
            onClick={() => {
              if (confirm('删除这条记录？')) {
                deleteBillingRecord(selectedRecord.id);
                setSelectedRecordId(null);
                setView('home');
              }
            }}
            className="text-rose-500"
          >
            <Trash2 size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 flex flex-col items-center">
            <span className="text-stone-400 text-sm font-medium mb-2">金额</span>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="text-4xl font-bold bg-transparent outline-none text-center w-full placeholder:text-stone-300"
              placeholder="0.00"
            />
          </div>

          <div>
            <h3 className="text-sm font-bold text-stone-400 pl-2 mb-3">类别</h3>
            <div className="grid grid-cols-4 gap-4">
              {billingCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${selectedCatId === cat.id ? 'bg-stone-800 text-white shadow-lg scale-105' : 'bg-white text-stone-600 shadow-sm border border-stone-100 hover:bg-stone-50'}`}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-inner" style={{ backgroundColor: cat.color }}>
                    {cat.icon}
                  </div>
                  <span className="text-xs font-semibold">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-100">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="备注"
              className="w-full min-h-[120px] outline-none bg-transparent text-stone-700 text-sm resize-none"
            />
          </div>
        </div>

        <div className="p-4 bg-white border-t border-stone-100 pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <button
            onClick={handleUpdateRecord}
            disabled={!amount || !selectedCatId}
            className="w-full bg-stone-800 text-white rounded-2xl py-4 font-bold text-lg disabled:opacity-50 disabled:bg-stone-300 active:scale-95 transition-all"
          >
            保存修改
          </button>
        </div>
      </div>
    );
  }

  if (view === 'categories') {
    return (
      <div className="h-full flex flex-col bg-[#fafaf9] text-stone-800 font-sans">
        <div className="px-4 pt-14 pb-4 flex items-center justify-between bg-white shadow-sm z-10 sticky top-0 border-b border-stone-100">
          <button onClick={() => setView('home')} className="text-stone-500"><ChevronLeft size={28} /></button>
          <span className="font-bold text-lg">类别管理</span>
          <div className="w-7"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
           <div className="grid grid-cols-4 gap-4">
              {billingCategories.map(cat => (
                <div key={cat.id} className="relative flex flex-col items-center gap-2 p-3 rounded-2xl bg-white shadow-sm border border-stone-100">
                  <button 
                     className="absolute -top-1 -right-1 w-5 h-5 bg-stone-200 text-stone-600 rounded-full flex justify-center items-center shadow-sm"
                     onClick={() => handleEditClick(cat)}
                  ><Settings size={10} /></button>
                  <button 
                     className="absolute -top-1 -left-1 w-5 h-5 bg-rose-400 text-white rounded-full flex justify-center items-center shadow-sm"
                     onClick={() => {
                        if(confirm('确认删除此类别？')) deleteBillingCategory(cat.id);
                     }}
                  ><X size={10} /></button>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-inner cursor-pointer active:scale-95" style={{backgroundColor: cat.color}} onClick={() => handleEditClick(cat)}>
                    {cat.icon}
                  </div>
                  <span className="text-xs font-semibold">{cat.name}</span>
                </div>
              ))}
           </div>

           <div className="bg-white p-5 rounded-3xl shadow-sm border border-stone-100 pt-6 relative">
             {editingCatId && (
                <button className="absolute top-4 right-4 text-xs font-bold text-stone-400 hover:text-stone-600" onClick={() => { setEditingCatId(null); setNewCatName(''); }}>取消编辑</button>
             )}
             <h3 className="font-bold text-sm text-stone-500 mb-4 tracking-widest text-center">{editingCatId ? '编辑类别' : '新增类别'}</h3>
             <div className="flex items-center gap-3 mb-4">
                <input 
                  type="text" 
                  value={newCatIcon} 
                  onChange={e => setNewCatIcon(e.target.value)} 
                  maxLength={2} 
                  placeholder="图标"
                  className="w-14 items-center text-center p-3 text-2xl bg-stone-50 rounded-2xl outline-none border border-stone-100 focus:border-stone-300 transition-colors" 
                />
                <input 
                  type="text" 
                  value={newCatName} 
                  onChange={e => setNewCatName(e.target.value)} 
                  placeholder="类别名称" 
                  className="flex-1 p-4 bg-stone-50 rounded-2xl outline-none border border-stone-100 focus:border-stone-300 transition-colors font-medium "
                />
             </div>
             <div className="flex items-center gap-3 mb-6">
               <span className="text-sm font-bold text-stone-400 w-14 text-center">颜色</span>
               <div className="flex-1 right-0 flex justify-start gap-2 overflow-x-auto py-1">
                 {['#fca5a5', '#93c5fd', '#fcd34d', '#c4b5fd', '#86efac', '#fbcfe8', '#cbd5e1', '#d8b4fe', '#fde047'].map(c => (
                   <button 
                     key={c} 
                     onClick={() => setNewCatColor(c)} 
                     className={`w-8 h-8 rounded-full shrink-0 border-2 ${newCatColor === c ? 'border-stone-800' : 'border-transparent shadow-sm'}`} 
                     style={{backgroundColor: c}} 
                   />
                 ))}
               </div>
             </div>
             <button onClick={handleAddCategory} disabled={!newCatName || !newCatIcon} className="w-full bg-stone-800 text-white rounded-full py-3 font-bold disabled:opacity-50 active:scale-95 transition-transform">
               {editingCatId ? '保存' : '添加'}
             </button>
           </div>
        </div>
      </div>
    );
  }

  if (view === 'manager') {
    return (
      <div className="h-full flex flex-col bg-[#fafaf9] text-stone-800 font-sans">
        <div className="px-4 pt-14 pb-4 flex items-center justify-between bg-white shadow-sm z-10 sticky top-0 border-b border-stone-100">
          <button onClick={() => setView('home')} className="text-stone-500"><ChevronLeft size={28} /></button>
          <span className="font-bold text-lg">换个管家</span>
          <div className="w-7"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <button 
            onClick={() => { updateBillingManager(null); setView('home'); }} 
            className={`w-full flex items-center p-4 bg-white rounded-2xl shadow-sm border ${!billingManagerId ? 'border-stone-800 ring-1 ring-stone-800' : 'border-stone-100'}`}
          >
            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mr-4">
              <User size={24} className="text-stone-400" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold">自己管账 (无管家)</div>
            </div>
          </button>
          
          {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(c => (
            <button 
              key={c.id}
              onClick={() => { updateBillingManager(c.id); setView('home'); }}
              className={`w-full flex items-center p-4 bg-white rounded-2xl shadow-sm border ${billingManagerId === c.id ? 'border-stone-800 ring-1 ring-stone-800' : 'border-stone-100'}`}
            >
              <div className="w-12 h-12 rounded-full overflow-hidden mr-4 bg-stone-100">
                {!c.avatar.startsWith('#') && <img src={c.avatar} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 text-left">
                <div className="font-bold">{c.name}</div>
                <div className="text-xs text-stone-400 max-w-[200px] truncate">{c.personality || '暂无设定'}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Home view
  return (
    <div className="h-full flex flex-col bg-[#fafaf9] text-stone-800 font-sans">
      <div className="px-6 pt-16 pb-4 flex items-center justify-between sticky top-0 z-10">
        <button onClick={closeApp} className="w-10 h-10 flex -ml-3 items-center text-stone-400 hover:text-stone-800 transition-colors"><ChevronLeft size={28} /></button>
        <span className="font-black text-xl tracking-widest uppercase">Billing</span>
        <button onClick={() => setView('charts')} className="w-10 h-10 flex justify-end items-center text-stone-400 hover:text-stone-800 transition-colors ml-3"><PieChartIcon size={24} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-safe relative">
        
        {/* Header summary & Manager */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <div className="text-stone-400 text-sm font-medium mb-1">本月总支出</div>
            <div className="text-5xl font-black tabular-nums tracking-tighter">¥{totalExpense.toFixed(2)}</div>
          </div>
          <button onClick={() => setView('manager')} className="flex flex-col items-center group active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-white shadow-md border-2 border-white overflow-hidden mb-1 ring-2 ring-transparent group-hover:ring-stone-200 transition-all flex items-center justify-center">
               {manager ? (
                 manager.avatar.startsWith('#') ? <User size={20} className="text-stone-400" /> : <img src={manager.avatar} className="w-full h-full object-cover" />
               ) : (
                 <User size={20} className="text-stone-400" />
               )}
            </div>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest max-w-[80px] truncate">{manager ? manager.name : '+ 添加管家'}</span>
          </button>
        </div>

        <div className="flex justify-between items-center mb-4 px-2">
           <h3 className="font-bold text-stone-400 text-xs tracking-widest uppercase">近期记录</h3>
           <button onClick={() => setView('categories')} className="text-stone-400 text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:text-stone-800">类别管理 <Settings size={12}/></button>
        </div>

        <div className="space-y-4 pb-28">
           {filteredRecords.map(r => {
             const cat = billingCategories.find(c => c.id === r.categoryId);
             const rDate = new Date(r.timestamp);
             const today = new Date();
             const isToday = rDate.getDate() === today.getDate() && rDate.getMonth() === today.getMonth() && rDate.getFullYear() === today.getFullYear();
             
             return (
              <button key={r.id} onClick={() => openRecordDetail(r.id)} className="w-full text-left bg-white rounded-[1.5rem] p-5 shadow-sm border border-stone-100 flex items-start gap-4 active:scale-[0.98] transition-transform relative overflow-hidden">
                 
                 <div className="w-12 h-12 rounded-full flex justify-center items-center text-2xl shadow-inner shrink-0" style={{backgroundColor: cat?.color || '#eee'}}>
                    {cat?.icon || '?'}
                 </div>
                 
                 <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1 gap-3">
                      <div className="font-bold text-stone-800 text-lg truncate flex-1">{cat?.name || '未知类别'}</div>
                      <div className="font-black text-lg shrink-0 pr-10">- ¥{r.amount.toFixed(2)}</div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                       <div className="text-stone-400 text-sm truncate">{r.note || '无备注'}</div>
                       <div className="text-stone-300 text-xs font-medium whitespace-nowrap ml-4">
                          {isToday ? '今天' : `${rDate.getMonth()+1}/${rDate.getDate()}`} {rDate.getHours().toString().padStart(2,'0')}:{rDate.getMinutes().toString().padStart(2,'0')}
                       </div>
                    </div>

                    {r.managerComment && manager && (
                       <div className="mt-3 bg-stone-50 rounded-xl p-3 border border-stone-100 flex items-start gap-2 relative">
                         <div className="absolute -top-1.5 left-4 w-3 h-3 bg-stone-50 border-stone-100 border-l border-t rotate-45" />
                         <div className="text-xs text-stone-600 leading-relaxed font-medium tracking-wide">
                            "{r.managerComment}"
                         </div>
                       </div>
                    )}
                 </div>

                 <button
                   onClick={(e) => { e.stopPropagation(); openRecordDetail(r.id); }}
                   className="absolute top-4 right-4 text-stone-500 bg-stone-50 border border-stone-100 p-2 rounded-xl backdrop-blur"
                 >
                    <Trash2 size={16} />
                 </button>
              </button>
             )
           })}

           {filteredRecords.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-stone-300">
                <div className="text-6xl mb-4 opacity-50 text-stone-200">Receipt</div>
                <div className="font-bold tracking-widest uppercase">暂无任何记录</div>
              </div>
           )}
        </div>

        {/* Floating Add Button */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20">
           <button 
             onClick={() => setView('add')}
             className="w-16 h-16 bg-stone-800 text-white rounded-full flex justify-center items-center shadow-xl hover:scale-105 active:scale-95 transition-all text-3xl pb-1"
           >
             +
           </button>
        </div>
      </div>
    </div>
  );
}
