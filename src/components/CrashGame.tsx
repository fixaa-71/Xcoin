import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile, UserWallet, CrashBet } from '../types';
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Plus,
  Minus,
  Sparkles,
  Users as UsersIcon,
  HelpCircle,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { audioSynth } from '../lib/audio-effects';

interface CrashGameProps {
  user: UserProfile;
  wallet: UserWallet;
  onUpdateWalletXC: (newBalanceXC: number) => void;
  triggerHaptic: (type?: any) => void;
  onOpenFairness: (roundId?: string) => void;
}

interface BetPanelState {
  amount: number;
  autoCashoutEnabled: boolean;
  autoCashout: string;
  autoBetEnabled: boolean;
  isPlacing: boolean;
  isCashingOut: boolean;
}

export const CrashGame: React.FC<CrashGameProps> = ({
  user,
  wallet,
  onUpdateWalletXC,
  triggerHaptic,
  onOpenFairness,
}) => {
  const [roundState, setRoundState] = useState<any>(null);
  const [recentRounds, setRecentRounds] = useState<any[]>([]);
  const [userBets, setUserBets] = useState<CrashBet[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => audioSynth.getMuted());
  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');

  // Dual Bet Panels state (Panel 1 and Panel 2 like authentic Aviator)
  const [dualMode, setDualMode] = useState<boolean>(false);
  const [panel1, setPanel1] = useState<BetPanelState>({
    amount: 500,
    autoCashoutEnabled: true,
    autoCashout: '2.00',
    autoBetEnabled: false,
    isPlacing: false,
    isCashingOut: false,
  });
  const [panel2, setPanel2] = useState<BetPanelState>({
    amount: 500,
    autoCashoutEnabled: false,
    autoCashout: '1.50',
    autoBetEnabled: false,
    isPlacing: false,
    isCashingOut: false,
  });

  // Simulated live multiplayer participants for immersion
  const [livePlayers, setLivePlayers] = useState<
    Array<{ id: string; name: string; bet: number; cashedAt?: number; profit?: number }>
  >([]);

  // Smooth visual multiplier
  const [displayMultiplier, setDisplayMultiplier] = useState<number>(1.00);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Plane animation particles
  const particlesRef = useRef<Array<{ x: number; y: number; alpha: number; size: number; vx: number; vy: number }>>([]);
  const propAngleRef = useRef<number>(0);
  const previousStatusRef = useRef<string>('');

  // Fetch crash state polling
  const fetchState = useCallback(async () => {
    try {
      const data = await apiFetch('/api/crash/state');
      setRoundState(data.round);
      setRecentRounds(data.recentRounds || []);
      setUserBets(data.userBets || []);
    } catch (err) {
      console.warn('Crash state poll warning:', err);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Generate simulated multiplayer players when new round starts
  useEffect(() => {
    if (roundState?.status === 'BETTING') {
      const names = [
        'Alex_Ton', 'CryptoTrader99', 'Elena_M', 'Viktor_K', 'Satoshi_7',
        'WhaleAlpha', 'LuckyPilot', 'Dmitry_VIP', 'Nadia_Fast', 'CyberX',
      ];
      const randomPlayers = names.slice(0, 5 + Math.floor(Math.random() * 5)).map((name, i) => ({
        id: `p-${i}-${roundState.roundId}`,
        name,
        bet: [100, 250, 500, 1000, 2500, 5000][Math.floor(Math.random() * 6)],
      }));
      setLivePlayers(randomPlayers);
    }
  }, [roundState?.roundId, roundState?.status]);

  // Update multiplayer cashouts during running
  useEffect(() => {
    if (roundState?.status === 'RUNNING') {
      setLivePlayers((prev) =>
        prev.map((p) => {
          if (!p.cashedAt && displayMultiplier >= 1.2 && Math.random() < 0.08) {
            const cashedAt = Math.round(displayMultiplier * 100) / 100;
            return {
              ...p,
              cashedAt,
              profit: Math.floor(p.bet * cashedAt),
            };
          }
          return p;
        })
      );
    }
  }, [displayMultiplier, roundState?.status]);

  // Audio & Haptic reactions on status change
  useEffect(() => {
    if (!roundState) return;
    const prev = previousStatusRef.current;
    const current = roundState.status;
    previousStatusRef.current = current;

    if (current === 'RUNNING' && prev !== 'RUNNING') {
      triggerHaptic('light');
    } else if (current === 'CRASHED' && prev === 'RUNNING') {
      triggerHaptic('error');
      audioSynth.playFlewAway();
    } else if (current === 'BETTING' && prev !== 'BETTING') {
      audioSynth.stopCrashHum();
    }
  }, [roundState?.status, triggerHaptic]);

  // Continuous multiplier tick & engine sound
  useEffect(() => {
    if (!roundState || roundState.status !== 'RUNNING') {
      audioSynth.stopCrashHum();
      if (roundState?.status === 'CRASHED' || roundState?.status === 'SETTLED') {
        setDisplayMultiplier(roundState.crashPoint || 1.00);
      } else {
        setDisplayMultiplier(1.00);
      }
      return;
    }

    const runStart = roundState.runningAt || Date.now();
    const targetCrash = roundState.crashPoint;

    const tick = () => {
      const elapsed = Date.now() - runStart;
      const current = Math.exp(0.06 * (elapsed / 1000));
      const formatted = Math.floor(current * 100) / 100;

      if (targetCrash && formatted >= targetCrash) {
        setDisplayMultiplier(targetCrash);
      } else {
        setDisplayMultiplier(formatted);
        audioSynth.updateCrashHum(formatted);
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [roundState?.status, roundState?.runningAt, roundState?.crashPoint]);

  // Canvas 60fps renderer for Aviator flight curve, airplane & particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear background
      ctx.fillStyle = '#060911';
      ctx.fillRect(0, 0, width, height);

      // 2. Tech Radar Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 32;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const isRunning = roundState?.status === 'RUNNING';
      const isCrashed = roundState?.status === 'CRASHED' || roundState?.status === 'SETTLED';

      if (isRunning || isCrashed) {
        const mult = displayMultiplier;
        // Flight progress 0 -> 1 based on multiplier
        const progress = Math.min(1, Math.max(0, (mult - 1.0) / 5.0));

        // Start point (bottom-left)
        const startX = 20;
        const startY = height - 25;

        // Plane tip point
        let planeX = startX + progress * (width - 90);
        let planeY = startY - Math.pow(progress, 0.82) * (height - 70);

        // Control point for smooth quadratic parabolic arc
        const cpX = startX + (planeX - startX) * 0.55;
        const cpY = startY;

        // If crashed, animate plane flying away into the top right
        if (isCrashed) {
          planeX = Math.min(width + 80, planeX + 50);
          planeY = Math.max(-60, planeY - 45);
        }

        // Draw Area Fill Under Curve (Aviator signature crimson gradient)
        const fillGradient = ctx.createLinearGradient(0, planeY, 0, height);
        fillGradient.addColorStop(0, 'rgba(225, 29, 72, 0.32)');
        fillGradient.addColorStop(0.7, 'rgba(225, 29, 72, 0.08)');
        fillGradient.addColorStop(1, 'rgba(225, 29, 72, 0.0)');

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, planeX, planeY);
        ctx.lineTo(planeX, startY);
        ctx.closePath();
        ctx.fillStyle = fillGradient;
        ctx.fill();

        // Draw Glowing Red Flight Trajectory Line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, planeX, planeY);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#e11d48';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow

        // Spawn Jet Smoke / Thrust Particles
        if (isRunning) {
          particlesRef.current.push({
            x: planeX - 16,
            y: planeY + 6,
            alpha: 0.8,
            size: Math.random() * 4 + 2,
            vx: -(Math.random() * 2 + 1.5),
            vy: (Math.random() - 0.3) * 1.5,
          });
        }

        // Update and draw exhaust particles
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.035;
          p.size = Math.max(0.5, p.size * 0.96);

          if (p.alpha <= 0) {
            particlesRef.current.splice(i, 1);
            continue;
          }

          ctx.fillStyle = `rgba(251, 146, 60, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw Authentic Aviator Red Propeller Plane
        if (!isCrashed || planeX < width + 50) {
          ctx.save();
          ctx.translate(planeX, planeY);

          // Calculate trajectory angle for realistic flight attitude
          const angle = Math.atan2(planeY - cpY, planeX - cpX) * 0.65 - 0.15;
          ctx.rotate(angle);

          // Jet Engine Afterburner Flame
          if (isRunning) {
            const flameLen = 14 + Math.random() * 8;
            const flameGrad = ctx.createLinearGradient(-flameLen - 12, 0, -12, 0);
            flameGrad.addColorStop(0, 'rgba(251, 191, 36, 0)');
            flameGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.7)');
            flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0.9)');

            ctx.fillStyle = flameGrad;
            ctx.beginPath();
            ctx.moveTo(-12, -3);
            ctx.lineTo(-12 - flameLen, 0);
            ctx.lineTo(-12, 3);
            ctx.closePath();
            ctx.fill();
          }

          // Airplane Body (Classic Aviator Red Monoplane)
          // Main Fuselage
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.moveTo(18, 0); // Nose tip
          ctx.quadraticCurveTo(12, -7, -10, -5);
          ctx.lineTo(-18, -2);
          ctx.lineTo(-18, 2);
          ctx.lineTo(-10, 5);
          ctx.quadraticCurveTo(12, 7, 18, 0);
          ctx.closePath();
          ctx.fill();

          // Cabin / Cockpit Glass (Glossy white/cyan reflection)
          ctx.fillStyle = '#e0f2fe';
          ctx.beginPath();
          ctx.ellipse(3, -2, 6, 2.5, -0.15, 0, Math.PI * 2);
          ctx.fill();

          // Main Wing (Swept)
          ctx.fillStyle = '#b91c1c';
          ctx.beginPath();
          ctx.moveTo(2, -2);
          ctx.lineTo(-8, -14);
          ctx.lineTo(-14, -13);
          ctx.lineTo(-5, 0);
          ctx.closePath();
          ctx.fill();

          // Tail Fin
          ctx.fillStyle = '#991b1b';
          ctx.beginPath();
          ctx.moveTo(-14, -1);
          ctx.lineTo(-20, -10);
          ctx.lineTo(-24, -9);
          ctx.lineTo(-18, 1);
          ctx.closePath();
          ctx.fill();

          // Spinning Propeller
          propAngleRef.current += 0.45;
          const propY = Math.sin(propAngleRef.current) * 10;
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(19, -propY);
          ctx.lineTo(19, propY);
          ctx.stroke();

          // Nose Cone Spinner
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(19, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [displayMultiplier, roundState?.status]);

  // Handle Bet submission
  const handlePlaceBet = async (panelNum: 1 | 2) => {
    const panel = panelNum === 1 ? panel1 : panel2;
    const setPanel = panelNum === 1 ? setPanel1 : setPanel2;

    if (wallet.xcBalance < panel.amount) {
      setErrorMessage('Insufficient XC balance');
      triggerHaptic('error');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setPanel((p) => ({ ...p, isPlacing: true }));
    setErrorMessage(null);

    try {
      const data = await apiFetch('/api/crash/bet', {
        method: 'POST',
        body: JSON.stringify({
          betAmount: panel.amount,
          autoCashoutMultiplier:
            panel.autoCashoutEnabled && panel.autoCashout
              ? parseFloat(panel.autoCashout)
              : undefined,
          requestId: `bet_${panelNum}_${Date.now()}`,
        }),
      });

      triggerHaptic('medium');
      audioSynth.playTradePlaced();
      onUpdateWalletXC(data.authoritativeBalanceXC);
      setUserBets((prev) => [...prev, data.bet]);
      setSuccessMessage(`Bet of ${panel.amount} XC placed!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to place bet');
      triggerHaptic('error');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setPanel((p) => ({ ...p, isPlacing: false }));
    }
  };

  // Handle Cashout submission
  const handleCashout = async (betId: string, panelNum: 1 | 2) => {
    const setPanel = panelNum === 1 ? setPanel1 : setPanel2;
    setPanel((p) => ({ ...p, isCashingOut: true }));
    setErrorMessage(null);

    try {
      const data = await apiFetch('/api/crash/cashout', {
        method: 'POST',
        body: JSON.stringify({ betId }),
      });

      triggerHaptic('success');
      audioSynth.playCashout();
      onUpdateWalletXC(data.authoritativeBalanceXC);
      setSuccessMessage(`CASHED OUT! +${data.payout} XC (${data.multiplier.toFixed(2)}x)`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchState();
    } catch (err: any) {
      setErrorMessage(err.message || 'Cashout failed');
      triggerHaptic('error');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setPanel((p) => ({ ...p, isCashingOut: false }));
    }
  };

  const isBettingOpen = roundState?.status === 'BETTING';
  const isRunning = roundState?.status === 'RUNNING';
  const isCrashed = roundState?.status === 'CRASHED' || roundState?.status === 'SETTLED';

  const activeBets = userBets.filter((b) => b.status === 'ACTIVE');
  const activeBet1 = activeBets[0];
  const activeBet2 = activeBets[1];

  const presets = [100, 500, 1000, 5000, 10000];

  return (
    <div className="max-w-md mx-auto py-2.5 px-3 flex flex-col gap-2.5 pb-24 select-none">
      {/* 1. TOP HEADER (PHOTO FIDELITY) */}
      <div className="flex items-center justify-between bg-zinc-950/85 border border-white/10 rounded-2xl p-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Red square airplane badge */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-red-600/30 border border-rose-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(244,63,94,0.3)]">
            <span className="text-xl transform rotate-45 select-none">✈️</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white tracking-wide">
                X CRASH
              </h2>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/30 uppercase tracking-wider">
                PROVABLY FAIR
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">
              Round {roundState?.roundId || 'CRASH-000001'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Sound Toggle */}
          <button
            onClick={() => setIsMuted(audioSynth.toggleMute())}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 transition-colors"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Fairness Modal Button */}
          <button
            onClick={() => onOpenFairness(roundState?.roundId)}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/30 transition-all font-semibold shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Fairness</span>
          </button>
        </div>
      </div>

      {/* 2. RECENT ROUNDS MULTIPLIER RIBBON */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[10px] uppercase font-bold text-zinc-500 shrink-0 font-mono">
          RECENT:
        </span>
        {recentRounds.map((r, idx) => {
          const mult = r.crashPoint || 1.0;
          const isHigh = mult >= 10.0;
          const isMedium = mult >= 2.0;

          return (
            <button
              key={r.roundId || idx}
              onClick={() => onOpenFairness(r.roundId)}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold shrink-0 transition-transform active:scale-95 border ${
                isHigh
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                  : isMedium
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-400 border-white/5'
              }`}
            >
              {mult.toFixed(2)}x
            </button>
          );
        })}
      </div>

      {/* 3. MAIN AVIATOR RADAR / FLIGHT CANVAS (EXACT PHOTO SCREEN) */}
      <div className="relative w-full h-56 bg-[#060911] rounded-3xl border border-amber-500/20 overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,0.9)] flex flex-col justify-between p-3.5">
        {/* Real-time HTML5 60fps Canvas for parabolic arc and airplane */}
        <canvas
          ref={canvasRef}
          width={400}
          height={220}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Top Info Bar inside canvas */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning
                  ? 'bg-emerald-400 animate-ping'
                  : isBettingOpen
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-zinc-200">
              {roundState?.status || 'PREPARING'}
            </span>
          </div>

          <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
            Hash: {roundState?.serverSeedHash?.slice(0, 10)}...
          </span>
        </div>

        {/* Center Multiplier or Starting State */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto pointer-events-none">
          {isBettingOpen ? (
            <div className="flex flex-col items-center animate-pulse">
              <span className="text-[11px] uppercase tracking-widest text-amber-400 font-extrabold mb-1">
                BETTING CLOSES IN
              </span>
              <span className="text-3xl font-mono font-black text-amber-300 tracking-wider">
                STARTING . . .
              </span>
              <div className="w-36 h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden border border-amber-500/20">
                <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 animate-[pulse_1s_infinite] w-full" />
              </div>
            </div>
          ) : isCrashed ? (
            <div className="flex flex-col items-center">
              <span className="text-xs font-black uppercase text-rose-500 tracking-widest flex items-center gap-1">
                <span>💥 FLEW AWAY</span>
              </span>
              <span className="text-5xl font-mono font-black text-rose-400 drop-shadow-[0_0_25px_rgba(244,63,94,0.5)]">
                {roundState?.crashPoint?.toFixed(2) || displayMultiplier.toFixed(2)}x
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-6xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-yellow-200 to-amber-400 drop-shadow-[0_0_30px_rgba(212,175,55,0.4)]">
                {displayMultiplier.toFixed(2)}x
              </span>
            </div>
          )}
        </div>

        {/* Bottom Safety Info */}
        <div className="relative z-10 text-[9px] text-zinc-400 text-center font-mono">
          Provably Fair SHA-256 HMAC Algorithm • Server Authoritative
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* DUAL BET PANEL TOGGLE */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold text-zinc-400">
          BETTING PANELS
        </span>
        <button
          onClick={() => setDualMode(!dualMode)}
          className={`text-[11px] px-2.5 py-1 rounded-xl font-bold border transition-colors flex items-center gap-1 ${
            dualMode
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>{dualMode ? 'Dual Bets Active (+2)' : '+ Add 2nd Bet Panel'}</span>
        </button>
      </div>

      {/* 4. BET CONTROLS (PANEL 1) */}
      <div className="bg-zinc-950/85 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md flex flex-col gap-2.5 shadow-lg">
        {/* Active Bet 1 Cashout View */}
        {activeBet1 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">PANEL 1 BET:</span>
              <span className="text-white font-bold">{activeBet1.betAmount} XC</span>
            </div>

            <button
              disabled={!isRunning || panel1.isCashingOut}
              onClick={() => handleCashout(activeBet1.betId, 1)}
              className={`w-full py-3.5 rounded-xl font-mono font-black text-base flex flex-col items-center justify-center transition-all ${
                isRunning
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black shadow-[0_0_24px_rgba(212,175,55,0.4)] active:scale-[0.98]'
                  : 'bg-zinc-900 text-zinc-500 cursor-not-allowed border border-white/5'
              }`}
            >
              <span>CASH OUT</span>
              <span className="text-xs font-black text-zinc-900">
                +{Math.floor(activeBet1.betAmount * displayMultiplier)} XC ({displayMultiplier.toFixed(2)}x)
              </span>
            </button>
          </div>
        ) : (
          <>
            {/* Amount Selection */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1 font-semibold">
                <span className="text-zinc-400 font-mono text-[11px]">BET AMOUNT (XC)</span>
                <span className="text-emerald-400 font-mono text-[11px]">
                  Available: {wallet.xcBalance.toLocaleString()} XC
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPanel1((p) => ({ ...p, amount: Math.max(100, p.amount - 100) }))}
                  className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 text-white font-bold text-sm flex items-center justify-center hover:bg-zinc-800 active:scale-95"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  value={panel1.amount}
                  onChange={(e) =>
                    setPanel1((p) => ({ ...p, amount: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  className="flex-1 h-9 bg-zinc-900/90 border border-white/10 rounded-xl px-2 font-mono font-bold text-center text-white text-sm focus:outline-none focus:border-amber-500/50"
                />
                <button
                  onClick={() => setPanel1((p) => ({ ...p, amount: p.amount + 100 }))}
                  className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 text-white font-bold text-sm flex items-center justify-center hover:bg-zinc-800 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                {presets.map((pr) => (
                  <button
                    key={pr}
                    onClick={() => setPanel1((p) => ({ ...p, amount: pr }))}
                    className={`py-1 rounded-lg text-[10px] font-mono font-bold border transition-colors ${
                      panel1.amount === pr
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {pr >= 1000 ? `${pr / 1000}K` : pr}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Cashout Row */}
            <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={panel1.autoCashoutEnabled}
                  onChange={(e) =>
                    setPanel1((p) => ({ ...p, autoCashoutEnabled: e.target.checked }))
                  }
                  className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                />
                <span className="text-[11px] font-semibold text-zinc-300">Auto Cashout</span>
              </label>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  value={panel1.autoCashout}
                  disabled={!panel1.autoCashoutEnabled}
                  onChange={(e) => setPanel1((p) => ({ ...p, autoCashout: e.target.value }))}
                  placeholder="2.00"
                  className="w-16 h-7 bg-zinc-900 border border-white/10 rounded-lg px-1 font-mono font-bold text-center text-amber-300 text-xs focus:outline-none focus:border-amber-500/50 disabled:opacity-40"
                />
                <span className="text-zinc-500 text-xs font-mono">x</span>
              </div>
            </div>

            {/* Place Bet Button */}
            <button
              disabled={!isBettingOpen || panel1.isPlacing || wallet.xcBalance < panel1.amount}
              onClick={() => handlePlaceBet(1)}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                isBettingOpen && wallet.xcBalance >= panel1.amount
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold shadow-[0_4px_16px_rgba(16,185,129,0.3)] active:scale-[0.98]'
                  : 'bg-zinc-900 text-zinc-500 border border-white/5 cursor-not-allowed'
              }`}
            >
              {panel1.isPlacing ? (
                <span>Placing...</span>
              ) : !isBettingOpen ? (
                <span>Waiting for Next Round</span>
              ) : wallet.xcBalance < panel1.amount ? (
                <span>Insufficient XC</span>
              ) : (
                <span>BET ({panel1.amount} XC)</span>
              )}
            </button>
          </>
        )}
      </div>

      {/* 5. OPTIONAL DUAL BET PANEL (PANEL 2) */}
      {dualMode && (
        <div className="bg-zinc-950/85 border border-purple-500/30 rounded-2xl p-3.5 backdrop-blur-md flex flex-col gap-2.5 shadow-lg relative">
          <div className="text-[10px] font-mono text-purple-400 uppercase font-bold tracking-wider">
            BET PANEL 2
          </div>

          {activeBet2 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">PANEL 2 BET:</span>
                <span className="text-white font-bold">{activeBet2.betAmount} XC</span>
              </div>

              <button
                disabled={!isRunning || panel2.isCashingOut}
                onClick={() => handleCashout(activeBet2.betId, 2)}
                className={`w-full py-3.5 rounded-xl font-mono font-black text-base flex flex-col items-center justify-center transition-all ${
                  isRunning
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_0_24px_rgba(168,85,247,0.4)] active:scale-[0.98]'
                    : 'bg-zinc-900 text-zinc-500 cursor-not-allowed border border-white/5'
                }`}
              >
                <span>CASH OUT (PANEL 2)</span>
                <span className="text-xs font-bold text-white/90">
                  +{Math.floor(activeBet2.betAmount * displayMultiplier)} XC ({displayMultiplier.toFixed(2)}x)
                </span>
              </button>
            </div>
          ) : (
            <>
              {/* Amount Selection */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1 font-semibold">
                  <span className="text-zinc-400 font-mono text-[11px]">BET AMOUNT (XC)</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPanel2((p) => ({ ...p, amount: Math.max(100, p.amount - 100) }))}
                    className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 text-white font-bold text-sm flex items-center justify-center hover:bg-zinc-800"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={panel2.amount}
                    onChange={(e) =>
                      setPanel2((p) => ({ ...p, amount: Math.max(0, parseInt(e.target.value) || 0) }))
                    }
                    className="flex-1 h-9 bg-zinc-900/90 border border-white/10 rounded-xl px-2 font-mono font-bold text-center text-white text-sm focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    onClick={() => setPanel2((p) => ({ ...p, amount: p.amount + 100 }))}
                    className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 text-white font-bold text-sm flex items-center justify-center hover:bg-zinc-800"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Auto Cashout Row */}
              <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={panel2.autoCashoutEnabled}
                    onChange={(e) =>
                      setPanel2((p) => ({ ...p, autoCashoutEnabled: e.target.checked }))
                    }
                    className="rounded border-zinc-700 text-purple-500 focus:ring-0"
                  />
                  <span className="text-[11px] font-semibold text-zinc-300">Auto Cashout</span>
                </label>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={panel2.autoCashout}
                    disabled={!panel2.autoCashoutEnabled}
                    onChange={(e) => setPanel2((p) => ({ ...p, autoCashout: e.target.value }))}
                    placeholder="1.50"
                    className="w-16 h-7 bg-zinc-900 border border-white/10 rounded-lg px-1 font-mono font-bold text-center text-purple-300 text-xs focus:outline-none disabled:opacity-40"
                  />
                  <span className="text-zinc-500 text-xs font-mono">x</span>
                </div>
              </div>

              {/* Place Bet 2 Button */}
              <button
                disabled={!isBettingOpen || panel2.isPlacing || wallet.xcBalance < panel2.amount}
                onClick={() => handlePlaceBet(2)}
                className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  isBettingOpen && wallet.xcBalance >= panel2.amount
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-extrabold shadow-[0_4px_16px_rgba(168,85,247,0.3)] active:scale-[0.98]'
                    : 'bg-zinc-900 text-zinc-500 border border-white/5 cursor-not-allowed'
                }`}
              >
                {panel2.isPlacing ? (
                  <span>Placing...</span>
                ) : !isBettingOpen ? (
                  <span>Waiting...</span>
                ) : (
                  <span>BET 2 ({panel2.amount} XC)</span>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* 6. LIVE MULTIPLAYER BETS FEED & MY BETS */}
      <div className="bg-zinc-950/85 border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('all')}
              className={`text-xs font-bold transition-colors ${
                activeTab === 'all' ? 'text-amber-300' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Bets ({livePlayers.length + activeBets.length})
            </button>
            <button
              onClick={() => setActiveTab('my')}
              className={`text-xs font-bold transition-colors ${
                activeTab === 'my' ? 'text-amber-300' : 'text-zinc-400 hover:text-white'
              }`}
            >
              My Bets ({userBets.length})
            </button>
          </div>

          <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
            <UsersIcon className="w-3 h-3" /> Live Round
          </span>
        </div>

        {activeTab === 'all' ? (
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
            {/* User's own active bets first */}
            {activeBets.map((b) => (
              <div
                key={b.betId}
                className="bg-amber-500/10 border border-amber-500/30 p-2 rounded-xl flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-amber-200 font-bold">You</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">{b.betAmount} XC</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    IN FLIGHT
                  </span>
                </div>
              </div>
            ))}

            {/* Multiplayer simulated active players */}
            {livePlayers.map((player) => (
              <div
                key={player.id}
                className="bg-zinc-900/60 border border-white/5 p-2 rounded-xl flex items-center justify-between text-xs font-mono"
              >
                <span className="text-zinc-300">{player.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">{player.bet} XC</span>
                  {player.cashedAt ? (
                    <span className="text-emerald-400 font-bold text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      +{player.profit} XC ({player.cashedAt}x)
                    </span>
                  ) : (
                    <span className="text-zinc-500 text-[10px]">active</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
            {userBets.length === 0 ? (
              <div className="text-center py-4 text-xs text-zinc-500">No bets yet this round</div>
            ) : (
              userBets.map((b) => (
                <div
                  key={b.betId}
                  className="bg-zinc-900/60 border border-white/5 p-2 rounded-xl flex items-center justify-between text-xs font-mono"
                >
                  <span className="text-zinc-300">{b.betAmount} XC</span>
                  {b.status === 'CASHED_OUT' ? (
                    <span className="text-emerald-400 font-bold">
                      +{b.payoutAmount} XC ({b.cashoutMultiplier?.toFixed(2)}x)
                    </span>
                  ) : b.status === 'LOST' ? (
                    <span className="text-rose-400">-{b.betAmount} XC (Lost)</span>
                  ) : (
                    <span className="text-amber-400 animate-pulse">Active</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
