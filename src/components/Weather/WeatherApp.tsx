import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { fetchWeather, getCityName, getLocation, type WeatherData } from '../../lib/weather';
import { saveInteractionMemory } from '../../lib/characterMemory';
import { RefreshCw, MapPin, Cloud, CloudRain, CloudSnow, Sun, CloudLightning, CloudFog, Wind, ArrowLeft } from 'lucide-react';

const weatherIcon = (text: string, className?: string) => {
  const cls = className || 'w-8 h-8';
  if (/晴/.test(text)) return <Sun className={`${cls} text-amber-400`} />;
  if (/暴雨|大雨|雨/.test(text)) return <CloudRain className={`${cls} text-blue-500`} />;
  if (/雪/.test(text)) return <CloudSnow className={`${cls} text-blue-200`} />;
  if (/云/.test(text)) return <Cloud className={`${cls} text-slate-400`} />;
  if (/雾/.test(text)) return <CloudFog className={`${cls} text-slate-300`} />;
  if (/雷/.test(text)) return <CloudLightning className={`${cls} text-yellow-500`} />;
  if (/风/.test(text)) return <Wind className={`${cls} text-teal-400`} />;
  return <Cloud className={`${cls} text-slate-400`} />;
};

const bgGradient = (text: string) => {
  if (/晴/.test(text)) return 'from-sky-400 via-blue-400 to-indigo-500';
  if (/雨|雪/.test(text)) return 'from-slate-500 via-slate-600 to-slate-700';
  if (/云/.test(text)) return 'from-sky-300 via-slate-300 to-slate-400';
  if (/雾/.test(text)) return 'from-slate-300 via-slate-400 to-slate-500';
  return 'from-sky-400 via-blue-400 to-indigo-500';
};

const dayName = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[d.getDay()];
};

export default function WeatherApp({ onBack }: { onBack?: () => void }) {
  const { settings } = useAppStore();
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState('定位中...');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { lat, lon } = await getLocation();
      const [weather, cityName] = await Promise.all([
        fetchWeather(lat, lon),
        getCityName(lat, lon),
      ]);
      weather.city = cityName;
      setData(weather);
      setCity(cityName);
      useAppStore.getState().updateSettings({ weatherCity: cityName } as any);
      // 天气记忆+情绪
      const store = useAppStore.getState();
      const weatherWord = weather.today.text.includes('晴') ? '晴朗' : weather.today.text.includes('雨') ? '阴雨' : weather.today.text.includes('雪') ? '下雪' : weather.today.text.includes('云') ? '多云' : '平常';
      const weatherValence = weather.today.text.includes('晴') ? 0.3 : weather.today.text.includes('雨') ? -0.1 : 0;
      const weatherArousal = weather.today.text.includes('晴') ? 0.4 : weather.today.text.includes('雨') ? 0.1 : 0.2;
      Object.keys(store.characters).forEach(charId => {
        if ((store.characters[charId] as any).isDisabled) return;
        saveInteractionMemory(charId, `今天天气${weatherWord}(${cityName} ${weather.today.temp}°C)`, '', 'observation', 1);
        store.addEmotionEvent({ characterId: charId, paDelta: weatherValence * 0.5, naDelta: -weatherValence * 0.3, word: weatherWord, valence: weatherValence, arousal: weatherArousal, matchSource: 'free_form', source: 'decoration' });
      });
    } catch (e: any) {
      setError(e?.message || '获取天气失败');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className={`h-full flex flex-col bg-gradient-to-b ${data ? bgGradient(data.today.text) : 'from-sky-400 to-indigo-500'} text-white`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-7 pb-4">
        {onBack && (
          <button onClick={onBack} className="text-white/80 hover:text-white">
            <ArrowLeft size={22} />
          </button>
        )}
        <h1 className="text-lg font-semibold tracking-wide">天气</h1>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw size={32} className="animate-spin text-white/60" />
            <p className="text-white/60 text-sm">获取天气信息...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center space-y-4">
            <p className="text-white/80 text-lg">{error}</p>
            <button onClick={load} className="px-6 py-2 bg-white/20 rounded-xl text-sm font-medium backdrop-blur-sm">
              重试
            </button>
          </div>
        </div>
      )}

      {data && !loading && (
        <div className="flex-1 flex flex-col px-6 pb-8 overflow-y-auto">
          {/* Current weather */}
          <div className="flex flex-col items-center py-8">
            <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
              <MapPin size={14} />
              <span>{city}</span>
              <button onClick={load} className="ml-2 hover:rotate-180 transition-transform duration-500">
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="mb-2">{weatherIcon(data.today.text, 'w-20 h-20')}</div>
            <div className="text-6xl font-light tracking-tight">{data.today.temp}°</div>
            <div className="text-lg text-white/80 mt-1">{data.today.text}</div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/15 mb-6" />

          {/* Tomorrow preview */}
          <div className="bg-white/12 backdrop-blur-sm rounded-2xl p-5 mb-6">
            <div className="text-xs text-white/50 uppercase tracking-widest mb-3">明天预报</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {weatherIcon(data.tomorrow.text, 'w-10 h-10')}
                <div>
                  <div className="text-sm text-white/70">{data.tomorrow.text}</div>
                  <div className="text-xs text-white/50 mt-0.5">降水 {data.tomorrow.precip}%</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-medium">{data.tomorrow.tempMax}°</div>
                <div className="text-xs text-white/50">{data.tomorrow.tempMin}°</div>
              </div>
            </div>
          </div>

          {/* Hourly (simplified — QWeather free tier doesn't include hourly in 3d endpoint) */}
          {/* Daily 3-day */}
          <div className="bg-white/12 backdrop-blur-sm rounded-2xl p-5">
            <div className="text-xs text-white/50 uppercase tracking-widest mb-3">未来天气</div>
            {[0, 1, 2].map(offset => {
              const day = offset === 0 ? data.today : offset === 1 ? data.tomorrow : null;
              if (!day && offset === 2) {
                // We only have today and tomorrow from 3d API, day 3 is approximate
                return (
                  <div key={offset} className="flex items-center justify-between py-2.5 border-b border-white/10 last:border-0">
                    <span className="text-sm w-12">{dayName(offset)}</span>
                    <div className="flex items-center gap-2 flex-1 justify-center">
                      <Cloud className="w-5 h-5 text-white/40" />
                      <span className="text-xs text-white/50">暂无数据</span>
                    </div>
                    <span className="text-sm w-16 text-right">--°</span>
                  </div>
                );
              }
              const d = day as WeatherData['today'] & WeatherData['tomorrow'];
              return (
                <div key={offset} className="flex items-center justify-between py-2.5 border-b border-white/10 last:border-0">
                  <span className="text-sm w-12">{offset === 0 ? '今天' : offset === 1 ? '明天' : dayName(offset)}</span>
                  <div className="flex items-center gap-2 flex-1 justify-center">
                    {weatherIcon(d.text, 'w-5 h-5')}
                    <span className="text-xs text-white/60">{d.text}</span>
                  </div>
                  <span className="text-sm w-16 text-right">{(d as any).tempMax || (d as any).temp}°</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
