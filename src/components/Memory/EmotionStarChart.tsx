import React, { useRef, useEffect } from 'react';
import { CharacterMemoryEntry } from '../../types';
import { scoreMemory } from '../../lib/characterMemory';

interface Props {
  memories: CharacterMemoryEntry[];
}

const FORGOTTEN_THRESHOLD = 0.05;
const CANVAS_SIZE = 300;
const PADDING = 36;
const PLOT_SIZE = CANVAS_SIZE - PADDING * 2;

const LAYER_COLORS: Record<string, string> = {
  deep: '#8b5cf6',
  daily: '#3b82f6',
  diary: '#f59e0b',
  writing: '#10b981',
  ambient: '#d1d5db',
};

export default function EmotionStarChart({
  memories,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const grad = ctx.createRadialGradient(150, 150, 10, 150, 150, 160);
    grad.addColorStop(0, '#f5f3ff');
    grad.addColorStop(1, '#ede9fe');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const toX = (v: number) => PADDING + (v + 1) / 2 * PLOT_SIZE;
    const toY = (a: number) => PADDING + (1 - a) * PLOT_SIZE;

    // Grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const x = PADDING + (i / 4) * PLOT_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, PADDING);
      ctx.lineTo(x, PADDING + PLOT_SIZE);
      ctx.stroke();
      const y = PADDING + (i / 4) * PLOT_SIZE;
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(PADDING + PLOT_SIZE, y);
      ctx.stroke();
    }

    // Axis lines (V=0 horizontal, A=0.5 vertical)
    ctx.strokeStyle = '#c4b5fd';
    ctx.lineWidth = 1;
    const v0x = toX(0);
    ctx.beginPath();
    ctx.moveTo(v0x, PADDING);
    ctx.lineTo(v0x, PADDING + PLOT_SIZE);
    ctx.stroke();
    const a05y = toY(0.5);
    ctx.beginPath();
    ctx.moveTo(PADDING, a05y);
    ctx.lineTo(PADDING + PLOT_SIZE, a05y);
    ctx.stroke();

    // Quadrant labels
    ctx.fillStyle = '#a78bfa';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('强烈·负面', toX(-0.5), PADDING + 10);
    ctx.fillText('强烈·正面', toX(0.5), PADDING + 10);
    ctx.fillText('平静·负面', toX(-0.5), PADDING + PLOT_SIZE - 4);
    ctx.fillText('平静·正面', toX(0.5), PADDING + PLOT_SIZE - 4);

    // Axis labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('负面 ← Valence → 正面', CANVAS_SIZE / 2, CANVAS_SIZE - 4);
    ctx.save();
    ctx.translate(10, CANVAS_SIZE / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Arousal 唤醒', 0, 0);
    ctx.restore();

    // ── Plot dots ──
    for (const m of memories) {
      const score = scoreMemory(m);
      const isForgotten = score < FORGOTTEN_THRESHOLD;
      const isDecoration = m.category === 'decoration_mood';

      // Convert in-memory valence 0~1 to -1~+1
      const v = (m.valence - 0.5) * 2;
      const a = m.arousal;
      const x = toX(v);
      const y = toY(a);
      const size = 3 + (m.importance / 10) * 8;
      const opacity = isForgotten ? 0.15 : Math.max(0.2, Math.min(1, score / 5));

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);

      if (isDecoration) {
        // Dashed border for decoration moods
        ctx.strokeStyle = LAYER_COLORS.ambient || '#d1d5db';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.fillStyle = `rgba(209, 213, 219, ${opacity * 0.3})`;
        ctx.setLineDash([]);
      } else {
        const color = LAYER_COLORS[m.layer || 'daily'] || '#3b82f6';
        ctx.fillStyle = isForgotten
          ? `rgba(156, 163, 175, ${opacity})`
          : color;
        ctx.globalAlpha = opacity;
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }, [memories]);

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="w-full max-w-[300px] mx-auto rounded-xl shadow-sm"
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
      />



      {/* Layer legend */}
      <div className="flex flex-wrap gap-2 justify-center text-[10px] text-gray-400">
        {Object.entries(LAYER_COLORS).map(([layer, color]) => (
          <span key={layer} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {layer === 'ambient' ? '环境' : layer === 'deep' ? '深层' : layer === 'daily' ? '日常' : layer === 'diary' ? '日记' : '写作'}
          </span>
        ))}
      </div>

    </div>
  );
}
