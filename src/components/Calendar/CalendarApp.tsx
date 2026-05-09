import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Eye, EyeOff, AlertCircle, CalendarHeart } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarDayRecord, CalendarEvent, CalendarPlan, CalendarTask } from '../../types';

export default function CalendarApp() {
  const { closeApp, calendarRecords, updateCalendarRecord, characters, addActivityLog } = useAppStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const record = calendarRecords[selectedDateStr] || { date: selectedDateStr, events: [], menstrual: false, dysmenorrhea: false, menstrualVisibleTo: [], feeling: '', feelingLevel: 5 };
  
  const plans = record.events.filter(e => e.type === 'plan');
  const tasks = record.events.filter(e => e.type === 'task');

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const [newPlan, setNewPlan] = useState<Partial<CalendarPlan>>({ type: 'plan', title: '', time: '12:00', isPublished: false, visibleTo: [] });
  const [newTask, setNewTask] = useState<Partial<CalendarTask>>({ type: 'task', title: '', priority: 'un' });

  const handleAddPlan = () => {
    if (!newPlan.title) return;
    const plan: CalendarPlan = { ...newPlan, id: Date.now().toString() } as CalendarPlan;
    updateCalendarRecord(selectedDateStr, { events: [...record.events, plan] });
    addActivityLog({
      id: `${Date.now()}_calendar_plan`,
      title: `日历计划：${plan.title}`,
      detail: `${selectedDateStr} ${plan.time}${plan.isPublished ? ' 已共享' : ''}`,
      timestamp: Date.now(),
      relatedCharacterIds: plan.visibleTo?.length ? plan.visibleTo : undefined
    });
    setShowAddPlan(false);
    setNewPlan({ type: 'plan', title: '', time: '12:00', isPublished: false, visibleTo: [] });
  };

  const handleAddTask = () => {
    if (!newTask.title) return;
    const task: CalendarTask = { ...newTask, id: Date.now().toString() } as CalendarTask;
    updateCalendarRecord(selectedDateStr, { events: [...record.events, task] });
    addActivityLog({
      id: `${Date.now()}_calendar_task`,
      title: `日历待办：${task.title}`,
      detail: `${selectedDateStr} 优先级 ${task.priority}`,
      timestamp: Date.now()
    });
    setShowAddTask(false);
    setNewTask({ type: 'task', title: '', priority: 'un' });
  };

  const removeEvent = (id: string) => {
    updateCalendarRecord(selectedDateStr, { events: record.events.filter(e => e.id !== id) });
  };

  const toggleMenstrualVisibleTo = (charId: string) => {
    const current = record.menstrualVisibleTo || [];
    const next = current.includes(charId) ? current.filter(id => id !== charId) : [...current, charId];
    updateCalendarRecord(selectedDateStr, { menstrualVisibleTo: next });
  };

  const togglePlanVisibleTo = (charId: string) => {
    const current = newPlan.visibleTo || [];
    const next = current.includes(charId) ? current.filter(id => id !== charId) : [...current, charId];
    setNewPlan({ ...newPlan, visibleTo: next });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-900 absolute inset-0 z-50">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-950 px-4 pt-12 pb-3 flex items-center justify-between border-b dark:border-white/5 shrink-0 shadow-sm">
        <button onClick={closeApp} className="p-1 -ml-1 text-slate-800 dark:text-zinc-100"><ChevronLeft size={24} /></button>
        <h1 className="text-lg font-medium dark:text-zinc-100 flex items-center gap-2"><CalendarIcon size={20} />日历与计划</h1>
        <div className="w-8"></div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Calendar View */}
        <div className="bg-white dark:bg-zinc-950 p-4 mb-2 shadow-sm rounded-b-xl border-b dark:border-white/5">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2"><ChevronLeft size={20} /></button>
            <h2 className="text-lg font-bold dark:text-zinc-100">{format(currentDate, 'yyyy年 MM月')}</h2>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2"><ChevronRight size={20} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400 mb-2">
            <div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div><div>日</div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayRecord = calendarRecords[dateStr];
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentDate);
              
              const hasPlan = dayRecord?.events.some(e => e.type === 'plan');
              const hasTask = dayRecord?.events.some(e => e.type === 'task');
              const isMenstrual = dayRecord?.menstrual;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square flex flex-col items-center justify-start py-1 rounded-lg relative transition-all ${
                    !isCurrentMonth ? 'opacity-30' : ''
                  } ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-500/30' : 'hover:bg-slate-100 dark:hover:bg-zinc-800'} ${isMenstrual ? 'bg-rose-50 dark:bg-rose-900/20' : ''}`}
                >
                  <span className={`text-sm ${isSelected ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'dark:text-zinc-300'}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="flex gap-1 mt-1">
                    {hasPlan && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>}
                    {hasTask && <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>}
                    {isMenstrual && <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details */}
        <div className="px-4 pb-12 space-y-4">
          <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400 text-sm font-medium">
            <span>{format(selectedDate, 'yyyy年MM月dd日')} 日程</span>
            <div className="flex gap-2">
              <button onClick={() => setShowAddPlan(true)} className="flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded shadow-sm hover:brightness-95"><Plus size={14}/><span>计划</span></button>
              <button onClick={() => setShowAddTask(true)} className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-1 rounded shadow-sm hover:brightness-95"><Plus size={14}/><span>待办</span></button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">每日主观感受</h3>
            <div className="flex items-center gap-3">
              <span className="text-lg">😢</span>
              <input
                type="range"
                min="0"
                max="10"
                value={record.feelingLevel ?? 5}
                onChange={e => updateCalendarRecord(selectedDateStr, { feelingLevel: parseInt(e.target.value) })}
                className="flex-1 h-3 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ef4444 0%, #f97316 20%, #eab308 40%, #22c55e 60%, #3b82f6 80%, #8b5cf6 100%)`
                }}
              />
              <span className="text-lg">😊</span>
              <span className="ml-2 w-8 text-center font-bold text-indigo-600 dark:text-indigo-400">{record.feelingLevel ?? 5}</span>
            </div>
            <textarea 
              value={record.feeling} 
              onChange={e => updateCalendarRecord(selectedDateStr, { feeling: e.target.value })}
              placeholder="今天感觉怎么样？"
              className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white resize-none h-20 dark:text-zinc-100"
            />
          </div>

          <div className="bg-white dark:bg-zinc-950 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><CalendarHeart size={16} /> 经期记录</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-sm dark:text-zinc-300">
                  <input type="checkbox" checked={record.menstrual} onChange={e => updateCalendarRecord(selectedDateStr, { menstrual: e.target.checked })} className="rounded text-rose-500 focus:ring-rose-500" />
                  来月经
                </label>
                {record.menstrual && (
                  <label className="flex items-center gap-1 text-sm dark:text-zinc-300">
                    <input type="checkbox" checked={record.dysmenorrhea} onChange={e => updateCalendarRecord(selectedDateStr, { dysmenorrhea: e.target.checked })} className="rounded text-rose-500 focus:ring-rose-500" />
                    痛经
                  </label>
                )}
              </div>
            </div>
            {record.menstrual && (
              <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                <p className="text-xs text-slate-500 mb-2">分享给谁（TA们会主动关心你并在下月提醒）：</p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => toggleMenstrualVisibleTo(c.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${record.menstrualVisibleTo?.includes(c.id) ? 'bg-rose-100 border-rose-200 text-rose-700 dark:bg-rose-900/40 dark:border-rose-700/50 dark:text-rose-300' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {plans.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1">📅 计划</h3>
              {plans.map(event => (
                <div key={event.id} className="bg-white dark:bg-zinc-950 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-white/5 flex gap-3 relative">
                  <button onClick={() => removeEvent(event.id)} className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><X size={14}/></button>
                  
                  <div className="flex flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg px-3 py-2 shrink-0">
                    <span className="font-bold text-lg leading-tight">{event.time.split(':')[0]}</span>
                    <span className="text-xs font-medium opacity-80">{event.time.split(':')[1]}</span>
                  </div>
                  <div className="flex-1 py-1">
                    <h4 className="font-medium text-slate-800 dark:text-zinc-100">{event.title}</h4>
                    {event.isPublished ? (
                       <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                         <Eye size={12}/> 已共享: {event.visibleTo.map(id => characters[id]?.name).filter(Boolean).join(', ') || '无'}
                       </div>
                    ) : (
                       <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                         <EyeOff size={12}/> 仅自己可见
                       </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">✅ 待办</h3>
              {tasks.map(event => (
                <div key={event.id} className="bg-white dark:bg-zinc-950 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-white/5 flex gap-3 relative">
                  <button onClick={() => removeEvent(event.id)} className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><X size={14}/></button>
                  
                  <div className={`w-2 shrink-0 rounded-full ${
                    event.priority === 'ui' ? 'bg-red-500' :
                    event.priority === 'in' ? 'bg-amber-400' :
                    event.priority === 'un' ? 'bg-blue-400' : 'bg-slate-300'
                  }`}></div>
                  <div className="flex-1 py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                        event.priority === 'ui' ? 'border-red-200 text-red-600 bg-red-50 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-300' :
                        event.priority === 'in' ? 'border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500/30 dark:text-amber-300' :
                        event.priority === 'un' ? 'border-blue-200 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500/30 dark:text-blue-300' : 'border-slate-200 text-slate-500 bg-slate-50'
                      }">
                        {event.priority === 'ui' ? '重要紧急' : event.priority === 'in' ? '重要不紧急' : event.priority === 'un' ? '紧急不重要' : '不重要不紧急'}
                      </span>
                    </div>
                    <h4 className="font-medium text-slate-800 dark:text-zinc-100 mt-1.5">{event.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          )}

          {record.events.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm bg-white dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-white/5 border-dashed">
              今天没有计划和待办事项
            </div>
          )}
        </div>
      </div>

      {/* Add Plan Modal */}
      {showAddPlan && (
        <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl p-6 pb-8 transform animate-slide-up shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white">新增计划</h3>
              <button onClick={() => setShowAddPlan(false)} className="p-2 bg-slate-100 dark:bg-black rounded-full dark:text-zinc-400"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">时间</label>
                <input type="time" value={newPlan.time} onChange={e => setNewPlan({...newPlan, time: e.target.value})} className="w-full bg-slate-50 dark:bg-black dark:text-white border px-3 py-3 rounded-xl border-slate-200 dark:border-white/10 outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">计划内容</label>
                <input type="text" value={newPlan.title} onChange={e => setNewPlan({...newPlan, title: e.target.value})} placeholder="输入计划名称" className="w-full bg-slate-50 dark:bg-black dark:text-white border px-3 py-3 rounded-xl border-slate-200 dark:border-white/10 outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium dark:text-zinc-300">
                  <input type="checkbox" checked={newPlan.isPublished} onChange={e => setNewPlan({...newPlan, isPublished: e.target.checked})} className="rounded w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                  公开并通知角色
                </label>
              </div>
              {newPlan.isPublished && (
                <div className="p-3 bg-slate-50 dark:bg-black rounded-xl border border-slate-100 dark:border-white/5 space-y-2">
                  <p className="text-xs text-slate-500">选择要通知的角色（即将到期时TA们会发微信提醒你）：</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(characters).filter(c=>(c as any).isDisabled !== true).map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => togglePlanVisibleTo(c.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${newPlan.visibleTo?.includes(c.id) ? 'bg-indigo-100 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700/50 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'}`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={handleAddPlan} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all">
                保存计划
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl p-6 pb-8 transform animate-slide-up shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold dark:text-white">新增待办</h3>
              <button onClick={() => setShowAddTask(false)} className="p-2 bg-slate-100 dark:bg-black rounded-full dark:text-zinc-400"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">待办内容</label>
                <input type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} placeholder="输入任务名称" className="w-full bg-slate-50 dark:bg-black dark:text-white border px-3 py-3 rounded-xl border-slate-200 dark:border-white/10 outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">四象限优先级</label>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => setNewTask({...newTask, priority: 'ui'})} className={`p-3 rounded-xl border text-sm font-medium ${newTask.priority === 'ui' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-black dark:border-white/5 dark:text-zinc-400'}`}>重要紧急</button>
                   <button onClick={() => setNewTask({...newTask, priority: 'in'})} className={`p-3 rounded-xl border text-sm font-medium ${newTask.priority === 'in' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-500/30 dark:text-amber-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-black dark:border-white/5 dark:text-zinc-400'}`}>重要不紧急</button>
                   <button onClick={() => setNewTask({...newTask, priority: 'un'})} className={`p-3 rounded-xl border text-sm font-medium ${newTask.priority === 'un' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500/30 dark:text-blue-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-black dark:border-white/5 dark:text-zinc-400'}`}>紧急不重要</button>
                   <button onClick={() => setNewTask({...newTask, priority: 'nn'})} className={`p-3 rounded-xl border text-sm font-medium ${newTask.priority === 'nn' ? 'bg-slate-200 border-slate-300 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-black dark:border-white/5 dark:text-zinc-400'}`}>不重要不紧急</button>
                </div>
              </div>
              <button onClick={handleAddTask} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all">
                保存待办
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
