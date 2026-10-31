import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile, UserWallet, TradeRecord } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  BrainCircuit,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  BarChart2,
  Activity,
  Zap,
  Volume2,
  VolumeX,
  Layers,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { audioSynth } from '../lib/audio-effects';

interface TradingArenaProps {
  user: UserProfile;
  wallet: UserWallet;
  onUpdateWalletXC: (newBalanceXC: number) => void;
  triggerHaptic: (type?: any) => void;
  onOpenVip: () => void;
}

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TradingAsset {
  symbol: string;
  name: string;
  payoutPercent: number;
  basePrice: number;
  volatility: number;
}

const ASSETS: TradingAsset[] = [
  { symbol: 'XC/USD OTC', name: 'X Coin OTC Index', payoutPercent: 92, basePrice: 42.50, volatility: 0.12 },
  { symbol: 'EUR/USD OTC', name: 'Euro / US Dollar OTC', payoutPercent: 93, basePrice: 1.0845, volatility: 0.0008 },
  { symbol: 'BTC/USD', name: 'Bitcoin Index', payoutPercent: 90, basePrice: 68450.00, volatility: 45.0 },
  { symbol: 'ETH/USD', name: 'Ethereum Index', payoutPercent: 88, basePrice: 3420.00, volatility: 3.5 },
];

export const TradingArena: React.FC<TradingArenaProps> = ({
  user,
  wallet,
  onUpdateWalletXC,
  triggerHaptic,
  onOpenVip,
}) => {
  // Selected Asset & Chart Mode
  const [selectedAsset, setSelectedAsset] = useState<TradingAsset>(ASSETS[0]);
  const [showAssetDropdown, setShowAssetDropdown] = useState<boolean>(false);
  const [chartType, setChartType] = useState<'candles' | 'area'>('candles');
  const [timeframe, setTimeframe] = useState<number>(5); // 5s, 10s, 30s, 60s
  const [showIndicators, setShowIndicators] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(() => audioSynth.getMuted());

  // Price & Candles Data
  const [currentPrice, setCurrentPrice] = useState<number>(ASSETS[0].basePrice);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [userTrades, setUserTrades] = useState<TradeRecord[]>([]);
  const [tradesTab, setTradesTab] = useState<'active' | 'closed'>('active');

  // Trade form state
  const [amountXC, setAmountXC] = useState<number>(500);
  const [selectedExpiry, setSelectedExpiry] = useState<number>(10);
  const [isTrading, setIsTrading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tradeNotification, setTradeNotification] = useState<{
    type: 'win' | 'loss' | 'open';
    message: string;
    amount?: number;
  } | null>(null);

  // VIP AI Signals (Quotex Bot)
  const [aiSignal, setAiSignal] = useState<any>(null);
  const [isGeneratingSignal, setIsGeneratingSignal] = useState<boolean>(false);
  const [signalError, setSignalError] = useState<string | null>(null);

  // Sentiment state (% Call vs % Put)
  const [sentimentCall, setSentimentCall] = useState<number>(64);

  // Canvas Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevTradesRef = useRef<Map<string, TradeRecord>>(new Map());

  // Initialize initial synthetic candles for realistic Quotex look
  useEffect(() => {
    const initialCandles: Candle[] = [];
    let p = selectedAsset.basePrice;
    const now = Date.now();
    const count = 40;
    const tfMs = timeframe * 1000;

    for (let i = count; i >= 0; i--) {
      const time = now - i * tfMs;
      const change = (Math.random() - 0.49) * selectedAsset.volatility * 2;
      const open = p;
      const close = Math.max(0.001, open + change);
      const high = Math.max(open, close) + Math.random() * selectedAsset.volatility * 0.8;
      const low = Math.min(open, close) - Math.random() * selectedAsset.volatility * 0.8;
      initialCandles.push({
        timestamp: time,
        open,
        high,
        low,
        close,
      });
      p = close;
    }

    setCandles(initialCandles);
    setCurrentPrice(p);
  }, [selectedAsset, timeframe]);

  // Fetch real market and trades from backend
  const fetchMarket = useCallback(async () => {
    try {
      const data = await apiFetch('/api/trade/market');
      if (selectedAsset.symbol === 'XC/USD OTC' && data.currentPrice) {
        setCurrentPrice(data.currentPrice);
      }
      setUserTrades(data.userTrades || []);
    } catch (err) {
      console.warn('Market fetch error:', err);
    }
  }, [selectedAsset.symbol]);

  useEffect(() => {
    fetchMarket();
    const interval = setInterval(fetchMarket, 1000);
    return () => clearInterval(interval);
  }, [fetchMarket]);

  // Live real-time tick engine: updates current candle and spawns new candles smoothly
  useEffect(() => {
    const tickInterval = setInterval(() => {
      // Natural price tick walk
      const tickDelta = (Math.random() - 0.495) * selectedAsset.volatility * 0.6;
      setCurrentPrice((prev) => {
        const next = Math.max(0.0001, prev + tickDelta);

        // Update latest candle
        setCandles((oldCandles) => {
          if (oldCandles.length === 0) return oldCandles;
          const lastCandle = oldCandles[oldCandles.length - 1];
          const now = Date.now();
          const tfMs = timeframe * 1000;

          if (now - lastCandle.timestamp > tfMs) {
            // Start brand new candle
            const newCandle: Candle = {
              timestamp: now,
              open: next,
              high: next,
              low: next,
              close: next,
            };
            return [...oldCandles.slice(-50), newCandle];
          } else {
            // Update existing candle
            const updated: Candle = {
              ...lastCandle,
              high: Math.max(lastCandle.high, next),
              low: Math.min(lastCandle.low, next),
              close: next,
            };
            return [...oldCandles.slice(0, -1), updated];
          }
        });

        return next;
      });

      // Fluctuate sentiment slightly like Quotex
      setSentimentCall((prev) => {
        const shift = Math.floor((Math.random() - 0.5) * 4);
        return Math.min(85, Math.max(25, prev + shift));
      });
    }, 400);

    return () => clearInterval(tickInterval);
  }, [selectedAsset, timeframe]);

  // Detect trade settlements to trigger celebratory sounds and toast notifications
  useEffect(() => {
    userTrades.forEach((trade) => {
      const prev = prevTradesRef.current.get(trade.tradeId);
      if (prev && prev.status === 'OPEN' && trade.status === 'SETTLED') {
        if (trade.outcome === 'WIN') {
          triggerHaptic('success');
          audioSynth.playTradeWon();
          setTradeNotification({
            type: 'win',
            message: `TRADE WON! +${trade.payout} XC`,
            amount: trade.payout,
          });
        } else {
          triggerHaptic('error');
          audioSynth.playTradeLost();
          setTradeNotification({
            type: 'loss',
            message: `TRADE CLOSED (-${trade.amountXC} XC)`,
          });
        }
        setTimeout(() => setTradeNotification(null), 4000);
      }
      prevTradesRef.current.set(trade.tradeId, trade);
    });
  }, [userTrades, triggerHaptic]);

  // 60fps HTML5 Canvas Candlestick & Mountain Line Renderer (Quotex Quality)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Background obsidian gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#070a12');
      bgGrad.addColorStop(1, '#05070d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      if (candles.length < 2) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Calculate price domain bounds
      const minPrice = Math.min(...candles.map((c) => c.low), currentPrice) * 0.9995;
      const maxPrice = Math.max(...candles.map((c) => c.high), currentPrice) * 1.0005;
      const priceRange = maxPrice - minPrice || 1;

      // Coordinate converter helpers
      const getY = (val: number) => height - 30 - ((val - minPrice) / priceRange) * (height - 60);
      const chartWidth = width - 65; // Leave right margin for price scale
      const candleWidth = Math.max(3, (chartWidth / candles.length) * 0.65);
      const candleGap = chartWidth / candles.length;

      // 1. Quotex Grid Lines & Horizontal Price Levels
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const gridSteps = 5;
      for (let i = 0; i <= gridSteps; i++) {
        const y = 30 + (i / gridSteps) * (height - 60);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();

        // Price label on right axis
        const priceVal = maxPrice - (i / gridSteps) * priceRange;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText(
          selectedAsset.symbol.includes('BTC')
            ? priceVal.toFixed(1)
            : selectedAsset.symbol.includes('EUR')
            ? priceVal.toFixed(4)
            : priceVal.toFixed(2),
          chartWidth + 5,
          y + 3
        );
      }

      // 2. Technical Indicator: Moving Average (Yellow line)
      if (showIndicators && candles.length > 5) {
        ctx.strokeStyle = '#eab308'; // Amber yellow MA line
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const period = 7;
        for (let i = period - 1; i < candles.length; i++) {
          const slice = candles.slice(i - period + 1, i + 1);
          const avg = slice.reduce((sum, c) => sum + c.close, 0) / period;
          const x = i * candleGap + candleGap / 2;
          const y = getY(avg);
          if (i === period - 1) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 3. Render Candlesticks OR Mountain Line
      if (chartType === 'candles') {
        candles.forEach((c, i) => {
          const x = i * candleGap + candleGap / 2;
          const isBullish = c.close >= c.open;
          const color = isBullish ? '#22c55e' : '#ef4444'; // Quotex Green & Red

          // Wick (High to Low)
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x, getY(c.high));
          ctx.lineTo(x, getY(c.low));
          ctx.stroke();

          // Candle Body
          const openY = getY(c.open);
          const closeY = getY(c.close);
          const bodyY = Math.min(openY, closeY);
          const bodyH = Math.max(2, Math.abs(openY - closeY));

          ctx.fillStyle = color;
          ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, bodyH);
        });
      } else {
        // Mountain / Area Chart Mode (Quotex Cyan Glow)
        ctx.beginPath();
        candles.forEach((c, i) => {
          const x = i * candleGap + candleGap / 2;
          const y = getY(c.close);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });

        // Area gradient fill
        const lastX = (candles.length - 1) * candleGap + candleGap / 2;
        ctx.lineTo(lastX, height);
        ctx.lineTo(candleGap / 2, height);
        ctx.closePath();

        const areaGrad = ctx.createLinearGradient(0, 0, 0, height);
        areaGrad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
        areaGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
        ctx.fillStyle = areaGrad;
        ctx.fill();

        // Stroke line
        ctx.beginPath();
        candles.forEach((c, i) => {
          const x = i * candleGap + candleGap / 2;
          const y = getY(c.close);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 4. Live Current Price Ray & Pulsing Badge (Right Axis)
      const currentY = getY(currentPrice);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)'; // Yellow dashed horizontal line
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, currentY);
      ctx.lineTo(chartWidth, currentY);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Current Price Pill on Right Axis
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.roundRect(chartWidth + 2, currentY - 10, 58, 20, 4);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.fillText(
        selectedAsset.symbol.includes('BTC')
          ? currentPrice.toFixed(0)
          : selectedAsset.symbol.includes('EUR')
          ? currentPrice.toFixed(4)
          : currentPrice.toFixed(2),
        chartWidth + 6,
        currentY + 4
      );

      // 5. Plot Active User Trades Directly On Chart!
      const activeTrades = userTrades.filter((t) => t.status === 'OPEN');
      activeTrades.forEach((trade) => {
        const tradeY = getY(trade.entryPrice);
        const isUp = trade.direction === 'UP';
        const isWinning =
          (isUp && currentPrice > trade.entryPrice) || (!isUp && currentPrice < trade.entryPrice);

        const tradeColor = isWinning ? '#22c55e' : '#ef4444';

        // Horizontal Entry Line
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = tradeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, tradeY);
        ctx.lineTo(chartWidth, tradeY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Trade Marker Badge
        ctx.fillStyle = tradeColor;
        ctx.beginPath();
        ctx.roundRect(chartWidth - 110, tradeY - 11, 105, 22, 6);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        const remainingSec = Math.max(0, Math.ceil((trade.expiresAt - Date.now()) / 1000));
        ctx.fillText(
          `${isUp ? '▲' : '▼'} ${trade.amountXC}XC (${remainingSec}s)`,
          chartWidth - 104,
          tradeY + 4
        );
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [candles, currentPrice, chartType, showIndicators, selectedAsset, userTrades]);

  // Handle Open Binary Trade (Quotex CALL / PUT)
  const handleOpenTrade = async (direction: 'UP' | 'DOWN') => {
    if (wallet.xcBalance < amountXC) {
      setErrorMessage('Insufficient XC balance');
      triggerHaptic('error');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setIsTrading(true);
    setErrorMessage(null);

    try {
      const data = await apiFetch('/api/trade/open', {
        method: 'POST',
        body: JSON.stringify({
          amountXC,
          direction,
          expirySeconds: selectedExpiry,
          asset: selectedAsset.symbol,
          requestId: `qx_${Date.now()}`,
        }),
      });

      triggerHaptic('medium');
      audioSynth.playTradePlaced();
      onUpdateWalletXC(data.authoritativeBalanceXC);
      setUserTrades((prev) => [data.trade, ...prev]);

      setTradeNotification({
        type: 'open',
        message: `Opened ${direction === 'UP' ? 'CALL (UP)' : 'PUT (DOWN)'} with ${amountXC} XC (${selectedExpiry}s)`,
      });
      setTimeout(() => setTradeNotification(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to open trade');
      triggerHaptic('error');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsTrading(false);
    }
  };

  // Generate Quotex VIP AI Signal Bot
  const handleGenerateSignal = async () => {
    setIsGeneratingSignal(true);
    setSignalError(null);
    try {
      const data = await apiFetch('/api/ai/predict', { method: 'POST' });
      setAiSignal(data.prediction);
      triggerHaptic('success');
    } catch (err: any) {
      setSignalError(err.message || 'VIP AI Signal unavailable');
      triggerHaptic('error');
    } finally {
      setIsGeneratingSignal(false);
    }
  };

  // Apply AI Signal to Trade Panel in one click
  const applySignal = () => {
    if (!aiSignal) return;
    if (aiSignal.prediction === 'UP') {
      handleOpenTrade('UP');
    } else {
      handleOpenTrade('DOWN');
    }
  };

  const expiries = [
    { label: '5s', seconds: 5 },
    { label: '10s', seconds: 10 },
    { label: '30s', seconds: 30 },
    { label: '1m', seconds: 60 },
    { label: '2m', seconds: 120 },
    { label: '5m', seconds: 300 },
  ];

  const presets = [100, 500, 1000, 5000, 25000];

  const activeTrades = userTrades.filter((t) => t.status === 'OPEN');
  const closedTrades = userTrades.filter((t) => t.status !== 'OPEN');

  // Profit calculation for display
  const potentialProfit = Math.floor(amountXC * (selectedAsset.payoutPercent / 100));

  return (
    <div className="max-w-md mx-auto py-2.5 px-3 flex flex-col gap-2.5 pb-24 select-none">
      {/* 1. QUOTEX ASSET SELECTOR HEADER */}
      <div className="bg-zinc-950/90 border border-white/10 rounded-2xl p-2.5 backdrop-blur-md flex items-center justify-between relative shadow-lg">
        {/* Asset dropdown button */}
        <div className="relative">
          <button
            onClick={() => setShowAssetDropdown(!showAssetDropdown)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 transition-colors"
          >
            <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xs font-black text-amber-300">
              QX
            </div>
            <div className="text-left">
              <span className="text-xs font-black text-white block leading-tight">
                {selectedAsset.symbol}
              </span>
              <span className="text-[9px] text-emerald-400 font-mono font-bold">
                +{selectedAsset.payoutPercent}% PAYOUT
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 ml-1" />
          </button>

          {/* Asset Dropdown Menu */}
          {showAssetDropdown && (
            <div className="absolute top-full left-0 mt-1.5 w-56 bg-zinc-950 border border-white/15 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col p-1">
              {ASSETS.map((asset) => (
                <button
                  key={asset.symbol}
                  onClick={() => {
                    setSelectedAsset(asset);
                    setShowAssetDropdown(false);
                  }}
                  className={`flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                    selectedAsset.symbol === asset.symbol
                      ? 'bg-amber-500/20 text-amber-300 font-bold'
                      : 'hover:bg-zinc-900 text-zinc-300'
                  }`}
                >
                  <div>
                    <span className="block font-bold">{asset.symbol}</span>
                    <span className="text-[10px] text-zinc-500">{asset.name}</span>
                  </div>
                  <span className="text-emerald-400 font-mono font-bold text-[11px]">
                    +{asset.payoutPercent}%
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live Quotex Ticking Price */}
        <div className="text-right">
          <span className="text-[9px] uppercase font-bold text-zinc-500 block font-mono">
            LIVE RATE
          </span>
          <span className="text-lg font-mono font-black text-amber-300 tracking-tight">
            ${selectedAsset.symbol.includes('BTC')
              ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
              : selectedAsset.symbol.includes('EUR')
              ? currentPrice.toFixed(4)
              : currentPrice.toFixed(2)}
          </span>
        </div>

        {/* Sound toggle */}
        <button
          onClick={() => setIsMuted(audioSynth.toggleMute())}
          className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 transition-colors ml-1"
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
        </button>
      </div>

      {/* 2. CHART TOOLBAR & SENTIMENT INDICATOR */}
      <div className="flex items-center justify-between bg-zinc-950/70 border border-white/5 rounded-xl px-2.5 py-1 text-xs">
        {/* Chart type & timeframes */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setChartType(chartType === 'candles' ? 'area' : 'candles')}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white font-mono text-[10px] border border-white/10"
          >
            {chartType === 'candles' ? '🕯️ Candles' : '📈 Line'}
          </button>

          <button
            onClick={() => setShowIndicators(!showIndicators)}
            className={`px-2 py-0.5 rounded-lg font-mono text-[10px] border transition-colors ${
              showIndicators
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-zinc-900 text-zinc-400 border-white/10'
            }`}
          >
            MA (7)
          </button>
        </div>

        {/* Quotex Trader Sentiment Bar */}
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="text-emerald-400 font-bold">{sentimentCall}%</span>
          <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden flex border border-white/10">
            <div className="h-full bg-emerald-500" style={{ width: `${sentimentCall}%` }} />
            <div className="h-full bg-rose-500" style={{ width: `${100 - sentimentCall}%` }} />
          </div>
          <span className="text-rose-400 font-bold">{100 - sentimentCall}%</span>
        </div>
      </div>

      {/* 3. QUOTEX INTERACTIVE 60FPS CANDLESTICK CANVAS */}
      <div className="relative w-full h-52 bg-[#05070d] rounded-2xl border border-white/10 overflow-hidden shadow-inner">
        <canvas
          ref={canvasRef}
          width={400}
          height={208}
          className="w-full h-full block"
        />

        {/* Overlay notification toast */}
        {tradeNotification && (
          <div
            className={`absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 shadow-xl animate-bounce z-20 ${
              tradeNotification.type === 'win'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : tradeNotification.type === 'loss'
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{tradeNotification.message}</span>
          </div>
        )}
      </div>

      {/* 4. VIP AI TRADING BOT SIGNALS (QUOTEX AI SIGNALS) */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-amber-500/30 rounded-2xl p-2.5 shadow-md flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BrainCircuit className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white tracking-wide">
              Quotex VIP AI Signal Bot
            </span>
          </div>

          <button
            onClick={handleGenerateSignal}
            disabled={isGeneratingSignal}
            className="text-[11px] px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 transition-all flex items-center gap-1"
          >
            {isGeneratingSignal ? 'Analyzing...' : 'Get Signal'}
          </button>
        </div>

        {signalError && (
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center justify-between">
            <span>{signalError}</span>
            <button onClick={onOpenVip} className="underline font-bold text-amber-200">
              Upgrade VIP
            </button>
          </div>
        )}

        {aiSignal && (
          <div className="flex items-center justify-between bg-black/60 p-2 rounded-xl border border-white/10 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-lg font-bold text-xs ${
                  aiSignal.prediction === 'UP'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {aiSignal.prediction === 'UP' ? 'CALL (UP)' : 'PUT (DOWN)'}
              </span>
              <span className="text-amber-300 font-bold">{aiSignal.confidence}% Accuracy</span>
            </div>

            <button
              onClick={applySignal}
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-extrabold text-[10px] hover:bg-amber-400 transition-colors"
            >
              One-Click Apply
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 5. QUOTEX TRADE EXECUTION CONTROLS */}
      <div className="bg-zinc-950/90 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md flex flex-col gap-3 shadow-xl">
        {/* Expiry Selector */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase font-mono">
              EXPIRY TIME
            </span>
            <span className="text-[10px] text-amber-300 font-mono font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" /> {selectedExpiry} Seconds
            </span>
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {expiries.map((exp) => (
              <button
                key={exp.seconds}
                onClick={() => setSelectedExpiry(exp.seconds)}
                className={`py-1.5 rounded-xl text-xs font-mono font-bold border transition-colors ${
                  selectedExpiry === exp.seconds
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                    : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                {exp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Investment Amount */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1 font-semibold">
            <span className="text-zinc-400 font-mono text-[11px]">INVESTMENT (XC)</span>
            <span className="text-emerald-400 font-mono text-[11px]">
              Available: {wallet.xcBalance.toLocaleString()} XC
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAmountXC((prev) => Math.max(100, prev - 100))}
              className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/10 text-white font-bold text-base flex items-center justify-center hover:bg-zinc-800 active:scale-95"
            >
              -
            </button>
            <input
              type="number"
              value={amountXC}
              onChange={(e) => setAmountXC(Math.max(0, parseInt(e.target.value) || 0))}
              className="flex-1 h-10 bg-zinc-900/90 border border-white/10 rounded-xl px-2 font-mono font-bold text-center text-white text-base focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={() => setAmountXC((prev) => prev + 100)}
              className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/10 text-white font-bold text-base flex items-center justify-center hover:bg-zinc-800 active:scale-95"
            >
              +
            </button>
          </div>

          {/* Quick presets */}
          <div className="grid grid-cols-5 gap-1.5 mt-1.5">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setAmountXC(p)}
                className={`py-1 rounded-lg text-[10px] font-mono font-bold border ${
                  amountXC === p
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                {p >= 1000 ? `${p / 1000}K` : p}
              </button>
            ))}
          </div>
        </div>

        {/* Payout Calculation Display */}
        <div className="flex items-center justify-between px-2 py-1 bg-black/40 rounded-xl border border-white/5 text-xs font-mono">
          <span className="text-zinc-400">YOUR PROFIT (+{selectedAsset.payoutPercent}%):</span>
          <span className="text-emerald-400 font-extrabold text-sm">
            +{potentialProfit} XC ({amountXC + potentialProfit} XC)
          </span>
        </div>

        {/* Large Quotex CALL (Green) & PUT (Red) Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            disabled={isTrading || wallet.xcBalance < amountXC}
            onClick={() => handleOpenTrade('UP')}
            className={`py-3.5 rounded-2xl font-bold text-sm flex flex-col items-center justify-center transition-all ${
              wallet.xcBalance >= amountXC && !isTrading
                ? 'bg-gradient-to-r from-emerald-500 to-green-400 text-black font-black shadow-[0_4px_20px_rgba(34,197,94,0.4)] active:scale-[0.98]'
                : 'bg-zinc-900 text-zinc-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-5 h-5" />
              <span className="text-base tracking-wide">CALL (UP)</span>
            </div>
            <span className="text-[10px] font-mono font-extrabold text-black/80">
              +{potentialProfit} XC ({selectedExpiry}s)
            </span>
          </button>

          <button
            disabled={isTrading || wallet.xcBalance < amountXC}
            onClick={() => handleOpenTrade('DOWN')}
            className={`py-3.5 rounded-2xl font-bold text-sm flex flex-col items-center justify-center transition-all ${
              wallet.xcBalance >= amountXC && !isTrading
                ? 'bg-gradient-to-r from-rose-500 to-red-500 text-white font-black shadow-[0_4px_20px_rgba(244,63,94,0.4)] active:scale-[0.98]'
                : 'bg-zinc-900 text-zinc-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <TrendingDown className="w-5 h-5" />
              <span className="text-base tracking-wide">PUT (DOWN)</span>
            </div>
            <span className="text-[10px] font-mono font-extrabold text-white/80">
              +{potentialProfit} XC ({selectedExpiry}s)
            </span>
          </button>
        </div>
      </div>

      {/* 6. QUOTEX TRADES HISTORY (ACTIVE & SETTLED) */}
      <div className="bg-zinc-950/85 border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTradesTab('active')}
              className={`text-xs font-bold transition-colors ${
                tradesTab === 'active' ? 'text-amber-300' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Active Trades ({activeTrades.length})
            </button>
            <button
              onClick={() => setTradesTab('closed')}
              className={`text-xs font-bold transition-colors ${
                tradesTab === 'closed' ? 'text-amber-300' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Closed Trades ({closedTrades.length})
            </button>
          </div>

          <span className="text-[10px] text-zinc-500 font-mono">Real-time Settlement</span>
        </div>

        {tradesTab === 'active' ? (
          activeTrades.length === 0 ? (
            <div className="text-center py-4 text-xs text-zinc-500 font-mono">
              No active trades. Pick Call or Put above!
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto no-scrollbar">
              {activeTrades.map((t) => {
                const remaining = Math.max(0, Math.ceil((t.expiresAt - Date.now()) / 1000));
                const isWinning =
                  (t.direction === 'UP' && currentPrice > t.entryPrice) ||
                  (t.direction === 'DOWN' && currentPrice < t.entryPrice);

                return (
                  <div
                    key={t.tradeId}
                    className="bg-zinc-900/70 border border-white/5 p-2 rounded-xl flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          t.direction === 'UP'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {t.direction === 'UP' ? 'CALL' : 'PUT'}
                      </span>
                      <span className="text-white font-bold">{t.amountXC} XC</span>
                      <span className="text-zinc-500 text-[10px]">@{t.entryPrice.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold ${
                          isWinning ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isWinning ? 'In Money' : 'Out Money'}
                      </span>
                      <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                        {remaining}s
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : closedTrades.length === 0 ? (
          <div className="text-center py-4 text-xs text-zinc-500 font-mono">No closed trades yet</div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto no-scrollbar">
            {closedTrades.map((t) => (
              <div
                key={t.tradeId}
                className="bg-zinc-900/70 border border-white/5 p-2 rounded-xl flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                      t.direction === 'UP'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {t.direction === 'UP' ? 'CALL' : 'PUT'}
                  </span>
                  <span className="text-white font-bold">{t.amountXC} XC</span>
                </div>

                <div>
                  {t.outcome === 'WIN' ? (
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                      +{t.payout} XC (WIN)
                    </span>
                  ) : (
                    <span className="text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded">
                      -{t.amountXC} XC (LOSS)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
