import { ChevronRight } from 'lucide-react';

interface Props {
  isDark: boolean;
  onOpenMoments: () => void;
}

export default function DiscoverApp({ isDark, onOpenMoments }: Props) {
  return (
    <div className={'h-full ' + (isDark ? 'bg-black' : 'bg-gray-100')}>
      <div className={'rounded-xl mx-3 mt-3 overflow-hidden shadow-sm border ' + (isDark ? 'bg-[#1c1c1c] border-white/5' : 'bg-white border-gray-200/80')}>
        <button
          onClick={onOpenMoments}
          className={'w-full flex items-center justify-between px-4 py-4 transition-colors ' + (isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50')}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1AAD19] flex items-center justify-center text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <span className={'text-[16px] ' + (isDark ? 'text-gray-100' : 'text-gray-900')}>朋友圈</span>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
}
