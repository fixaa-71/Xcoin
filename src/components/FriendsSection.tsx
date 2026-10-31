import React, { useState } from 'react';
import { UserProfile, UserWallet } from '../types';
import { Users, Copy, Check, Share2, Gift } from 'lucide-react';
import { CoinIcon } from './CoinIcon';

interface FriendsSectionProps {
  user: UserProfile;
  wallet: UserWallet;
  triggerHaptic: (type?: any) => void;
}

export const FriendsSection: React.FC<FriendsSectionProps> = ({ user, wallet, triggerHaptic }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const referralLink = `https://t.me/xcoin_mini_bot?start=ref_${user.telegramUserId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    triggerHaptic('success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = () => {
    const text = encodeURIComponent(
      `🚀 Join X COIN Telegram Mini App! Tap, trade, and play X Crash to earn XCOIN!\n${referralLink}`
    );
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`, '_blank');
  };

  return (
    <div className="max-w-md mx-auto py-4 px-4 flex flex-col gap-4 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-zinc-900 to-black p-4 rounded-2xl border border-amber-500/20 shadow-lg text-center flex flex-col items-center">
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl mb-2">
          <Users className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-extrabold text-white">Invite Friends</h2>
        <p className="text-xs text-zinc-400 max-w-xs mt-1">
          Share your referral link with crypto traders and friends. Receive instant rewards when they join!
        </p>
      </div>

      {/* Reward Perks */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-zinc-950/80 border border-white/10 p-3 rounded-2xl flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold">
            <Gift className="w-4 h-4 text-amber-400" />
            <span>FOR YOU</span>
          </div>
          <span className="text-lg font-mono font-extrabold text-white">+2,500</span>
          <span className="text-[10px] text-zinc-400">XCOIN per verified referral</span>
        </div>

        <div className="bg-zinc-950/80 border border-white/10 p-3 rounded-2xl flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-bold">
            <CoinIcon className="w-4 h-4" />
            <span>FOR FRIEND</span>
          </div>
          <span className="text-lg font-mono font-extrabold text-white">+1,000</span>
          <span className="text-[10px] text-zinc-400">Welcome starter bonus</span>
        </div>
      </div>

      {/* Referral Link Box */}
      <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col gap-3">
        <span className="text-xs font-bold text-zinc-400 uppercase">Your Referral Link</span>

        <div className="flex items-center gap-2 bg-zinc-900/90 border border-white/10 rounded-xl px-3 py-2">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="flex-1 bg-transparent text-xs font-mono text-zinc-300 focus:outline-none truncate select-all"
          />
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleCopy}
            className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs border border-white/10 flex items-center justify-center gap-1.5 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied Link' : 'Copy Link'}</span>
          </button>

          <button
            onClick={handleShare}
            className="py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(212,175,55,0.25)] transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>Share to Telegram</span>
          </button>
        </div>
      </div>

      {/* Friends List Empty State */}
      <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase">Invited Friends</h3>
        <div className="py-8 text-center flex flex-col items-center justify-center">
          <Users className="w-8 h-8 text-zinc-600 mb-2" />
          <span className="text-xs text-zinc-400 font-semibold">No referrals yet</span>
          <span className="text-[11px] text-zinc-600 mt-0.5">
            Share your link with friends to climb the Top Referrers leaderboard!
          </span>
        </div>
      </div>
    </div>
  );
};
