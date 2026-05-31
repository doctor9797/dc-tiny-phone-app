interface Props {
  ownerName: string;
  ownerAvatar: string;
  isDark: boolean;
}

export default function ProfileApp({ ownerName, ownerAvatar, isDark }: Props) {
  const bg = isDark ? 'text-gray-200' : 'text-gray-900';
  const subBg = isDark ? 'text-gray-500' : 'text-gray-500';

  return (
    <div className={`h-full overflow-y-auto ${isDark ? 'bg-black' : 'bg-gray-100'}`}>
      {/* Profile header */}
      <div className={`p-6 ${isDark ? 'bg-[#191919]' : 'bg-white'}`}>
        <div className="flex items-center space-x-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ backgroundColor: ownerAvatar || '#07C160' }}
          >
            {ownerName[0]}
          </div>
          <div>
            <h2 className={`text-lg font-medium ${bg}`}>{ownerName}</h2>
            <p className={`text-sm ${subBg}`}>微信号: {ownerName}</p>
          </div>
        </div>
      </div>

      {/* Settings rows */}
      <div className={`mt-2 divide-y ${isDark ? 'bg-[#191919] divide-white/5' : 'bg-white divide-gray-200'}`}>
        <SettingRow label="头像" isDark={isDark} />
        <SettingRow label="名字" value={ownerName} isDark={isDark} />
        <SettingRow label="微信号" value={ownerName} isDark={isDark} />
        <SettingRow label="个性签名" isDark={isDark} />
        <SettingRow label="朋友圈权限" isDark={isDark} />
      </div>

      <div className={`mt-2 divide-y ${isDark ? 'bg-[#191919] divide-white/5' : 'bg-white divide-gray-200'}`}>
        <SettingRow label="聊天背景" isDark={isDark} />
        <SettingRow label="隐私设置" isDark={isDark} />
      </div>
    </div>
  );
}

function SettingRow({ label, value, isDark }: { label: string; value?: string; isDark: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
      <span className={`text-[15px] ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{label}</span>
      <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{value || ''}</span>
    </div>
  );
}
