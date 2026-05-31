import { useState, useRef, useCallback, useEffect, type ChangeEvent } from 'react';
import { Image, X, RefreshCw } from 'lucide-react';
import { extractImageData } from '../../lib/ai';

interface CapturedPhoto {
  id: string;
  dataUrl: string;
  timestamp: number;
  source: 'camera' | 'import';
  desc?: string;
}

interface Props {
  characterId: string;
  onHome: () => void;
  onPhotosTaken: (photos: CapturedPhoto[]) => void;
}

const STORAGE_KEY = 'phone_camera_photos_';

function loadPhotos(characterId: string): CapturedPhoto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + characterId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePhotos(characterId: string, photos: CapturedPhoto[]) {
  try {
    localStorage.setItem(STORAGE_KEY + characterId, JSON.stringify(photos));
  } catch {}
}

function compressImage(dataUrl: string, maxW: number = 800, quality: number = 0.7): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxW) { h = h * maxW / w; w = maxW; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function analyzePhoto(dataUrl: string, ownerName: string): Promise<string> {
  const img = extractImageData(dataUrl);
  if (!img) return '一张照片';

  try {
    const { generateAIResponse } = await import('../../lib/ai');
    const desc = await generateAIResponse(
      `为${ownerName}描述这张照片的画面内容。如果是照片里有文字内容，请完整识别出文字。如果有文字，文字内容最重要。用一句话描述。`,
      undefined,
      [img],
    );
    return desc?.trim() || '一张照片';
  } catch {
    return '一张照片';
  }
}

export default function CameraApp({ characterId, onHome, onPhotosTaken }: Props) {
  const [mode, setMode] = useState<'live' | 'preview' | 'gallery'>('live');
  const [captured, setCaptured] = useState<CapturedPhoto[]>(() => loadPhotos(characterId));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [usingFront, setUsingFront] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: usingFront ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      // Camera not available
    }
  }, [usingFront]);

  useEffect(() => {
    if (mode === 'live') startCamera();
    else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [mode, startCamera]);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPreviewUrl(dataUrl);
    setMode('preview');
  };

  const confirmPhoto = async () => {
    if (!previewUrl) return;
    setAnalyzing(true);
    const compressed = await compressImage(previewUrl);
    const desc = await analyzePhoto(compressed, '');
    const photo: CapturedPhoto = {
      id: 'camera_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      dataUrl: compressed,
      timestamp: Date.now(),
      source: 'camera',
      desc,
    };
    const updated = [...captured, photo];
    setCaptured(updated);
    savePhotos(characterId, updated);
    setPreviewUrl(null);
    setMode('live');
    setAnalyzing(false);
    onPhotosTaken(updated);
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const compressed = await compressImage(dataUrl, 1024);
      const desc = await analyzePhoto(compressed, '');
      const photo: CapturedPhoto = {
        id: 'import_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        dataUrl: compressed,
        timestamp: Date.now(),
        source: 'import',
        desc,
      };
      const updated = [...captured, photo];
      setCaptured(updated);
      savePhotos(characterId, updated);
      setAnalyzing(false);
      onPhotosTaken(updated);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const deletePhoto = (id: string) => {
    const updated = captured.filter(p => p.id !== id);
    setCaptured(updated);
    savePhotos(characterId, updated);
  };

  return (
    <div className="w-full h-full bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-7 pb-2 shrink-0 z-10">
        <button onClick={onHome} className="text-white/80 text-sm font-medium">返回</button>
        <h1 className="text-[17px] font-semibold">相机</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => fileInputRef.current?.click()} className="text-white/80" title="导入图片">
            <Image size={20} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImport} className="hidden" />
          {captured.length > 0 && (
            <button onClick={() => setMode(mode === 'gallery' ? 'live' : 'gallery')} className="text-white/80">
              <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{captured.length}</span>
            </button>
          )}
        </div>
      </div>

      {mode === 'gallery' ? (
        /* Gallery view */
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-3 gap-2">
            {[...captured].reverse().map(photo => (
              <div key={photo.id} className="relative aspect-square group">
                <img src={photo.dataUrl} className="w-full h-full object-cover rounded-lg" alt="" />
                <button
                  onClick={() => deletePhoto(photo.id)}
                  className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
                <div className="absolute bottom-1 left-1 text-[10px] bg-black/50 px-1 rounded">
                  {photo.source === 'camera' ? '拍摄' : '导入'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : mode === 'preview' && previewUrl ? (
        /* Preview */
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <img src={previewUrl} className="max-h-[70vh] rounded-xl object-contain" alt="" />
          {analyzing && <div className="mt-3 text-sm text-white/50">分析中...</div>}
        </div>
      ) : (
        /* Camera live view */
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          {!streamRef.current && (
            <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
              无法访问相机
            </div>
          )}
        </div>
      )}

      {/* Bottom controls */}
      {mode === 'live' && (
        <div className="shrink-0 flex items-center justify-center py-6 gap-8">
          <div className="w-14" />
          <button
            onClick={takePhoto}
            className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            disabled={!streamRef.current}
          >
            <div className="w-12 h-12 rounded-full bg-white" />
          </button>
          <button onClick={() => setUsingFront(prev => !prev)} className="text-white/70 hover:text-white">
            <RefreshCw size={24} />
          </button>
        </div>
      )}
      {mode === 'preview' && (
        <div className="shrink-0 flex items-center justify-center py-6 gap-12">
          <button onClick={() => { setPreviewUrl(null); setMode('live'); }} className="text-white/70 text-sm">
            重拍
          </button>
          <button onClick={confirmPhoto} className="bg-white text-black px-8 py-2 rounded-full font-medium text-sm">
            {analyzing ? '处理中...' : '使用'}
          </button>
        </div>
      )}
    </div>
  );
}
