import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import {
  getOrGenerateWeek, getOrGenerateDayDetail,
  getMondayOfWeek, formatDate, formatDateShort, formatDateCN,
  isFuture,
  type CalendarWeekData, type CalendarDayDetail,
} from './calendarData';

interface Props {
  characterId: string;
  character: { name: string; personality: string; biography?: string; relationship?: string; affection?: number };
  callerName: string;
  onHome: () => void;
}

const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

export default function CalendarApp({ characterId, character, callerName, onHome }: Props) {
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [weekData, setWeekData] = useState<CalendarWeekData | null>(null);
  const [dayDetail, setDayDetail] = useState<CalendarDayDetail | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedTimeline, setExpandedTimeline] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const monday = getMondayOfWeek();
  if (weekOffset !== 0) monday.setDate(monday.getDate() + weekOffset * 7);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    dates.push(formatDate(d));
  }
  const weekStartStr = formatDateShort(monday);
  const weekEndStr = formatDateShort(new Date(monday.getTime() + 6 * 86400000));

  useEffect(() => {
    const load = async () => {
      setLoadingWeek(true);
      setDayDetail(null);
      const data = await getOrGenerateWeek(characterId, character, callerName, monday);
      setWeekData(data);
      setLoadingWeek(false);
      const todayStr = formatDate(new Date());
      if (dates.includes(todayStr)) {
        setSelectedDate(todayStr);
      } else {
        setSelectedDate(dates[0]);
      }
    };
    load();
  }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedDate) return;
    const load = async () => {
      const summary = weekData?.days.find(d => d.date === selectedDate)?.summary || '平淡的一天。';
      setLoadingDay(true);
      const detail = await getOrGenerateDayDetail(characterId, character, callerName, selectedDate, summary);
      setDayDetail(detail);
      setLoadingDay(false);
      setExpandedTimeline(false);
      setExpandedEventId(null);
    };
    if (weekData) load();
  }, [selectedDate, weekData]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrevWeek = () => setWeekOffset(prev => prev - 1);
  const handleNextWeek = () => setWeekOffset(prev => prev + 1);

  const todayDateStr = formatDate(new Date());
  const selectedIsFuture = isFuture(selectedDate);

  const timelineEvents = dayDetail?.timeline || [];
  const visibleEvents = expandedTimeline ? timelineEvents : timelineEvents.slice(0, 3);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#F5F5F7',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '430px',
      margin: '0 auto',
      overflow: 'hidden',
    }}>
      {/* ── Top Area ── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        padding: '48px 20px 8px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 700,
          color: '#111111',
          lineHeight: 1,
        }}>日历</h1>
        <button
          onClick={onHome}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '15px',
            fontWeight: 500,
            padding: '4px 8px',
            borderRadius: '8px',
          }}
        >
          <ArrowLeft size={16} />
          返回
        </button>
      </div>

      {/* ── Week Area ── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
        padding: '12px 20px 12px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '12px',
        }}>
          <button onClick={handlePrevWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', padding: '2px', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#111111',
            minWidth: '120px',
            textAlign: 'center',
          }}>
            {weekStartStr} - {weekEndStr}
          </span>
          <button onClick={handleNextWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', padding: '2px', display: 'flex', alignItems: 'center' }}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', marginBottom: '6px' }}>
          {WEEKDAY_NAMES.map(name => (
            <div key={name} style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '12px',
              color: '#9CA3AF',
              fontWeight: 400,
            }}>
              {name}
            </div>
          ))}
        </div>

        {loadingWeek ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>加载中...</span>
          </div>
        ) : (
          <div style={{ display: 'flex' }}>
            {dates.map((ds) => {
              const isSel = ds === selectedDate;
              const dayNum = new Date(ds + 'T12:00:00').getDate();
              const weekDay = weekData?.days.find(d => d.date === ds);

              return (
                <div key={ds} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <button
                    onClick={() => setSelectedDate(ds)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: isSel ? '#3B82F6' : 'transparent',
                      color: isSel ? '#FFFFFF' : '#111827',
                      fontSize: '16px',
                      fontWeight: isSel ? 600 : 400,
                      padding: 0,
                      transition: 'background-color 0.15s',
                    }}
                  >
                    {dayNum}
                  </button>
                  <div style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: isSel ? '#3B82F6' : '#60A5FA',
                    marginTop: '3px',
                    opacity: weekDay?.summary && weekDay.summary !== '平淡的一天。' ? 1 : 0.3,
                  }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Diary + Timeline Area ── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px 0 0',
      }}>
        {loadingDay ? (
          <div style={{
            backgroundColor: '#FFFFFF',
            margin: '0 12px',
            borderRadius: '14px',
            padding: '32px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: '13px', color: '#9CA3AF' }}>加载中...</span>
          </div>
        ) : dayDetail ? (
          <>
            {/* ── Diary Card (past/today only) ── */}
            {!selectedIsFuture && dayDetail.diary && (
              <div style={{
                backgroundColor: '#FFFFFF',
                margin: '0 12px',
                borderRadius: '14px',
                padding: '20px',
                marginBottom: '10px',
              }}>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#111827',
                  margin: '0 0 14px',
                  lineHeight: 1.2,
                }}>
                  {formatDateCN(selectedDate)}
                </h2>
                <p style={{
                  fontSize: '14px',
                  lineHeight: 1.7,
                  color: '#6B7280',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}>
                  {dayDetail.diary}
                </p>
              </div>
            )}

            {/* ── Future date header ── */}
            {selectedIsFuture && (
              <div style={{
                backgroundColor: '#FFFFFF',
                margin: '0 12px',
                borderRadius: '14px',
                padding: '20px',
                marginBottom: '10px',
              }}>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#111827',
                  margin: '0 0 4px',
                  lineHeight: 1.2,
                }}>
                  {formatDateCN(selectedDate)}
                </h2>
                <span style={{ fontSize: '13px', color: '#9CA3AF' }}>当日计划</span>
              </div>
            )}

            {/* ── Timeline ── */}
            {timelineEvents.length > 0 && (
              <div style={{
                backgroundColor: '#FFFFFF',
                margin: '0 12px',
                borderRadius: '14px',
                padding: '20px',
                marginBottom: '24px',
              }}>
                {visibleEvents.map((event, idx) => {
                  const eventKey = selectedDate + '_' + idx;
                  const isExpanded = expandedEventId === eventKey;

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        marginBottom: idx < visibleEvents.length - 1 ? '20px' : 0,
                        cursor: 'pointer',
                      }}
                      onClick={() => setExpandedEventId(isExpanded ? null : eventKey)}
                    >
                      <div style={{
                        width: '56px',
                        flexShrink: 0,
                        fontSize: '14px',
                        color: '#3B82F6',
                        fontWeight: 500,
                        paddingTop: '2px',
                      }}>
                        {event.time}
                      </div>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#D1D5DB',
                        flexShrink: 0,
                        marginRight: '12px',
                        marginTop: '5px',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: 600,
                          color: '#111827',
                          marginBottom: '2px',
                          lineHeight: 1.3,
                        }}>
                          {event.title}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#9CA3AF',
                          lineHeight: 1.5,
                          ...(isExpanded
                            ? {}
                            : {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }),
                        }}>
                          {event.content}
                        </div>
                        {event.content.length > 60 && !isExpanded && (
                          <span style={{ fontSize: '11px', color: '#D1D5DB', marginTop: '2px', display: 'inline-block' }}>
                            点击展开
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#D1D5DB',
                        flexShrink: 0,
                        marginLeft: '8px',
                        paddingTop: '3px',
                      }}>
                        {selectedIsFuture ? '计划' : '记录'}
                      </div>
                    </div>
                  );
                })}

                {/* "查看更多日程" toggle */}
                {!expandedTimeline && timelineEvents.length > 3 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedTimeline(true); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '15px',
                      color: '#3B82F6',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      marginTop: '16px',
                      padding: 0,
                      fontWeight: 500,
                    }}
                  >
                    <ArrowLeft size={16} />
                    查看更多日程
                  </button>
                )}
                {expandedTimeline && timelineEvents.length > 3 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedTimeline(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      color: '#9CA3AF',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      marginTop: '16px',
                      padding: 0,
                    }}
                  >
                    收起
                  </button>
                )}
              </div>
            )}

            <div style={{ height: '24px' }} />
          </>
        ) : (
          <div style={{
            backgroundColor: '#FFFFFF',
            margin: '0 12px',
            borderRadius: '14px',
            padding: '32px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: '13px', color: '#9CA3AF' }}>选择日期查看日记</span>
          </div>
        )}
      </div>
    </div>
  );
}
