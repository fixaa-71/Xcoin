import React from 'react';
import { CoinIcon } from './CoinIcon';
import { UserProfile, UserWallet } from '../types';
import { Crown, Shield, Bell, TrendingUp } from 'lucide-react';

interface NavbarProps {
  user: UserProfile | null;
  wallet: UserWallet | null;
  onOpenAdmin: () => void;
  onOpenVip: () => void;
  onOpenNotifications: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  wallet,
  onOpenAdmin,
  onOpenVip,
  onOpenNotifications,
}) => {
  const vipTier = user?.vipTier || 'FREE';
  const isVipActive = user?.vipStatus === 'ACTIVE';

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#080b11]/90 border-b border-amber-500/15 px-3 py-2.5 transition-all">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Left: User Profile & VIP */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            {user?.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={user.firstName}
                className="w-9 h-9 rounded-full object-cover border border-amber-500/30"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600/30 to-amber-400/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-300 text-xs">
                {user?.firstName?.slice(0, 2).toUpperCase() || 'XC'}
              </div>
            )}
            {isVipActive && (
              <span className="absolute -bottom-1 -right-1 p-0.5 bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full text-[9px] text-black font-extrabold shadow-sm">
                <Crown className="w-2.5 h-2.5" />
              </span>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white truncate max-w-[90px]">
                {user?.firstName || 'User'}
              </span>
              <button
                onClick={onOpenVip}
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider transition-all flex items-center gap-0.5 ${
                  isVipActive
                    ? 'bg-gradient-to-r from-amber-500/20 to-yellow-400/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(212,175,55,0.2)]'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50'
                }`}
              >
                <Crown className="w-2.5 h-2.5" />
                {vipTier}
              </button>
            </div>
            {user?.status === 'RESTRICTED' && (
              <span className="text-[10px] text-rose-400 font-medium">Device Restricted</span>
            )}
          </div>
        </div>

        {/* Center / Right: Real Authoritative Balances */}
        <div className="flex items-center gap-2">
          {/* XCOIN Balance */}
          <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-amber-500/30 rounded-full px-2.5 py-1 shadow-inner">
            <CoinIcon className="w-4 h-4" />
            <span className="text-xs font-mono font-bold text-amber-300">
              {wallet ? wallet.xcoinBalance.toLocaleString() : '—'}
            </span>
          </div>

          {/* XC Balance (Trading Asset) */}
          <div className="flex items-center gap-1 bg-zinc-900/90 border border-emerald-500/30 rounded-full px-2 py-1 shadow-inner">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-mono font-bold text-emerald-300">
              {wallet ? `${wallet.xcBalance.toLocaleString()} XC` : '—'}
            </span>
          </div>

          {/* Admin Access Button */}
          <button
            onClick={onOpenAdmin}
            aria-label="Admin Portal"
            className="p-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 border border-white/10 transition-colors"
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
