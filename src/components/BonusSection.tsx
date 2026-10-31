import React, { useState, useEffect } from 'react';
import { UserProfile, UserWallet, DailyBonusStreak } from '../types';
import { Gift, Play, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { apiFetch } from '../services/api';
import { CoinIcon } from './CoinIcon';

interface BonusSectionProps {
  user: UserProfile;
  wallet: UserWallet;
  onUpdateWallet: (newBalance: number) => void;
  triggerHaptic: (type?: any) => void;
}

export const BonusSection: React.FC<BonusSectionProps> = ({
  user,
  wallet,
  onUpdateWallet,
  triggerHaptic,
}) => {
  const [streakData, setStreakData] = useState<DailyBonusStreak | null>(null);
  const [canClaim, setCanClaim] = useState<boolean>(false);
  const [rewards, setRewards] = useState<number[]>([]);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [isWatchingAd, setIsWatchingAd] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await apiFetch('/api/bonus/status');
      setStreakData(data.streak);
      setCanClaim(data.canClaim);
      setRewards(data.rewards || []);
    } catch (err) {
      console.warn('Bonus status fetch warning:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleClaimDaily = async () => {
    setIsClaiming(true);
    setErrorMessage(null);
    try {
      const data = await apiFetch('/api/bonus/claim', { method: 'POST' });
      triggerHaptic('success');
      onUpdateWallet(data.authoritativeBalance);
      setStreakData(data.streak);
      setCanClaim(false);
      setSuccessMessage(`Claimed ${data.reward.toLocaleString()} XCOIN daily reward!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Claim failed');
      triggerHaptic('error');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleWatchAd = async () => {
    setIsWatchingAd(true);
    setErrorMessage(null);

    // Simulate verified ad view duration (4 seconds) before server confirmation
    setTimeout(async () => {
      try {
        const data = await apiFetch('/api/bonus/ad-reward', { method: 'POST' });
        triggerHaptic('success');
        onUpdateWallet(data.authoritativeBalance);
        setSuccessMessage(`Watched Ad! +${data.reward.toLocaleString()} XCOIN awarded.`);
        setTimeout(() => setSuccessMessage(null), 4000);
      } catch (err: any) {
        setErrorMessage(err.message || 'Ad reward validation failed');
        triggerHaptic('error');
      } finally {
        setIsWatchingAd(false);
      }
    }, 4000);
  };

  const currentDay = streakData?.currentDay || 1;

  return (
    <div className="max-w-md mx-auto py-4 px-4 flex flex-col gap-4 pb-24">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-zinc-900 to-black p-4 rounded-2xl border border-amber-500/20 shadow-lg">
        <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-amber-400" />
          <span>Rewards & Bonuses</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Check in daily to build your reward streak and watch partner sponsor ads for instant XCOIN.
        </p>

        {errorMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* 7-Day Daily Streak Card */}
      <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">7-Day Daily Check-in</h3>
          </div>
          <span className="text-[11px] font-mono text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            Streak: {streakData?.streak || 0} Days
          </span>
        </div>

        {/* 7 Day Grid */}
        <div className="grid grid-cols-7 gap-1.5 pt-2">
          {rewards.map((reward, index) => {
            const dayNum = index + 1;
            const isClaimed = streakData?.claimedDays.includes(dayNum);
            const isToday = dayNum === currentDay;

            return (
              <div
                key={dayNum}
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border text-center transition-all ${
                  isClaimed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : isToday
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                    : 'bg-zinc-900 border-white/5 text-zinc-500'
                }`}
              >
                <span className="text-[10px] font-bold">D{dayNum}</span>
                <CoinIcon className="w-4 h-4 my-1" />
                <span className="text-[9px] font-mono font-bold leading-tight">
                  {reward >= 1000 ? `${reward / 1000}k` : reward}
                </span>
              </div>
            );
          })}
        </div>

        <button
          disabled={!canClaim || isClaiming}
          onClick={handleClaimDaily}
          className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 mt-2 transition-all ${
            canClaim
              ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold shadow-[0_4px_16px_rgba(212,175,55,0.3)] active:scale-[0.98]'
              : 'bg-zinc-900 text-zinc-500 border border-white/5 cursor-not-allowed'
          }`}
        >
          {isClaiming ? (
            <span>Processing...</span>
          ) : canClaim ? (
            <span>CLAIM DAY {currentDay} REWARD</span>
          ) : (
            <span>CHECK-IN CLAIMED FOR TODAY</span>
          )}
        </button>
      </div>

      {/* Rewarded Ads Section (Adsgram-ready) */}
      <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Watch Rewarded Ad</h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            +1,000 XCOIN
          </span>
        </div>

        <p className="text-xs text-zinc-400">
          Support the platform and receive 1,000 XCOIN instantly after completing a short sponsored video.
        </p>

        <button
          disabled={isWatchingAd}
          onClick={handleWatchAd}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(16,185,129,0.25)] active:scale-[0.98] transition-all"
        >
          {isWatchingAd ? (
            <span className="animate-pulse">Watching Sponsored Video (4s)...</span>
          ) : (
            <>
              <Play className="w-4 h-4 fill-black" />
              <span>WATCH VIDEO FOR 1,000 XCOIN</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
