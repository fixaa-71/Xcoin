import React from 'react';
import {
  Pickaxe,
  Zap,
  TrendingUp,
  Plane,
  Gift,
  Share2,
  Users,
  Trophy,
  Wallet,
  Crown,
  Gem,
} from 'lucide-react';

export type TabKey =
  | 'tap'
  | 'upgrades'
  | 'crash'
  | 'trade'
  | 'invest'
  | 'bonus'
  | 'promote'
  | 'friends'
  | 'top'
  | 'wallet'
  | 'vip';

interface BottomNavProps {
  activeTab: TabKey;
  onChangeTab: (tab: TabKey) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode; isHot?: boolean }> = [
    { key: 'tap', label: 'Tap', icon: <Pickaxe className="w-4 h-4" /> },
    { key: 'upgrades', label: 'Upgrades', icon: <Zap className="w-4 h-4" /> },
    { key: 'crash', label: 'Aviator', icon: <Plane className="w-4 h-4" />, isHot: true },
    { key: 'trade', label: 'QX Trade', icon: <TrendingUp className="w-4 h-4" />, isHot: true },
    { key: 'invest', label: 'Store', icon: <Gem className="w-4 h-4" />, isHot: true },
    { key: 'bonus', label: 'Bonus', icon: <Gift className="w-4 h-4" /> },
    { key: 'friends', label: 'Friends', icon: <Users className="w-4 h-4" /> },
    { key: 'top', label: 'Top', icon: <Trophy className="w-4 h-4" /> },
    { key: 'promote', label: 'Promote', icon: <Share2 className="w-4 h-4" /> },
    { key: 'wallet', label: 'Wallet', icon: <Wallet className="w-4 h-4" /> },
    { key: 'vip', label: 'VIP', icon: <Crown className="w-4 h-4" /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#080b11]/95 backdrop-blur-2xl border-t border-amber-500/20 py-1.5 px-1 shadow-[0_-8px_24px_rgba(0,0,0,0.7)]">
      <div className="max-w-md mx-auto flex items-center justify-between overflow-x-auto no-scrollbar gap-1 px-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChangeTab(tab.key)}
              className={`relative flex flex-col items-center justify-center min-w-[54px] py-1.5 px-1 rounded-xl transition-all duration-200 select-none ${
                isActive
                  ? 'text-amber-300 bg-amber-500/15 shadow-[0_0_15px_rgba(212,175,55,0.25)] border border-amber-500/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.isHot && (
                <span className="absolute -top-1 -right-0.5 px-1 py-0.2 bg-gradient-to-r from-rose-500 to-amber-500 text-[8px] font-extrabold text-white rounded-full leading-tight">
                  LIVE
                </span>
              )}
              <div className={`transition-transform ${isActive ? 'scale-110 drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]' : ''}`}>
                {tab.icon}
              </div>
              <span className={`text-[10px] tracking-tight mt-0.5 whitespace-nowrap font-medium ${isActive ? 'font-bold text-amber-200' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
