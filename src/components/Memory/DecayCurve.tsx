import React, { useRef, useEffect, useState } from 'react';
import { CharacterMemoryEntry } from '../../types';
import { scoreMemory } from '../../lib/characterMemory';

interface Props {
  memory: CharacterMemoryEntry | null;
}

const CANVAS_W = 300;
const CANVAS_H = 160;
const PAD = 30;
const PLOT_W = CANVAS_W - PAD * 2;
const PLOT_H = CANVAS_H - PAD * 2;
const DAYS = 30;

export default function DecayCurve({ memory }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !memory) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#faf5ff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Compute current and projected scores
    const now = Date.now();
    const points: { day: number; score: number }[] = [];
    for (let d = 0; d <= DAYS; d++) {
      const futureEntry: CharacterMemoryEntry = {
        ...memory,
        lastAccessedAt: now - memory.lastAccessedAt + now + d * 86400000,
      };
      points.push({ day: d, score: scoreMemory(futureEntry) });
    }

    const maxScore = Math.max(...points.map(p => p.score), 0.5);
    const toX = (day: number) => PAD + (day / DAYS) * PLOT_W;
    const toY = (score: number) => PAD + (1 - score / maxScore) * PLOT_H;

    // Grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let d = 0; d <= DAYS; d += 5) {
      const x = toX(d);
      ctx.beginPath();
      ctx.moveTo(x, PAD);
      ctx.lineTo(x, PAD + PLOT_H);
      ctx.stroke();
    }

    // Curve
    ctx.beginPath();
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    points.forEach((p, i) => {
      const x = toX(p.day);
      const y = toY(p.score);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under curve
    const last = points[points.length - 1];
    ctx.lineTo(toX(last.day), PAD + PLOT_H);
    ctx.lineTo(toX(0), PAD + PLOT_H);
    ctx.closePath();
    ctx.fillStyle = 'rgba(139, 92, 246, 0.08)';
    ctx.fill();

    // Current score dot
    const c0 = points[0];
    ctx.beginPath();
    ctx.arc(toX(c0.day), toY(c0.score), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#7c3aed';
    ctx.fill();

    // Current score label
    ctx.fillStyle = '#6d28d9';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`当前 ${c0.score.toFixed(2)}`, toX(c0.day), toY(c0.score) - 8);

    // Day 30 dot
    const c30 = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(toX(c30.day), toY(c30.score), 3, 0, Math.PI * 2);
    ctx.fillStyle = '#a78bfa';
    ctx.fill();
    ctx.fillStyle = '#8b5cf6';
    ctx.font = '9px sans-serif';
    ctx.fillText(`第30天 ${c30.score.toFixed(2)}`, toX(c30.day), toY(c30.score) + 14);

    // X labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    for (let d = 0; d <= DAYS; d += 5) {
      ctx.fillText(`${d}d`, toX(d), PAD + PLOT_H + 12);
    }
  }, [memory]);

  if (!memory) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        在记忆列表中点击一条记忆查看衰减曲线
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <canvas
        ref={canvasRef}
        className="w-full max-w-[300px] mx-auto rounded-xl"
        style={{ width: CANVAS_W, height: CANVAS_H }}
      />
      <p className="text-[10px] text-gray-400 text-center">
        基于当前衰减率预测 30 天记忆强度变化 | λ={memory.layer ? (memory.layer === 'ambient' ? 0.15 : 0.05) : 0.05}
      </p>
    </div>
  );
}
