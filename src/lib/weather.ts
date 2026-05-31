// ── Open-Meteo API (completely free, no API key required) ──
// Docs: https://open-meteo.com/

export interface WeatherData {
  city: string;
  today: {
    temp: number;
    text: string;
    icon: string;
  };
  tomorrow: {
    tempMax: number;
    tempMin: number;
    text: string;
    icon: string;
    precip: number;
  };
}

export interface WeatherAlert {
  type: 'drop' | 'rain' | 'snow' | 'heat' | 'cold' | 'wind';
  severity: 'mild' | 'strong';
  message: string;
}

// WMO weather code → Chinese text
const WMO_TEXT: Record<number, string> = {
  0: '晴天', 1: '晴', 2: '多云', 3: '阴天',
  45: '雾', 48: '雾',
  51: '小雨', 53: '小雨', 55: '雨',
  56: '雨', 57: '雨',
  61: '小雨', 63: '雨', 65: '大雨',
  66: '雨', 67: '雨',
  71: '雪', 73: '雪', 75: '大雪', 77: '雪',
  80: '阵雨', 81: '阵雨', 82: '暴雨',
  85: '阵雪', 86: '雪',
  95: '雷暴', 96: '雷暴', 99: '雷暴',
};

const weatherText = (code: number): string => WMO_TEXT[code] || '未知';

export async function getLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('浏览器不支持定位'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => reject(new Error('获取定位失败')),
      { timeout: 10000, enableHighAccuracy: false },
    );
  });
}

export async function getCityName(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${lat},${lon}&count=1&language=zh`
    );
    if (!res.ok) throw new Error('geocode failed');
    const data = await res.json();
    // Try reverse from the coordinate search
    const resRev = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`
    );
    if (resRev.ok) {
      const rev = await resRev.json();
      if (rev.city || rev.locality) return rev.city || rev.locality || '当前位置';
    }
    return data.results?.[0]?.name || '当前位置';
  } catch {
    return '当前位置';
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const base = 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'temperature_2m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    forecast_days: '3',
    timezone: 'auto',
  });

  const res = await fetch(`${base}?${params}`);
  if (!res.ok) throw new Error('天气API请求失败');
  const data = await res.json();

  const todayCode = data.current?.weather_code ?? 0;
  const todayTemp = Math.round(data.current?.temperature_2m ?? 0);

  const daily = data.daily;
  if (!daily || !daily.time?.[1]) throw new Error('天气数据不完整');

  const tomorrowCode = daily.weather_code[1] ?? 0;

  return {
    city: '',
    today: {
      temp: todayTemp,
      text: weatherText(todayCode),
      icon: todayCode.toString(),
    },
    tomorrow: {
      tempMax: Math.round(daily.temperature_2m_max[1] ?? 0),
      tempMin: Math.round(daily.temperature_2m_min[1] ?? 0),
      text: weatherText(tomorrowCode),
      icon: tomorrowCode.toString(),
      precip: daily.precipitation_probability_max[1] ?? 0,
    },
  };
}

export function checkAbnormalWeather(today: WeatherData['today'], tomorrow: WeatherData['tomorrow']): WeatherAlert | null {
  const drop = today.temp - tomorrow.tempMax;
  const rise = tomorrow.tempMax - today.temp;

  // Sudden temperature drop ≥ 8°C
  if (drop >= 8) {
    return {
      type: 'drop',
      severity: drop >= 15 ? 'strong' : 'mild',
      message: `明天${tomorrow.text}，气温骤降${drop}°C，最高才${tomorrow.tempMax}°C`,
    };
  }

  // Extreme heat ≥ 35°C
  if (tomorrow.tempMax >= 35) {
    return {
      type: 'heat',
      severity: tomorrow.tempMax >= 40 ? 'strong' : 'mild',
      message: `明天高达${tomorrow.tempMax}°C，${tomorrow.text}天`,
    };
  }

  // Extreme cold ≤ 0°C
  if (tomorrow.tempMax <= 0) {
    return {
      type: 'cold',
      severity: tomorrow.tempMax <= -10 ? 'strong' : 'mild',
      message: `明天最高才${tomorrow.tempMax}°C，${tomorrow.text}`,
    };
  }

  // Heavy rain / snow (using weather text keywords)
  const text = tomorrow.text;
  if (/暴雨|大雨|大.*雪|暴雪/.test(text)) {
    return {
      type: text.includes('雪') ? 'snow' : 'rain',
      severity: 'strong',
      message: `明天${text}，降水概率${tomorrow.precip}%`,
    };
  }

  // Moderate rain / snow with ≥ 50% precip
  if ((/雨|雪/.test(text)) && tomorrow.precip >= 50) {
    return {
      type: text.includes('雪') ? 'snow' : 'rain',
      severity: 'mild',
      message: `明天${text}，降水概率${tomorrow.precip}%`,
    };
  }

  // Rain with ≥ 60% precip even if text doesn't mention rain
  if (tomorrow.precip >= 60) {
    return {
      type: 'rain',
      severity: tomorrow.precip >= 80 ? 'strong' : 'mild',
      message: `明天降水概率${tomorrow.precip}%，最好带伞`,
    };
  }

  return null;
}

export async function getWeatherAdvice(
  alert: WeatherAlert,
  charName: string,
  personality: string,
  relation: string,
  affection?: number,
): Promise<string> {
  const prompt = `你正在扮演${charName}。性格：${personality}。和我的关系：${relation}（好感度：${affection ?? 50}/100）。

你刚刚看到天气预报：${alert.message}。请以角色的身份，用符合性格和语气的方式给我发一条微信消息，提醒我注意天气。要像你刚好看到天气预报后随口跟我说的一样自然。

要求：
- 直接说话，不要任何动作/神态描写
- 不要引号
- 句子长度和语气要符合角色性格（话多的角色可以说多一些，话少的就一句）
- 内容不要模板化，要像真人聊天一样自然`;

  try {
    const { generateAIResponse } = await import('./ai');
    const reply = await generateAIResponse(prompt);
    return reply.trim();
  } catch {
    // Fallback — natural phrases closer to real chat
    const msgs: Record<string, string> = {
      drop: `明天要降温到${alert.message.match(/\d+/)?.[0] || ''}°C呢，多穿件衣服别冻着了。`,
      heat: `明天${alert.message.match(/\d+/)?.[0] || ''}°C，热得够呛，别往外跑了。`,
      cold: `明天最高才${alert.message.match(/\d+/)?.[0] || ''}°C，挺冷的，注意保暖。`,
      rain: '明天好像有雨，出门记得带伞。',
      snow: '明天要下雪了，路滑注意安全。',
      wind: '明天风挺大的，出门小心点。',
    };
    return msgs[alert.type] || '明天天气不太好，你自己注意点。';
  }
}
