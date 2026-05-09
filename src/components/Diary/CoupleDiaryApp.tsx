import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store';
import { ChevronLeft, ChevronRight, Heart, Plus, Camera, Cloud, Sun, CloudRain, Snowflake, Zap, Smile, Frown, Meh, Angry, Laugh, Heart as HeartIcon, X, Settings, Calendar, Trash2, Edit3, Bell, Palette, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { CoupleDiaryEntry, SpecialEvent } from '../../types';
import ImageUploader from '../ImageUploader';
import { format, differenceInDays, parseISO, isSameDay, addDays } from 'date-fns';

const MOODS = [
  { icon: Laugh, label: '超开心', color: '#fbbf24' },
  { icon: Smile, label: '开心', color: '#34d399' },
  { icon: HeartIcon, label: '甜蜜', color: '#f472b6' },
  { icon: Meh, label: '一般', color: '#9ca3af' },
  { icon: Frown, label: '难过', color: '#60a5fa' },
  { icon: Angry, label: '生气', color: '#f87171' },
];

const WEATHER = [
  { icon: Sun, label: '晴天' },
  { icon: Cloud, label: '多云' },
  { icon: CloudRain, label: '雨天' },
  { icon: Snowflake, label: '雪天' },
  { icon: Zap, label: '雷暴' },
];

const BACKGROUND_COLORS = [
  '#fef3f2', '#fefce8', '#f0fdf4', '#ecfeff', '#eff6ff',
  '#fdf4ff', '#fff1f2', '#fffbeb', '#fscfdf', '#f5f3ff',
  '#ffffff', '#f9fafb', '#f3f4f6', '#e5e7eb', '#d1d5db',
];

const HOLIDAYS = [
  { name: '情人节', month: 2, day: 14 },
  { name: '七夕', month: 8, day: 10 },
  { name: '520', month: 5, day: 20 },
  { name: '521', month: 5, day: 21 },
];

export default function CoupleDiaryApp({ onBack }: { onBack: () => void }) {
  const { characters, settings, coupleDiaries, createCoupleDiary, addCoupleDiaryEntry, updateCoupleDiary, deleteCoupleDiaryEntry, addSpecialEvent, deleteSpecialEvent, setNotification } = useAppStore();
  const [showInvite, setShowInvite] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSpecialEvents, setShowSpecialEvents] = useState(false);
  const [showSpecialEventEntry, setShowSpecialEventEntry] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [selectedWeather, setSelectedWeather] = useState<number | null>(null);
  const [entryTitle, setEntryTitle] = useState('');
  const [entryContent, setEntryContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedBgColor, setSelectedBgColor] = useState(BACKGROUND_COLORS[0]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<'low' | 'medium' | 'high' | 'off'>('medium');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [upcomingReminders, setUpcomingReminders] = useState<{ name: string; days: number; date: Date }[]>([]);
  const [editStartDate, setEditStartDate] = useState(false);
  const [startDateValue, setStartDateValue] = useState('');
  const [specialEventName, setSpecialEventName] = useState('');
  const [specialEventColor, setSpecialEventColor] = useState(BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newReminderName, setNewReminderName] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');
  const [newReminderNotifyBefore, setNewReminderNotifyBefore] = useState(3);
  const [showReminderPage, setShowReminderPage] = useState(false);
  const [editingReminder, setEditingReminder] = useState<any>(null);
  const [reminderNotification, setReminderNotification] = useState<{ title: string; message: string } | null>(null);
  
  const toggleExpanded = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const checkAndShowNotifications = () => {
    if (!currentDiary) return;
    
    const today = new Date();
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    
    const shouldNotify = (currentHour === 10 && currentMinute < 5) || 
                         (currentHour === 18 && currentMinute < 5);
    
    if (!shouldNotify) return;
    
    const remindersToShow: { name: string; days: number }[] = [];
    
    currentDiary.reminders?.forEach(reminder => {
      if (!reminder.enabled) return;
      
      if (reminder.type === 'holiday' && reminder.month && reminder.day) {
        let holidayDate = new Date(today.getFullYear(), reminder.month - 1, reminder.day);
        if (holidayDate < today) {
          holidayDate = new Date(today.getFullYear() + 1, reminder.month - 1, reminder.day);
        }
        const daysUntil = differenceInDays(holidayDate, today);
        if (daysUntil <= reminder.notifyBefore && daysUntil >= 0) {
          remindersToShow.push({ name: reminder.name, days: daysUntil });
        }
      }
    });
    
    currentDiary.specialEvents?.forEach(event => {
      if (!event.enabled) return;
      try {
        const eventDate = parseISO(event.date);
        const daysUntil = differenceInDays(eventDate, today);
        if (daysUntil <= 7 && daysUntil >= 0) {
          remindersToShow.push({ name: event.name, days: daysUntil });
        }
      } catch {}
    });
    
    if (remindersToShow.length > 0) {
        const firstReminder = remindersToShow[0];
        setReminderNotification({
          title: firstReminder.name,
          message: firstReminder.days === 0 ? '今天是个特别的日子！' : 
                   firstReminder.days === 1 ? '明天就是重要的日子！' : 
                   `${firstReminder.days}天后有重要的日子！`,
        });
        
        setTimeout(() => {
          setReminderNotification(null);
        }, 5000);
      }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDark = settings.wechatTheme === 'dark';
  const currentDiary = coupleDiaries[0];
  
  useEffect(() => {
    checkAndShowNotifications();
    
    const interval = setInterval(() => {
      checkAndShowNotifications();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [currentDiary]);
  const partner = currentDiary ? characters[currentDiary.partnerId] : null;

  useEffect(() => {
    if (currentDiary) {
      checkReminders();
      setFrequency(currentDiary.partnerWritingFrequency || 'medium');
    }
  }, [currentDiary]);

  useEffect(() => {
    if (currentDiary?.partnerWritingFrequency) {
      setFrequency(currentDiary.partnerWritingFrequency);
    }
  }, [currentDiary?.partnerWritingFrequency]);

  const checkReminders = () => {
    if (!currentDiary || !currentDiary.startDate) return;
    const reminders: { name: string; days: number; date: Date }[] = [];
    const today = new Date();
    const startDate = new Date(currentDiary.startDate);

    const daysTogether = differenceInDays(today, startDate);

    currentDiary.reminders?.forEach(reminder => {
      if (!reminder.enabled) return;
      if (reminder.type === 'anniversary') {
        reminder.days.forEach(day => {
          const nextDate = addDays(startDate, day);
          if (nextDate >= today) {
            const daysUntil = differenceInDays(nextDate, today);
            if (daysUntil <= reminder.notifyBefore) {
              reminders.push({ name: `${reminder.name}第${day}天`, days: daysUntil, date: nextDate });
            }
          }
        });
      } else if (reminder.type === 'holiday') {
        const currentYear = today.getFullYear();
        const holiday = HOLIDAYS.find(h => h.name === reminder.name);
        if (holiday) {
          let holidayDate = new Date(currentYear, holiday.month - 1, holiday.day);
          if (holidayDate < today) {
            holidayDate = new Date(currentYear + 1, holiday.month - 1, holiday.day);
          }
          const daysUntil = differenceInDays(holidayDate, today);
          if (daysUntil <= reminder.notifyBefore && daysUntil >= 0) {
            reminders.push({ name: reminder.name, days: daysUntil, date: holidayDate });
          }
        }
      }
    });

    currentDiary.specialEvents?.forEach(event => {
      try {
        const eventDate = parseISO(event.date);
        if (eventDate >= today) {
          const daysUntil = differenceInDays(eventDate, today);
          if (daysUntil <= 7) {
            reminders.push({ name: event.name, days: daysUntil, date: eventDate });
          }
        }
      } catch {}
    });

    setUpcomingReminders(reminders.sort((a, b) => a.days - b.days));
  };

  const simulatePartnerWriting = () => {
    if (!currentDiary || frequency === 'off') return;
    const partnerMessages = [
      `今天的${partner?.name || 'TA'}也很想你哦~`,
      `和你在一起的每一天都是美好的`,
      `${partner?.name || 'TA'}爱你哟~`,
      `今天梦到你了，好开心！`,
      `期待和你见面呢~`,
    ];
    const randomContent = partnerMessages[Math.floor(Math.random() * partnerMessages.length)];
    const entry: CoupleDiaryEntry = {
      id: `partner_${Date.now()}`,
      authorId: currentDiary.partnerId,
      title: `${partner?.name || 'TA'}的日记`,
      content: randomContent,
      photos: [],
      createdAt: Date.now(),
      moods: [MOODS[Math.floor(Math.random() * 3)].label],
    };
    addCoupleDiaryEntry(currentDiary.id, entry);
  };

  useEffect(() => {
    if (!currentDiary || frequency === 'off') return;
    const intervals: Record<string, number> = {
      low: 4 * 60 * 60 * 1000,
      medium: 2 * 60 * 60 * 1000,
      high: 30 * 60 * 1000,
    };
    const interval = intervals[frequency];
    if (interval) {
      const timer = setTimeout(() => {
        simulatePartnerWriting();
      }, interval);
      return () => clearTimeout(timer);
    }
  }, [currentDiary, frequency, currentDiary?.entries.length]);

  const handleCreateDiary = (partnerId: string) => {
    createCoupleDiary(partnerId);
    setShowInvite(false);
  };

  const handleAddEntry = () => {
    if (!currentDiary || (!entryContent.trim() && photos.length === 0)) return;
    
    const specialEvent = selectedEventId ? currentDiary.specialEvents?.find(e => e.id === selectedEventId) : null;
    
    const newEntry: CoupleDiaryEntry = {
      id: Date.now().toString(),
      authorId: 'user',
      title: entryTitle || '今日日记',
      content: entryContent,
      photos,
      createdAt: Date.now(),
      moods: selectedMood !== null ? [MOODS[selectedMood].label] : [],
      weather: selectedWeather !== null ? WEATHER[selectedWeather].label : undefined,
      backgroundColor: selectedBgColor,
      isSpecialEvent: !!specialEvent,
      eventId: selectedEventId || undefined,
    };
    
    addCoupleDiaryEntry(currentDiary.id, newEntry);
    setShowNewEntry(false);
    setEntryTitle('');
    setEntryContent('');
    setPhotos([]);
    setSelectedMood(null);
    setSelectedWeather(null);
    setSelectedBgColor(BACKGROUND_COLORS[0]);
    setSelectedEventId(null);
  };

  const handleAddSpecialEventEntry = () => {
    if (!currentDiary || (!entryContent.trim() && photos.length === 0)) return;
    if (!specialEventName.trim()) return;
    
    const event: SpecialEvent = {
      id: Date.now().toString(),
      name: specialEventName.trim(),
      date: format(new Date(), 'yyyy-MM-dd'),
      color: specialEventColor,
      enabled: true,
    };
    
    addSpecialEvent(currentDiary.id, event);
    
    const newEntry: CoupleDiaryEntry = {
      id: (Date.now() + 1).toString(),
      authorId: 'user',
      title: entryTitle || specialEventName.trim(),
      content: entryContent,
      photos,
      createdAt: Date.now(),
      moods: selectedMood !== null ? [MOODS[selectedMood].label] : [],
      weather: selectedWeather !== null ? WEATHER[selectedWeather].label : undefined,
      backgroundColor: selectedBgColor,
      isSpecialEvent: true,
      eventId: event.id,
    };
    
    addCoupleDiaryEntry(currentDiary.id, newEntry);
    setShowSpecialEventEntry(false);
    setEntryTitle('');
    setEntryContent('');
    setPhotos([]);
    setSelectedMood(null);
    setSelectedWeather(null);
    setSelectedBgColor(BACKGROUND_COLORS[0]);
    setSpecialEventName('');
    setSpecialEventColor(BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)]);
  };

  const handleDeleteEntry = (entryId: string) => {
    if (!currentDiary) return;
    deleteCoupleDiaryEntry(currentDiary.id, entryId);
    setDeleteConfirm(null);
  };

  const handleFrequencyChange = (newFreq: 'low' | 'medium' | 'high' | 'off') => {
    if (!currentDiary) return;
    setFrequency(newFreq);
    updateCoupleDiary(currentDiary.id, { partnerWritingFrequency: newFreq });
  };

  const handleDeleteEvent = (eventId: string) => {
    if (!currentDiary) return;
    const event = currentDiary.specialEvents?.find(e => e.id === eventId);
    if (!event) return;
    
    if (confirm(`确定要删除"${event.name}"吗？关联的日记也会被删除。`)) {
      currentDiary.entries?.forEach(entry => {
        if (entry.eventId === eventId) {
          deleteCoupleDiaryEntry(currentDiary.id, entry.id);
        }
      });
      deleteSpecialEvent(currentDiary.id, eventId);
    }
  };

  const handleToggleReminder = (reminderId: string) => {
    if (!currentDiary) return;
    const updatedReminders = currentDiary.reminders?.map(r => 
      r.id === reminderId ? { ...r, enabled: !r.enabled } : r
    );
    updateCoupleDiary(currentDiary.id, { reminders: updatedReminders });
    setTimeout(() => checkReminders(), 100);
  };

  const handleAddReminder = () => {
    if (!currentDiary || !newReminderName.trim() || !newReminderDate) return;
    
    const date = new Date(newReminderDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const existingReminders = currentDiary.reminders || [];
    const newReminder = {
      id: Date.now().toString(),
      type: 'holiday' as const,
      name: newReminderName.trim(),
      days: [0],
      notifyBefore: newReminderNotifyBefore,
      enabled: true,
      month,
      day,
    };
    
    updateCoupleDiary(currentDiary.id, { reminders: [...existingReminders, newReminder] });
    setShowAddReminder(false);
    setNewReminderName('');
    setNewReminderDate('');
    setNewReminderNotifyBefore(3);
    setTimeout(() => checkReminders(), 100);
  };

  const handleDeleteReminder = (reminderId: string) => {
    if (!currentDiary) return;
    const updatedReminders = currentDiary.reminders?.filter(r => r.id !== reminderId);
    updateCoupleDiary(currentDiary.id, { reminders: updatedReminders });
    setTimeout(() => checkReminders(), 100);
  };

  const handleUpdateReminder = () => {
    if (!currentDiary || !editingReminder) return;
    
    const date = new Date(newReminderDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const updatedReminders = currentDiary.reminders?.map(r => 
      r.id === editingReminder.id 
        ? { 
            ...r, 
            name: newReminderName.trim(), 
            notifyBefore: newReminderNotifyBefore,
            month,
            day,
          } 
        : r
    );
    
    updateCoupleDiary(currentDiary.id, { reminders: updatedReminders });
    setShowAddReminder(false);
    setEditingReminder(null);
    setNewReminderName('');
    setNewReminderDate('');
    setNewReminderNotifyBefore(3);
    setTimeout(() => checkReminders(), 100);
  };

  const handleToggleEventReminder = (eventId: string) => {
    if (!currentDiary) return;
    const event = currentDiary.specialEvents?.find(e => e.id === eventId);
    if (!event) return;
    updateCoupleDiary(currentDiary.id, {
      specialEvents: currentDiary.specialEvents.map(e => 
        e.id === eventId ? { ...e, enabled: !e.enabled } : e
      )
    });
  };

  const handleUpdateStartDate = () => {
    if (!currentDiary || !startDateValue) return;
    const newStartDate = new Date(startDateValue).getTime();
    updateCoupleDiary(currentDiary.id, { startDate: newStartDate });
    setEditStartDate(false);
    setStartDateValue('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || photos.length >= 9) return;
    
    Array.from(files).slice(0, 9 - photos.length).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const daysTogether = currentDiary && currentDiary.startDate ? differenceInDays(new Date(), new Date(currentDiary.startDate)) + 1 : 0;

  if (!currentDiary) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-pink-50 to-rose-100 dark:from-gray-900 dark:to-gray-800 z-50 absolute inset-0">
        <div className="pt-14 pb-4 px-4 flex items-center gap-4 bg-white/60 dark:bg-black/60 backdrop-blur-lg">
          <button onClick={onBack} className="p-2 text-gray-700 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">情侣日记</h1>
          </div>
          <button onClick={() => setShowInvite(true)} className="text-pink-500 font-medium">
            <Plus size={24} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-32 h-32 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center mb-6">
            <Heart size={64} className="text-pink-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">开启情侣日记</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-6">和你的另一半一起记录每一天的美好时光</p>
          <button 
            onClick={() => setShowInvite(true)}
            className="px-8 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-full font-medium shadow-lg hover:shadow-xl transition-all"
          >
            邀请另一半
          </button>
        </div>

        {showInvite && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <div className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-2xl w-full max-w-sm p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">邀请另一半</h3>
                <button onClick={() => setShowInvite(false)} className="text-gray-400">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">选择一个角色作为你的另一半</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.values(characters).filter(c => c.isDisabled !== true).map(char => (
                  <button
                    key={char.id}
                    onClick={() => handleCreateDiary(char.id)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors"
                  >
                    <div 
                      className="w-12 h-12 rounded-full"
                      style={{ background: char.avatar.startsWith('#') ? char.avatar : `url(${char.avatar}) center/cover` }}
                    />
                    <div className="text-left">
                      <div className="font-medium text-gray-800 dark:text-white">{char.name}</div>
                      <div className="text-xs text-gray-400">{char.personality?.slice(0, 20)}...</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-pink-50 to-rose-50 dark:from-gray-900 dark:to-gray-800 z-50 absolute inset-0">
      <div className="pt-14 pb-3 px-4 bg-white/60 dark:bg-black/60 backdrop-blur-lg relative z-50">
        <div className="flex items-center justify-between mb-2 h-10">
          <button onClick={onBack} className="p-2 text-gray-700 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <div className="absolute left-1/2 transform -translate-x-1/2 text-center">
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">情侣日记</h1>
            <p className="text-xs text-pink-500">与 {partner?.name} 的故事 · 第{daysTogether}天</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSettings(true)} className="p-2 text-gray-500">
              <Settings size={20} />
            </button>
            <button onClick={() => setShowAddMenu(!showAddMenu)} className="p-2 text-pink-500 relative">
              <Plus size={24} />
            </button>
          </div>
        </div>
        
        {partner && (
          <div className="flex items-center justify-center gap-3 pb-2">
            <div 
              className="w-8 h-8 rounded-full border-2 border-white shadow"
              style={{ background: settings.wechatAvatar.startsWith('#') ? settings.wechatAvatar : `url(${settings.wechatAvatar}) center/cover` }}
            />
            <HeartIcon size={16} className="text-pink-500 fill-pink-500" />
            <div 
              className="w-8 h-8 rounded-full border-2 border-pink-200 shadow"
              style={{ background: partner.avatar.startsWith('#') ? partner.avatar : `url(${partner.avatar}) center/cover` }}
            />
          </div>
        )}

      </div>

      {showAddMenu && (
        <div className="fixed right-4 top-28 z-[100] bg-white dark:bg-gray-800 rounded-xl shadow-xl p-2 min-w-36 border border-gray-100 dark:border-gray-700">
          <button
            onClick={() => {
              setShowAddMenu(false);
              setShowNewEntry(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors"
          >
            <Edit3 size={18} className="text-pink-500" />
            写日记
          </button>
          <button
            onClick={() => {
              setShowAddMenu(false);
              setShowSpecialEventEntry(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors"
          >
            <HeartIcon size={18} className="text-pink-500" />
            特殊事件
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 relative z-0">
        {currentDiary.entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <HeartIcon size={48} className="text-pink-300 mb-3" />
            <p className="text-gray-500">还没有日记，</p>
            <p className="text-gray-500">点击右上角 + 开始记录</p>
          </div>
        ) : (
          <div className="max-w-md mx-auto space-y-4">
            {currentDiary.entries.sort((a, b) => b.createdAt - a.createdAt).map(item => {
              const isOwnEntry = item.authorId === 'user';
              const event = item.eventId ? currentDiary.specialEvents?.find(e => e.id === item.eventId) : null;
              return (
                <div 
                  key={item.id} 
                  className="rounded-2xl p-4 shadow-sm relative group z-10"
                  style={{ backgroundColor: item.backgroundColor || '#ffffff' }}
                >
                  {event && (
                    <div 
                      className="absolute top-0 left-0 right-0 h-2 rounded-t-2xl"
                      style={{ backgroundColor: event.color }}
                    />
                  )}
                  <div className="flex items-center justify-between mb-3 mt-1 relative z-10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div 
                        className="w-6 h-6 rounded-full"
                        style={{ 
                          background: item.authorId === 'user' 
                            ? (settings.wechatAvatar.startsWith('#') ? settings.wechatAvatar : `url(${settings.wechatAvatar}) center/cover`)
                            : (partner?.avatar.startsWith('#') ? partner.avatar : `url(${partner.avatar}) center/cover`)
                        }}
                      />
                      <span className="text-sm font-medium text-gray-800 dark:text-white">
                        {item.authorId === 'user' ? '我' : partner?.name}
                      </span>
                      {event ? (
                        <span 
                          className="text-xs font-medium px-2 py-0.5 rounded-full border"
                          style={{ 
                            backgroundColor: event.color,
                            borderColor: event.color,
                            color: '#fff'
                          }}
                        >
                          ★ {event.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{format(item.createdAt, 'MM月dd日 HH:mm')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {isOwnEntry && (
                        <button
                          onClick={() => setDeleteConfirm(item.id)}
                          className="p-1.5 opacity-100 transition-opacity bg-red-100/80 dark:bg-red-900/30 text-red-500 rounded-full hover:bg-red-200 dark:hover:bg-red-800/40"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {item.weather && (
                        <span className="text-xs text-gray-500">{item.weather}</span>
                      )}
                      {item.moods?.map((mood, i) => (
                        <span key={i} className="text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 px-2 py-0.5 rounded-full">
                          {mood}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-gray-800 dark:text-white mb-2 relative z-10">{item.title}</h3>
                  
                  {item.photos?.length > 0 && (
                    <div className={`grid gap-1 mb-3 ${item.photos.length === 1 ? 'grid-cols-1' : item.photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {item.photos.map((photo, i) => (
                        <img key={i} src={photo} alt="" className="w-full h-32 object-cover rounded-lg" />
                      ))}
                    </div>
                  )}
                  
                  <div className="relative z-10">
                    <p className={`text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap transition-all ${
                      expandedEntries.has(item.id) ? '' : 'line-clamp-6 max-h-32 overflow-hidden'
                    }`}>{item.content}</p>
                    
                    {(item.content.split('\n').length > 6 || (item.content.length > 150 && !item.content.includes('\n'))) && (
                      <button
                        onClick={() => toggleExpanded(item.id)}
                        className="absolute bottom-0 right-0 flex items-center justify-center w-7 h-7 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow-md hover:shadow-lg transition-all mt-1"
                        title={expandedEntries.has(item.id) ? '收起' : '展开'}
                      >
                        {expandedEntries.has(item.id) ? (
                          <ChevronUp size={16} className="text-gray-500" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-500" />
                        )}
                      </button>
                    )}
                  </div>
                  
                  {item.eventId && (() => {
                    const evt = currentDiary.specialEvents?.find(e => e.id === item.eventId);
                    if (!evt) return null;
                    return (
                      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 relative z-10">
                        <span 
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: evt.color }}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          💝 {evt.name}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <div className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-2xl w-full max-w-xs p-6`}>
            <h3 className="text-lg font-bold mb-2">确认删除</h3>
            <p className="text-gray-500 mb-4">确定要删除这条日记吗？此操作无法撤销。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 rounded-full"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteEntry(deleteConfirm)}
                className="flex-1 py-2 bg-red-500 text-white rounded-full"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end">
          <div className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl w-full p-6 max-h-[80vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400">
                <X size={24} />
              </button>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <Clock size={16} />
                {partner?.name}写日记频率
              </h4>
              <div className="flex gap-2">
                {[
                  { key: 'off', label: '关闭' },
                  { key: 'low', label: '低' },
                  { key: 'medium', label: '中' },
                  { key: 'high', label: '高' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => handleFrequencyChange(f.key as any)}
                    className={`flex-1 py-2 rounded-full text-sm ${
                      frequency === f.key 
                        ? 'bg-pink-500 text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowReminderPage(true)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center">
                  <Calendar size={20} className="text-pink-500" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-200">纪念日提醒</div>
                  <div className="text-xs text-gray-500">管理和设置纪念日</div>
                </div>
              </div>
              <ChevronRight size={20} className="text-gray-400" />
            </button>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center justify-between">
                <span>起始日期</span>
                {!editStartDate && (
                  <button onClick={() => {
                    setEditStartDate(true);
                    if (currentDiary.startDate) {
                      setStartDateValue(format(currentDiary.startDate, 'yyyy-MM-dd'));
                    }
                  }} className="text-xs text-pink-500">
                    <Edit3 size={14} /> 编辑
                  </button>
                )}
              </h4>
              {editStartDate ? (
                <div className="space-y-3">
                  <input
                    type="date"
                    value={startDateValue}
                    onChange={e => setStartDateValue(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'} outline-none`}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditStartDate(false);
                        setStartDateValue('');
                      }}
                      className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleUpdateStartDate}
                      disabled={!startDateValue}
                      className="flex-1 py-2 bg-pink-500 text-white rounded-full text-sm disabled:opacity-50"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {currentDiary.startDate ? format(currentDiary.startDate, 'yyyy年MM月dd日') : '未设置'} · 已在一起 {daysTogether} 天
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showAddReminder && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-end">
          <div className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl w-full p-6`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{editingReminder ? '编辑纪念日' : '新增纪念日提醒'}</h3>
              <button onClick={() => {
                setShowAddReminder(false);
                setEditingReminder(null);
                setNewReminderName('');
                setNewReminderDate('');
                setNewReminderNotifyBefore(3);
              }} className="text-gray-400">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-2 block">纪念日名称</label>
                <input
                  type="text"
                  value={newReminderName}
                  onChange={e => setNewReminderName(e.target.value)}
                  placeholder="如：生日、纪念日..."
                  className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'} outline-none`}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block">日期</label>
                <input
                  type="date"
                  value={newReminderDate}
                  onChange={e => setNewReminderDate(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'} outline-none`}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-2 block">提前提醒天数</label>
                <div className="flex gap-2">
                  {[1, 3, 5, 7].map(days => (
                    <button
                      key={days}
                      onClick={() => setNewReminderNotifyBefore(days)}
                      className={`flex-1 py-2 rounded-full text-sm ${
                        newReminderNotifyBefore === days 
                          ? 'bg-pink-500 text-white' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                      }`}
                    >
                      {days}天
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddReminder(false);
                    setEditingReminder(null);
                    setNewReminderName('');
                    setNewReminderDate('');
                    setNewReminderNotifyBefore(3);
                  }}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 rounded-full"
                >
                  取消
                </button>
                <button
                  onClick={editingReminder ? handleUpdateReminder : handleAddReminder}
                  disabled={!newReminderName.trim() || !newReminderDate}
                  className="flex-1 py-3 bg-pink-500 text-white rounded-full disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReminderPage && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => setShowReminderPage(false)} className="p-2 text-gray-700 dark:text-gray-200">
              <ChevronLeft size={24} />
            </button>
            <div className="flex-1 text-center">
              <h2 className="font-bold">纪念日提醒</h2>
            </div>
            <button 
              onClick={() => {
                setEditingReminder(null);
                setNewReminderName('');
                setNewReminderDate('');
                setNewReminderNotifyBefore(3);
                setShowAddReminder(true);
              }}
              className="text-pink-500 font-medium flex items-center gap-1"
            >
              <Plus size={20} />
              新增
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {((currentDiary.reminders && currentDiary.reminders.length > 0 ? currentDiary.reminders : [
              { id: '1', type: 'anniversary' as const, name: '纪念日', days: [52, 100, 365], notifyBefore: 3, enabled: true },
              { id: '2', type: 'holiday' as const, name: '情人节', days: [0], notifyBefore: 7, enabled: true },
              { id: '3', type: 'holiday' as const, name: '七夕', days: [0], notifyBefore: 7, enabled: true },
              { id: '4', type: 'holiday' as const, name: '520', days: [0], notifyBefore: 3, enabled: true },
              { id: '5', type: 'holiday' as const, name: '圣诞节', days: [0], notifyBefore: 7, enabled: true },
            ]) as any[]).map(reminder => (
              <div key={reminder.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{reminder.name}</span>
                    {reminder.month && reminder.day && (
                      <span className="text-xs text-gray-500">{reminder.month}月{reminder.day}日</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    提前{reminder.notifyBefore}天提醒
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleReminder(reminder.id)}
                    className="relative w-10 h-5 rounded-full transition-colors"
                    style={{ backgroundColor: reminder.enabled ? '#ec4899' : '#9ca3af' }}
                  >
                    <div 
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                      style={{ transform: reminder.enabled ? 'translateX(20px)' : 'translateX(2px)' }}
                    />
                  </button>
                  <button
                    onClick={() => {
                      setEditingReminder(reminder);
                      setNewReminderName(reminder.name);
                      setNewReminderDate(reminder.month ? `${new Date().getFullYear()}-${String(reminder.month).padStart(2, '0')}-${String(reminder.day).padStart(2, '0')}` : '');
                      setNewReminderNotifyBefore(reminder.notifyBefore);
                      setShowAddReminder(true);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteReminder(reminder.id)}
                    className="p-2 text-red-400 hover:text-red-500"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSpecialEvents && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end">
          <div className={`${isDark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl w-full p-6 max-h-[80vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">特殊事件</h3>
              <button onClick={() => setShowSpecialEvents(false)} className="text-gray-400">
                <X size={24} />
              </button>
            </div>

            {currentDiary.specialEvents?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">还没有特殊事件</p>
                <p className="text-xs text-gray-400 mt-2">在写日记页面创建特殊事件</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentDiary.specialEvents?.map(event => {
                  const eventDate = parseISO(event.date);
                  const daysUntil = differenceInDays(eventDate, new Date());
                  return (
                    <div 
                      key={event.id} 
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ backgroundColor: event.color }}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{event.name}</div>
                        <div className="text-xs text-gray-500">
                          {format(eventDate, 'yyyy年MM月dd日')}
                          {daysUntil >= 0 ? ` · ${daysUntil}天后` : ` · ${Math.abs(daysUntil)}天前`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleEventReminder(event.id)}
                          className="relative w-10 h-5 rounded-full transition-colors"
                          style={{ backgroundColor: (event.enabled !== false) ? '#ec4899' : '#9ca3af' }}
                        >
                          <div 
                            className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                            style={{ transform: (event.enabled !== false) ? 'translateX(20px)' : 'translateX(2px)' }}
                          />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="p-2 text-red-400 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showNewEntry && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => {
              setShowNewEntry(false);
              setSelectedEventId(null);
            }} className="p-2 text-gray-700 dark:text-gray-200">取消</button>
            <div className="flex-1 text-center">
              <h2 className="font-bold">{selectedEventId ? (currentDiary.specialEvents?.find(e => e.id === selectedEventId)?.name || '写日记') : '写日记'}</h2>
            </div>
            <button 
              onClick={handleAddEntry}
              disabled={!entryContent.trim() && photos.length === 0}
              className="text-pink-500 font-medium disabled:opacity-50"
            >
              发布
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <input
              type="text"
              value={entryTitle}
              onChange={e => setEntryTitle(e.target.value)}
              placeholder="标题（选填）"
              className="w-full text-lg font-bold bg-transparent outline-none mb-4 placeholder-gray-300"
            />

            <textarea
              value={entryContent}
              onChange={e => setEntryContent(e.target.value)}
              placeholder="记录今天的美好..."
              className="w-full h-40 bg-transparent outline-none resize-none text-sm placeholder-gray-300"
            />

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">天气</span>
              </div>
              <div className="flex gap-2">
                {WEATHER.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedWeather(selectedWeather === i ? null : i)}
                    className={`p-2 rounded-lg ${selectedWeather === i ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                  >
                    <w.icon size={20} />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">心情</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {MOODS.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedMood(selectedMood === i ? null : i)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${selectedMood === i ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}
                  >
                    <m.icon size={14} style={{ color: m.color }} />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">背景颜色</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {BACKGROUND_COLORS.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedBgColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${selectedBgColor === color ? 'border-pink-500' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">照片（{photos.length}/9）</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img src={photo} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {photos.length < 9 && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 cursor-pointer"
                  >
                    <Camera size={24} />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {showSpecialEventEntry && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col">
          <div className="pt-14 pb-3 px-4 flex items-center gap-4 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
            <button onClick={() => {
              setShowSpecialEventEntry(false);
            }} className="p-2 text-gray-700 dark:text-gray-200">取消</button>
            <div className="flex-1 text-center">
              <h2 className="font-bold">特殊事件</h2>
            </div>
            <button 
              onClick={handleAddSpecialEventEntry}
              disabled={!entryContent.trim() && photos.length === 0 || !specialEventName.trim()}
              className="text-pink-500 font-medium disabled:opacity-50"
            >
              发布
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">事件名称</span>
              </div>
              <input
                type="text"
                value={specialEventName}
                onChange={e => setSpecialEventName(e.target.value)}
                placeholder="如：生日、纪念日、春节..."
                className={`w-full px-4 py-3 rounded-xl ${isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800'} outline-none`}
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">事件颜色</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {BACKGROUND_COLORS.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setSpecialEventColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${specialEventColor === color ? 'border-pink-500' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <input
              type="text"
              value={entryTitle}
              onChange={e => setEntryTitle(e.target.value)}
              placeholder="标题（选填）"
              className="w-full text-lg font-bold bg-transparent outline-none mb-4 placeholder-gray-300"
            />

            <textarea
              value={entryContent}
              onChange={e => setEntryContent(e.target.value)}
              placeholder="记录今天的美好..."
              className="w-full h-40 bg-transparent outline-none resize-none text-sm placeholder-gray-300"
            />

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">天气</span>
              </div>
              <div className="flex gap-2">
                {WEATHER.map((w, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedWeather(selectedWeather === i ? null : i)}
                    className={`p-2 rounded-lg ${selectedWeather === i ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
                  >
                    <w.icon size={20} />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">心情</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {MOODS.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedMood(selectedMood === i ? null : i)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${selectedMood === i ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}
                  >
                    <m.icon size={14} style={{ color: m.color }} />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">背景颜色</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {BACKGROUND_COLORS.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedBgColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${selectedBgColor === color ? 'border-pink-500' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">照片（{photos.length}/9）</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img src={photo} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {photos.length < 9 && (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 cursor-pointer"
                  >
                    <Camera size={24} />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {reminderNotification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[200] animate-slide-down">
          <div className="bg-gray-900 text-white rounded-xl shadow-2xl p-4 min-w-[280px] max-w-[320px]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-300 mb-1">情侣日记</div>
                <div className="text-base font-medium">{reminderNotification.title}</div>
                <div className="text-sm text-gray-400 mt-1">{reminderNotification.message}</div>
              </div>
              <button
                onClick={() => setReminderNotification(null)}
                className="text-gray-500 hover:text-gray-300 p-1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700 flex gap-2">
              <button
                onClick={() => {
                  setReminderNotification(null);
                  setShowReminderPage(true);
                }}
                className="flex-1 py-2 bg-pink-500 rounded-lg text-sm font-medium"
              >
                查看详情
              </button>
              <button
                onClick={() => setReminderNotification(null)}
                className="flex-1 py-2 bg-gray-700 rounded-lg text-sm font-medium"
              >
                稍后
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
