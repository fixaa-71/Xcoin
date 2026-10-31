import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UserProfile, UserWallet } from '../types';
import { CoinIcon } from './CoinIcon';
import { Zap, Flame, BatteryCharging, ArrowUpRight } from 'lucide-react';
import { apiFetch } from '../services/api';

interface TapSectionProps {
  user: UserProfile;
  wallet: UserWallet;
  onUpdateWallet: (newBalance: number) => void;
  triggerHaptic: (type?: any) => void;
  onNavigate: (tab: any) => void;
}

interface FloatingNumber {
  id: number;
  x: number;
  y: number;
  amount: number;
}

export const TapSection: React.FC<TapSectionProps> = ({
  user,
  wallet,
  onUpdateWallet,
  triggerHaptic,
  onNavigate,
}) => {
  const [currentEnergy, setCurrentEnergy] = useState<number>(user.energy);
  const [isPressing, setIsPressing] = useState<boolean>(false);
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
  const [tapEvents, setTapEvents] = useState<any>(null);
  const pendingTapsRef = useRef<number>(0);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Poll active tap multiplier / golden hour status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await apiFetch('/api/tap/event-status');
        setTapEvents(data);
      } catch (e) {
        // quiet fallback
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  // Sync energy with user prop updates
  useEffect(() => {
    setCurrentEnergy(user.energy);
  }, [user.energy]);

  // Client-side smooth energy recharge tick
  useEffect(() => {
    const multiplier = tapEvents?.energyRechargeMultiplier || 1;
    const effectiveRecharge = user.rechargePower * multiplier;
    const timer = setInterval(() => {
      setCurrentEnergy((prev) => {
        if (prev >= user.energyCapacity) return user.energyCapacity;
        return Math.min(user.energyCapacity, prev + Math.ceil(effectiveRecharge / 2));
      });
    }, 500);
    return () => clearInterval(timer);
  }, [user.energyCapacity, user.rechargePower, tapEvents?.energyRechargeMultiplier]);

  // Flush pending taps to authoritative backend
  const flushTaps = useCallback(async () => {
    const tapCount = pendingTapsRef.current;
    if (tapCount <= 0) return;
    pendingTapsRef.current = 0;

    const tapBatchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    try {
      const data = await apiFetch('/api/tap', {
        method: 'POST',
        body: JSON.stringify({
          tapBatchId,
          count: tapCount,
        }),
      });

      if (data.authoritativeBalance !== undefined) {
        onUpdateWallet(data.authoritativeBalance);
      }
      if (data.remainingEnergy !== undefined) {
        setCurrentEnergy(data.remainingEnergy);
      }
    } catch (err) {
      console.error('Tap batch sync error:', err);
    }
  }, [onUpdateWallet]);

  // Single pointer event architecture: onPointerDown ONLY
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (currentEnergy < 1) {
      triggerHaptic('warning');
      return;
    }

    // Deduct energy locally immediately for snappy responsiveness
    setCurrentEnergy((prev) => Math.max(0, prev - 1));
    pendingTapsRef.current += 1;

    // Optimistic balance update
    onUpdateWallet(wallet.xcoinBalance + user.tapPower);

    // Haptics & Visual Feedback
    triggerHaptic('light');
    setIsPressing(true);
    setTimeout(() => setIsPressing(false), 80);

    // Add floating text
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newId = Date.now() + Math.random();

    setFloatingNumbers((prev) => [...prev.slice(-15), { id: newId, x, y, amount: user.tapPower }]);
    setTimeout(() => {
      setFloatingNumbers((prev) => prev.filter((item) => item.id !== newId));
    }, 900);

    // Debounced batch flush (500ms debounce ensures rapid taps queue into single idempotent batch)
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      flushTaps();
    }, 400);
  };

  const energyPercent = Math.min(100, Math.max(0, Math.round((currentEnergy / user.energyCapacity) * 100)));

  return (
    <div className="flex flex-col items-center justify-between min-h-[calc(100vh-140px)] py-4 px-4 select-none">
      {/* Top Header Card */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
          Authoritative Balance
        </span>
        <div className="flex items-center gap-3">
          <CoinIcon className="w-9 h-9" />
          <h1 className="text-4xl font-extrabold font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 drop-shadow-[0_2px_12px_rgba(212,175,55,0.3)]">
            {wallet.xcoinBalance.toLocaleString()}
          </h1>
          <span className="text-sm font-bold text-amber-400/80">XCOIN</span>
        </div>

        {/* Level & Power Badge */}
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/80 border border-amber-500/20 text-xs font-medium text-amber-200">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Tap Power: +{user.tapPower}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/80 border border-white/10 text-xs font-medium text-zinc-300">
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            <span>+{user.rechargePower * (tapEvents?.energyRechargeMultiplier || 1)}/s</span>
          </div>
        </div>

        {/* Live Event Multiplier Banner */}
        {(tapEvents?.goldenHourActive || (tapEvents?.tapMultiplier && tapEvents.tapMultiplier > 1)) && (
          <div className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 border border-amber-500/50 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(251,191,36,0.3)] animate-pulse mt-1">
            <Flame className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-xs font-black tracking-wide text-yellow-300 uppercase">
              {tapEvents?.goldenHourActive
                ? `🔥 GOLDEN TAP HOUR ACTIVE! (${(tapEvents?.tapMultiplier || 1) * (tapEvents?.goldenHourMultiplier || 2)}X REWARDS)`
                : `⚡ SPECIAL EVENT: ${tapEvents.tapMultiplier}X TAP MULTIPLIER ACTIVE!`}
            </span>
          </div>
        )}
      </div>

      {/* Main Mining Coin Button */}
      <div className="relative my-auto flex items-center justify-center">
        {/* Ambient Glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600/20 via-yellow-500/10 to-transparent blur-3xl transform scale-125 pointer-events-none" />

        {/* Large Interactive Coin Container */}
        <div
          onPointerDown={handlePointerDown}
          className={`relative cursor-pointer transition-transform duration-75 active:scale-94 ${
            isPressing ? 'scale-[0.93]' : 'scale-100 hover:scale-[1.02]'
          } rounded-full p-3 bg-gradient-to-b from-amber-500/30 via-zinc-900/80 to-black/90 border-2 border-amber-500/40 shadow-[0_12px_36px_rgba(0,0,0,0.8),0_0_24px_rgba(212,175,55,0.25)]`}
          style={{ touchAction: 'manipulation' }}
        >
          <img
            src="/assets/coin.svg"
            alt="X COIN"
            className="w-56 h-56 md:w-64 md:h-64 rounded-full object-contain pointer-events-none select-none drop-shadow-[0_0_28px_rgba(212,175,55,0.4)]"
            draggable={false}
          />

          {/* Floating Numbers Container */}
          {floatingNumbers.map((item) => (
            <div
              key={item.id}
              className="absolute pointer-events-none font-black font-mono text-xl text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-bounce"
              style={{
                left: `${item.x}px`,
                top: `${item.y - 20}px`,
                animation: 'floatUp 0.8s ease-out forwards',
              }}
            >
              +{item.amount}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Energy Bar & Quick Nav */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        {/* Energy Card */}
        <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-3 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <div className="flex items-center gap-1.5 text-amber-300">
              <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>Energy</span>
            </div>
            <div className="font-mono text-zinc-300">
              <span className="text-white font-bold">{currentEnergy}</span>
              <span className="text-zinc-500"> / {user.energyCapacity}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(212,175,55,0.5)]"
              style={{ width: `${energyPercent}%` }}
            />
          </div>
        </div>

        {/* Quick Action Pills */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onNavigate('upgrades')}
            className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-zinc-900/70 border border-white/10 hover:border-amber-500/30 text-xs font-semibold text-zinc-300 hover:text-white transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Upgrades</span>
          </button>
          <button
            onClick={() => onNavigate('crash')}
            className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-zinc-900/70 border border-rose-500/30 hover:border-rose-400 text-xs font-semibold text-rose-300 hover:text-rose-200 transition-all"
          >
            <span>✈️ Aviator</span>
          </button>
          <button
            onClick={() => onNavigate('trade')}
            className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-zinc-900/70 border border-emerald-500/30 hover:border-emerald-400 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-all"
          >
            <span>QX Trade</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
