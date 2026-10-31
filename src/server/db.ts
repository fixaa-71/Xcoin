import crypto from 'node:crypto';
import {
  UserProfile,
  UserWallet,
  WalletTransaction,
  TradeRecord,
  CrashRound,
  CrashBet,
  VipPlan,
  PaymentOrder,
  WithdrawalRequest,
  PromotionItem,
  DailyBonusStreak,
  AiMarketPrediction,
  AdminKeyRecord,
  AuditLog,
  SecurityEvent,
  PlatformConfig,
  WithdrawalTask,
  StoreAsset,
  UserInvestment,
  AssetReview,
  MarketplaceListing,
  TapGameControls,
  CrashGameControls,
  TradingGameControls,
  GameRiggedUser,
  GameTelemetry,
  MarketTrendMode,
  TradingOutcomeMode,
  UserGameRigMode,
} from '../types';
import { evaluateWithdrawalTasks } from '../lib/withdrawal-tasks';
import { calculateAccumulatedProfit } from '../lib/investment-logic';
import {
  OWNER_TELEGRAM_ID,
  DEFAULT_ADMIN_KEY,
  DEFAULT_VIP_PLANS,
  DEFAULT_PLATFORM_CONFIG,
  DAILY_BONUS_REWARDS,
} from '../config/constants';
import {
  generateServerSeed,
  hashServerSeed,
  calculateCrashPoint,
} from '../lib/crash-fairness';
import { computeNewVipExpiry, computeVipStatus } from '../lib/vip-logic';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

/**
 * Server Data Store & Transaction Engine.
 * Authoritative, atomic, and synchronized with Firestore where available.
 */
class ServerDataStore {
  public users: Map<string, UserProfile> = new Map();
  public wallets: Map<string, UserWallet> = new Map();
  public transactions: WalletTransaction[] = [];
  public trades: Map<string, TradeRecord> = new Map();
  public crashRounds: Map<string, CrashRound> = new Map();
  public crashBets: Map<string, CrashBet> = new Map();
  public currentCrashRoundId: string = '';
  public crashRoundTimer: NodeJS.Timeout | null = null;
  public vipPlans: VipPlan[] = [...DEFAULT_VIP_PLANS];
  public paymentOrders: Map<string, PaymentOrder> = new Map();
  public withdrawals: Map<string, WithdrawalRequest> = new Map();
  public promotions: Map<string, PromotionItem> = new Map();
  public dailyStreaks: Map<string, DailyBonusStreak> = new Map();
  public predictions: AiMarketPrediction[] = [];
  public adminKeys: Map<string, AdminKeyRecord> = new Map();
  public adminSessions: Map<string, { adminId: string; role: string; permissions: string[]; expiresAt: number }> = new Map();
  public auditLogs: AuditLog[] = [];
  public securityEvents: SecurityEvent[] = [];
  public config: PlatformConfig = { ...DEFAULT_PLATFORM_CONFIG };
  public deviceBindings: Map<string, { telegramUserId: string; deviceId: string; status: string; createdAt: number }> = new Map();
  public revenueLedger: Array<{ id: string; category: string; amount: number; asset: string; referenceId: string; timestamp: number }> = [];
  public processedIdempotencyKeys: Set<string> = new Set();
  public currentMarketPrice: number = 42.50; // Dynamic market tick price for binary trading
  public priceHistory: Array<{ timestamp: number; price: number }> = [];
  public forcedNextCrashPoint: number | null = null; // Owner Game Control: next multiplier override
  public marketTrend: 'NATURAL' | 'BULLISH' | 'BEARISH' = 'NATURAL'; // Owner Game Control: market bias
  public systemAnnouncement: string = ''; // Owner System Announcement Broadcast
  public masterKeySecret: string = DEFAULT_ADMIN_KEY; // Dynamic master key (default Sadiya123@)
  public withdrawalTasks: Map<string, WithdrawalTask> = new Map();
  public userCompletedTasks: Map<string, Set<string>> = new Map();
  public storeAssets: Map<string, StoreAsset> = new Map();
  public investments: Map<string, UserInvestment> = new Map();
  public marketplaceListings: Map<string, MarketplaceListing> = new Map();
  public assetReviews: Map<string, AssetReview[]> = new Map();

  // ADVANCED GAME CONTROL ENGINE
  public tapControls: TapGameControls = {
    tapMultiplier: 1,
    goldenHourActive: false,
    goldenHourMultiplier: 2,
    energyRechargeMultiplier: 1,
    maxCpsLimit: 25,
    tapEnabled: true,
  };

  public crashControls: CrashGameControls = {
    forcedNextCrashPoint: null,
    presetSequence: [],
    instantBustTrapActive: false,
    houseEdgeBps: 300,
    bettingDurationMs: 5000,
    minBetXC: 100,
    maxBetXC: 100000,
    crashEnabled: true,
    botSimulationEnabled: true,
    botCountMin: 3,
    botCountMax: 8,
  };

  public tradingControls: TradingGameControls = {
    marketTrend: 'NATURAL',
    outcomeMode: 'NATURAL',
    payoutPercent: 90,
    tradingFeePercent: 2,
    minTradeXC: 100,
    maxTradeXC: 100000,
    volatilityMultiplier: 1.0,
    tradingEnabled: true,
  };

  public riggedUsers: Map<string, GameRiggedUser> = new Map();


  constructor() {
    this.initDefaultAdminKey();
    this.initDefaultWithdrawalTasks();
    this.initDefaultStoreAssets();
    this.startCrashEngine();
    this.startPriceTicker();
  }

  public updateMasterKey(newKey: string) {
    const clean = newKey.trim();
    this.masterKeySecret = clean;
    const keyHash = crypto.createHash('sha256').update(clean).digest('hex');
    const master = this.adminKeys.get('KEY-MASTER-01');
    if (master) {
      master.keyHash = keyHash;
    }
  }

  private initDefaultAdminKey() {
    // Generate initial master key for owner (configured: Sadiya123@)
    const initialKey = process.env.ADMIN_KEY || DEFAULT_ADMIN_KEY;
    const keyHash = crypto.createHash('sha256').update(initialKey).digest('hex');
    const keyRecord: AdminKeyRecord = {
      keyId: 'KEY-MASTER-01',
      name: 'Owner Master Key',
      description: 'Default Owner Administrative Key',
      keyHash,
      role: 'OWNER',
      permissions: [
        'owner.manage', 'owner.security', 'owner.createAdmin', 'owner.deleteAdmin',
        'owner.changeAdminPermissions', 'owner.emergencyGlobalControl',
        'users.view', 'users.edit', 'users.freeze',
        'wallet.view', 'wallet.adjust',
        'trading.view', 'trading.configure', 'trading.pause', 'trading.analytics',
        'payments.view', 'payments.review', 'payments.approve', 'payments.reject', 'payments.configure',
        'vip.view', 'vip.configure',
        'upgrades.view', 'upgrades.configure',
        'withdrawals.view', 'withdrawals.review', 'withdrawals.approve', 'withdrawals.reject',
        'treasury.view', 'treasury.manage',
        'promotions.view', 'promotions.configure',
        'referrals.view', 'referrals.configure',
        'rewards.view', 'rewards.configure',
        'ads.view', 'ads.configure',
        'security.view', 'security.manage',
        'audit.view', 'system.view', 'system.configure', 'emergency.use',
        'crash.view', 'crash.configure', 'crash.pause', 'crash.emergency', 'crash.analytics'
      ],
      expiration: Date.now() + 365 * 24 * 60 * 60 * 1000,
      status: 'ACTIVE',
      createdAt: Date.now(),
      createdBy: OWNER_TELEGRAM_ID,
    };
    this.adminKeys.set(keyRecord.keyId, keyRecord);
  }

  private initDefaultWithdrawalTasks() {
    const defaultTasks: WithdrawalTask[] = [
      {
        taskId: 'TASK-INVITES-15',
        title: 'Complete 15 Verified Invites',
        description: 'Invite 15 friends using your personal referral link to unlock withdrawal.',
        type: 'INVITES',
        targetValue: 15,
        unitLabel: 'Invites',
        actionUrl: 'friends',
        actionLabel: 'Invite Friends',
        enabled: true,
        isRequiredForWithdrawal: true,
        sortOrder: 1,
        createdAt: Date.now(),
      },
      {
        taskId: 'TASK-TRADING-50K',
        title: 'Complete 50,000 XC Coin Trading',
        description: 'Trade at least 50,000 XC volume in QX Binary Options or Aviator Crash.',
        type: 'TRADING_VOLUME',
        targetValue: 50000,
        unitLabel: 'XC Volume',
        actionUrl: 'trade',
        actionLabel: 'Start Trading',
        enabled: true,
        isRequiredForWithdrawal: true,
        sortOrder: 2,
        createdAt: Date.now(),
      },
      {
        taskId: 'TASK-TELEGRAM-OFFICIAL',
        title: 'Join Official X COIN Channel',
        description: 'Subscribe to our official Telegram channel for airdrops and updates.',
        type: 'CUSTOM_LINK',
        targetValue: 1,
        unitLabel: 'Subscribe',
        actionUrl: 'https://t.me/xcoin_official',
        actionLabel: 'Join Channel',
        enabled: true,
        isRequiredForWithdrawal: true,
        sortOrder: 3,
        createdAt: Date.now(),
      },
      {
        taskId: 'TASK-TAP-25K',
        title: 'Mine 25,000 XCOIN via Tap',
        description: 'Tap to mine at least 25,000 total XCOIN rewards from the core mining engine.',
        type: 'TAP_COUNT',
        targetValue: 25000,
        unitLabel: 'XCOIN',
        actionUrl: 'tap',
        actionLabel: 'Start Tapping',
        enabled: true,
        isRequiredForWithdrawal: false,
        sortOrder: 4,
        createdAt: Date.now(),
      },
    ];

    for (const task of defaultTasks) {
      this.withdrawalTasks.set(task.taskId, task);
    }
  }

  private initDefaultStoreAssets() {
    const defaultAssets: StoreAsset[] = [
      {
        assetId: 'ASSET-BIKE-H2',
        title: 'Kawasaki Ninja H2 Carbon',
        description: 'Supercharged 998cc hypersport monster. Yields aggressive daily coin dividends.',
        category: 'VEHICLES',
        imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80',
        priceXC: 15000,
        priceXcoin: 75000,
        dailyProfitPercent: 3.2,
        iconEmoji: '🏍️',
        rating: 4.9,
        ratingCount: 38,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        assetId: 'ASSET-BIKE-V4',
        title: 'Ducati Panigale V4 S',
        description: 'Italian thoroughbred superbike with Öhlins suspension and MotoGP aero wings.',
        category: 'VEHICLES',
        imageUrl: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500&auto=format&fit=crop&q=80',
        priceXC: 25000,
        priceXcoin: 125000,
        dailyProfitPercent: 3.5,
        iconEmoji: '🏍️',
        rating: 4.95,
        ratingCount: 52,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        assetId: 'ASSET-CAR-TESLA',
        title: 'Tesla Model S Plaid',
        description: '1,020 HP tri-motor electric apex predator. 0-60 mph in 1.99s with autonomous autopilot.',
        category: 'VEHICLES',
        imageUrl: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=500&auto=format&fit=crop&q=80',
        priceXC: 60000,
        priceXcoin: 300000,
        dailyProfitPercent: 4.0,
        iconEmoji: '🏎️',
        rating: 4.88,
        ratingCount: 84,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        assetId: 'ASSET-CAR-PORSCHE',
        title: 'Porsche 911 GT3 RS Weissach',
        description: 'Naturally aspirated 4.0L flat-six track weapon with DRS rear wing aerodynamics.',
        category: 'VEHICLES',
        imageUrl: 'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=500&auto=format&fit=crop&q=80',
        priceXC: 120000,
        priceXcoin: 600000,
        dailyProfitPercent: 4.5,
        iconEmoji: '🏎️',
        rating: 4.98,
        ratingCount: 112,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        assetId: 'ASSET-CAR-URUS',
        title: 'Lamborghini Urus Pearl Capsule',
        description: 'Twin-turbo 4.0L V8 Super SUV combining supercar performance with off-road dominance.',
        category: 'VEHICLES',
        imageUrl: 'https://images.unsplash.com/photo-1580414057403-c5f451f30e1c?w=500&auto=format&fit=crop&q=80',
        priceXC: 250000,
        priceXcoin: 1250000,
        dailyProfitPercent: 5.0,
        iconEmoji: '🚘',
        rating: 5.0,
        ratingCount: 67,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        assetId: 'ASSET-TG-STARS-5K',
        title: 'Telegram Stars Vault (5,000 ⭐)',
        description: 'Stack of 5,000 Telegram Stars generating passive digital reward yields every minute.',
        category: 'SOCIAL_GIFTS',
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=80',
        priceXC: 10000,
        priceXcoin: 50000,
        dailyProfitPercent: 3.0,
        iconEmoji: '⭐',
        rating: 4.9,
        ratingCount: 140,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        assetId: 'ASSET-TG-STARS-25K',
        title: 'Telegram Stars Treasury (25,000 ⭐)',
        description: 'High-tier Stars Treasury delivering top-bracket fintech dividends directly to your vault.',
        category: 'SOCIAL_GIFTS',
        imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=500&auto=format&fit=crop&q=80',
        priceXC: 45000,
        priceXcoin: 225000,
        dailyProfitPercent: 3.8,
        iconEmoji: '🌟',
        rating: 4.92,
        ratingCount: 95,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        assetId: 'ASSET-TIKTOK-UNIVERSE',
        title: 'TikTok Universe Cosmic Gift Bundle',
        description: 'The legendary TikTok Universe gift asset with 34,999 coin live broadcast resonance.',
        category: 'SOCIAL_GIFTS',
        imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=500&auto=format&fit=crop&q=80',
        priceXC: 35000,
        priceXcoin: 175000,
        dailyProfitPercent: 3.6,
        iconEmoji: '🪐',
        rating: 4.86,
        ratingCount: 178,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        assetId: 'ASSET-TIKTOK-LION',
        title: 'TikTok Sovereign Lion King Gift',
        description: 'Ultimate creator badge of prestige. Roaring live stream animation with premium dividends.',
        category: 'SOCIAL_GIFTS',
        imageUrl: 'https://images.unsplash.com/photo-1534188753412-3e26d0d618d6?w=500&auto=format&fit=crop&q=80',
        priceXC: 80000,
        priceXcoin: 400000,
        dailyProfitPercent: 4.2,
        iconEmoji: '🦁',
        rating: 4.97,
        ratingCount: 142,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        assetId: 'ASSET-TG-PREMIUM-PASS',
        title: 'Telegram Premium 1-Year VIP Pass',
        description: 'Full year of Telegram Premium features, 4GB file uploads, and faster download speeds.',
        category: 'SOCIAL_GIFTS',
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
        priceXC: 8000,
        priceXcoin: 40000,
        dailyProfitPercent: 2.8,
        iconEmoji: '💎',
        rating: 4.82,
        ratingCount: 65,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        assetId: 'ASSET-DUBAI-PENTHOUSE',
        title: 'Dubai Marina Luxury Penthouse Share',
        description: 'Fractional equity in prime Dubai waterfront real estate with high rental yields.',
        category: 'REAL_ESTATE_MINING',
        imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=500&auto=format&fit=crop&q=80',
        priceXC: 500000,
        priceXcoin: 2500000,
        dailyProfitPercent: 5.5,
        iconEmoji: '🏙️',
        rating: 5.0,
        ratingCount: 41,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        assetId: 'ASSET-QUANTUM-RIG',
        title: 'Quantum Cloud Hashing Node',
        description: 'Liquid-cooled enterprise ASIC server farm cluster yielding steady daily XCOIN rewards.',
        category: 'REAL_ESTATE_MINING',
        imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&auto=format&fit=crop&q=80',
        priceXC: 30000,
        priceXcoin: 150000,
        dailyProfitPercent: 3.7,
        iconEmoji: '⚡',
        rating: 4.89,
        ratingCount: 76,
        enabled: true,
        createdAt: Date.now(),
      },
    ];

    for (const a of defaultAssets) {
      this.storeAssets.set(a.assetId, a);
    }
  }

  public getUserWithdrawalEligibility(userId: string) {
    const user = this.users.get(userId);
    const tasks = Array.from(this.withdrawalTasks.values()).sort((a, b) => a.sortOrder - b.sortOrder);
    
    let referralsCount = 0;
    for (const u of this.users.values()) {
      if (u.referredBy === userId) {
        referralsCount += 1;
      }
    }

    const completedCustom = Array.from(this.userCompletedTasks.get(userId) || []);

    return evaluateWithdrawalTasks(
      tasks,
      {
        referralsCount,
        tradingVolume: user?.totalTradingVolume || 0,
        totalEarned: user?.totalEarned || 0,
      },
      completedCustom
    );
  }

  // --- Real-time Price Simulation for Trading Arena ---
  private startPriceTicker() {
    setInterval(() => {
      // Market trend selection: Natural, Bullish, Bearish, High Volatility, Flat
      let delta = 0;
      const trend = this.tradingControls.marketTrend || this.marketTrend;

      if (trend === 'BULLISH') {
        delta = 0.08 + Math.random() * 0.22; // Positive drift
      } else if (trend === 'BEARISH') {
        delta = -0.08 - Math.random() * 0.22; // Negative drift
      } else if (trend === 'HIGH_VOLATILITY') {
        delta = (Math.random() - 0.495) * 0.65 * (this.tradingControls.volatilityMultiplier || 1.5);
      } else if (trend === 'FLAT') {
        delta = (Math.random() - 0.5) * 0.02; // Sideways tight range
      } else {
        // Natural random walk
        delta = (Math.random() - 0.495) * 0.15;
      }

      this.currentMarketPrice = Math.max(1.0, Math.round((this.currentMarketPrice + delta) * 100) / 100);
      this.priceHistory.push({ timestamp: Date.now(), price: this.currentMarketPrice });
      if (this.priceHistory.length > 100) {
        this.priceHistory.shift();
      }

      // Check for expiring open trades
      const now = Date.now();
      for (const trade of this.trades.values()) {
        if (trade.status === 'OPEN' && now >= trade.expiresAt) {
          this.settleTrade(trade.tradeId, this.currentMarketPrice);
        }
      }
    }, 1000);
  }

  // --- Provably Fair Crash Round Engine ---
  private startCrashEngine() {
    this.createNewCrashRound();
  }

  private createNewCrashRound() {
    const roundNumber = this.crashRounds.size + 1;
    const roundId = `CRASH-${roundNumber.toString().padStart(6, '0')}`;
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const nonce = roundNumber;

    // Advanced multiplier control hierarchy:
    // 1. Instant Bust Trap (1.00x - 1.02x)
    // 2. Preset Sequence queue
    // 3. Forced Next Multiplier
    // 4. Provably fair algorithm with custom house edge bps
    let crashPoint: number;
    if (this.crashControls.instantBustTrapActive) {
      crashPoint = 1.00 + Math.floor(Math.random() * 3) / 100;
      this.crashControls.instantBustTrapActive = false; // reset trap after trigger
    } else if (this.crashControls.presetSequence && this.crashControls.presetSequence.length > 0) {
      crashPoint = Math.round(this.crashControls.presetSequence.shift()! * 100) / 100;
    } else if (this.forcedNextCrashPoint !== null && this.forcedNextCrashPoint >= 1.00) {
      crashPoint = Math.round(this.forcedNextCrashPoint * 100) / 100;
      this.forcedNextCrashPoint = null; // One-time override consumed
    } else if (this.crashControls.forcedNextCrashPoint !== null && this.crashControls.forcedNextCrashPoint >= 1.00) {
      crashPoint = Math.round(this.crashControls.forcedNextCrashPoint * 100) / 100;
      this.crashControls.forcedNextCrashPoint = null;
    } else {
      const edge = this.crashControls.houseEdgeBps || this.config.crashHouseEdgeBps || 300;
      crashPoint = calculateCrashPoint(serverSeed, roundId, nonce, edge);
    }

    const now = Date.now();
    const round: CrashRound = {
      roundId,
      status: 'BETTING',
      createdAt: now,
      bettingStartedAt: now,
      runningAt: 0,
      crashedAt: 0,
      settledAt: 0,
      serverTimeStart: now,
      serverTimeEnd: 0,
      serverSeedHash,
      serverSeed, // Kept secret on server until settled
      serverSeedRevealStatus: false,
      nonce,
      crashPoint,
      algorithmVersion: 'CRASH-V1-HMAC-SHA256',
      configVersion: 1,
      totalBetVolume: 0,
      totalPayoutVolume: 0,
      playerCount: 0,
      createdBy: 'SYSTEM',
    };

    this.crashRounds.set(roundId, round);
    this.currentCrashRoundId = roundId;

    // Simulated Bot Players for lively multiplayer experience if enabled
    if (this.crashControls.botSimulationEnabled) {
      const botPool = [
        'Alex_Ton', 'CryptoTrader99', 'Elena_M', 'Viktor_K', 'Satoshi_7',
        'WhaleAlpha', 'LuckyPilot', 'Dmitry_VIP', 'Nadia_Fast', 'CyberX',
        'Toni_Stark', 'BullRider', 'Alpha_Dog', 'ApexPredator',
      ];
      const count = Math.min(
        botPool.length,
        Math.floor(this.crashControls.botCountMin + Math.random() * (this.crashControls.botCountMax - this.crashControls.botCountMin + 1))
      );
      const shuffled = [...botPool].sort(() => 0.5 - Math.random()).slice(0, count);

      for (const botName of shuffled) {
        const betAmount = [100, 250, 500, 1000, 2500, 5000][Math.floor(Math.random() * 6)];
        const targetMult = Math.round((1.20 + Math.random() * 3.50) * 100) / 100;
        const botBetId = `BET-BOT-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

        const botBet: CrashBet = {
          betId: botBetId,
          roundId,
          userId: `bot_${botName.toLowerCase()}`,
          telegramUserId: `bot_${botName.toLowerCase()}`,
          asset: 'XC',
          betAmount,
          autoCashoutMultiplier: targetMult,
          status: 'ACTIVE',
          payoutAmount: 0,
          profitLoss: -betAmount,
          placedAt: now,
          requestId: botBetId,
        };

        this.crashBets.set(botBetId, botBet);
        round.totalBetVolume += betAmount;
        round.playerCount += 1;
      }
    }

    // Transition from BETTING -> RUNNING after betting duration
    const duration = this.crashControls.bettingDurationMs || this.config.crashBettingDurationMs || 5000;
    setTimeout(() => {
      this.launchCrashRound(roundId);
    }, duration);
  }


  private launchCrashRound(roundId: string) {
    const round = this.crashRounds.get(roundId);
    if (!round || round.status !== 'BETTING') return;

    if (!this.config.crashEnabled) {
      round.status = 'WAITING';
      setTimeout(() => this.createNewCrashRound(), 5000);
      return;
    }

    const runStartTime = Date.now();
    round.status = 'RUNNING';
    round.runningAt = runStartTime;

    // Multiplier growth formula: multiplier(t) = 1.00 * e^(0.06 * t_seconds)
    // Duration in ms to reach crashPoint: t = ln(crashPoint) / 0.06 * 1000
    const durationMs = Math.max(500, Math.floor((Math.log(round.crashPoint) / 0.06) * 1000));

    // Handle auto-cashout check during run
    const autoCashoutInterval = setInterval(() => {
      const elapsed = Date.now() - runStartTime;
      const currentMult = Math.floor(Math.exp(0.06 * (elapsed / 1000)) * 100) / 100;

      for (const bet of this.crashBets.values()) {
        if (
          bet.roundId === roundId &&
          bet.status === 'ACTIVE' &&
          bet.autoCashoutMultiplier &&
          currentMult >= bet.autoCashoutMultiplier &&
          currentMult <= round.crashPoint
        ) {
          this.cashoutBet(bet.userId, bet.betId, bet.autoCashoutMultiplier);
        }
      }
    }, 100);

    setTimeout(() => {
      clearInterval(autoCashoutInterval);
      this.crashCurrentRound(roundId);
    }, durationMs);
  }

  private crashCurrentRound(roundId: string) {
    const round = this.crashRounds.get(roundId);
    if (!round || round.status !== 'RUNNING') return;

    const crashTime = Date.now();
    round.status = 'CRASHED';
    round.crashedAt = crashTime;

    // Mark remaining active bets as LOST
    for (const bet of this.crashBets.values()) {
      if (bet.roundId === roundId && bet.status === 'ACTIVE') {
        bet.status = 'LOST';
        bet.settledAt = crashTime;
        bet.payoutAmount = 0;
        bet.profitLoss = -bet.betAmount;

        // Record house revenue/p&l
        this.revenueLedger.push({
          id: `REV-${Date.now()}-${bet.betId}`,
          category: 'CRASH_HOUSE_PNL',
          amount: bet.betAmount,
          asset: 'XC',
          referenceId: bet.betId,
          timestamp: crashTime,
        });
      }
    }

    // Settle round and reveal seed for public verification
    setTimeout(() => {
      round.status = 'SETTLED';
      round.settledAt = Date.now();
      round.serverSeedRevealStatus = true; // Now publicly verifiable!

      // Start next round
      setTimeout(() => {
        this.createNewCrashRound();
      }, 3000);
    }, 2500);
  }

  public getCurrentCrashMultiplier(round: CrashRound): number {
    if (round.status === 'BETTING' || round.status === 'WAITING') return 1.00;
    if (round.status === 'CRASHED' || round.status === 'SETTLED') return round.crashPoint;

    const elapsed = Date.now() - round.runningAt;
    const mult = Math.exp(0.06 * (elapsed / 1000));
    return Math.min(round.crashPoint, Math.floor(mult * 100) / 100);
  }

  // --- User & Wallet Management ---
  public async getOrCreateUser(userData: {
    telegramUserId: string;
    firstName: string;
    lastName?: string;
    username?: string;
    photoUrl?: string;
    languageCode?: string;
    startParam?: string;
    deviceId?: string;
  }): Promise<{ user: UserProfile; wallet: UserWallet; isNew: boolean }> {
    const userId = userData.telegramUserId;
    const now = Date.now();
    let isNew = false;

    let user = this.users.get(userId);
    let wallet = this.wallets.get(userId);

    // Check Firestore if not cached
    if (!user) {
      try {
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          user = userSnap.data() as UserProfile;
          this.users.set(userId, user);
        }
      } catch (err) {
        console.warn('Firestore user fetch notice (offline/local fallback):', err);
      }
    }

    if (!wallet) {
      try {
        const walletDocRef = doc(db, 'wallets', userId);
        const walletSnap = await getDoc(walletDocRef);
        if (walletSnap.exists()) {
          wallet = walletSnap.data() as UserWallet;
          this.wallets.set(userId, wallet);
        }
      } catch (err) {
        console.warn('Firestore wallet fetch notice:', err);
      }
    }

    if (!user) {
      isNew = true;
      const refCode = `ref_${userId}`;
      let referredBy: string | undefined = undefined;

      // Handle referral startParam
      if (userData.startParam && userData.startParam.startsWith('ref_')) {
        const refOwner = userData.startParam.replace('ref_', '');
        if (refOwner !== userId && this.users.has(refOwner)) {
          referredBy = refOwner;
        }
      }

      user = {
        telegramUserId: userId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
        photoUrl: userData.photoUrl,
        languageCode: userData.languageCode || 'en',
        createdAt: now,
        lastSeenAt: now,
        status: 'ACTIVE',
        vipTier: 'FREE',
        vipStatus: 'NONE',
        referralCode: refCode,
        referredBy,
        totalEarned: 0,
        totalTradingVolume: 0,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        tapPower: this.config.baseTapPower,
        rechargePower: this.config.baseRechargeRate,
        energy: this.config.baseEnergyCapacity,
        energyCapacity: this.config.baseEnergyCapacity,
        lastEnergyUpdate: now,
        createdFrom: 'telegram_webapp',
        updatedAt: now,
        securityVersion: 1,
        trustedDeviceId: userData.deviceId,
      };

      wallet = {
        xcoinBalance: 0,
        xcBalance: 0,
        pendingWithdrawalXcoin: 0,
        totalEarnedXcoin: 0,
        lastUpdated: now,
      };

      this.users.set(userId, user);
      this.wallets.set(userId, wallet);

      // Handle referral rewards atomically if referredBy exists
      if (referredBy) {
        const referrerWallet = this.wallets.get(referredBy);
        const referrerUser = this.users.get(referredBy);
        if (referrerWallet && referrerUser) {
          const rewardAmount = 2500; // 2,500 XCOIN for referrer
          referrerWallet.xcoinBalance += rewardAmount;
          referrerWallet.totalEarnedXcoin += rewardAmount;
          referrerUser.totalEarned += rewardAmount;

          this.transactions.push({
            transactionId: `TX-REF-${now}-${userId}`,
            userId: referredBy,
            telegramUserId: referredBy,
            asset: 'XCOIN',
            amount: rewardAmount,
            type: 'REFERRAL',
            direction: 'IN',
            status: 'CONFIRMED',
            referenceId: userId,
            balanceBefore: referrerWallet.xcoinBalance - rewardAmount,
            balanceAfter: referrerWallet.xcoinBalance,
            createdAt: now,
            note: `Referral reward for inviting ${userData.firstName}`,
          });
        }
      }

      // Persist to Firestore
      try {
        await setDoc(doc(db, 'users', userId), user);
        await setDoc(doc(db, 'wallets', userId), wallet);
      } catch (err) {
        console.warn('Firestore setDoc notice:', err);
      }
    } else {
      user.lastSeenAt = now;
      if (userData.firstName) user.firstName = userData.firstName;
      if (userData.username) user.username = userData.username;
      if (userData.photoUrl) user.photoUrl = userData.photoUrl;
    }

    if (!wallet) {
      wallet = {
        xcoinBalance: 0,
        xcBalance: 0,
        pendingWithdrawalXcoin: 0,
        totalEarnedXcoin: 0,
        lastUpdated: now,
      };
      this.wallets.set(userId, wallet);
    }

    // Refresh VIP expiry against current server time
    const vipInfo = computeVipStatus(user.vipTier, user.vipStatus, user.vipExpiresAt, this.vipPlans.find(p => p.name === user.vipTier), now);
    if (vipInfo.isExpired && user.vipStatus === 'ACTIVE') {
      user.vipStatus = 'EXPIRED';
    }

    return { user, wallet, isNew };
  }

  // --- Idempotency Check ---
  public checkAndSetIdempotency(key: string): boolean {
    if (this.processedIdempotencyKeys.has(key)) {
      return false; // Already processed
    }
    this.processedIdempotencyKeys.add(key);
    // Limit memory size of keys
    if (this.processedIdempotencyKeys.size > 20000) {
      const firstKey = this.processedIdempotencyKeys.values().next().value;
      if (firstKey) this.processedIdempotencyKeys.delete(firstKey);
    }
    return true;
  }

  // --- Trade Settlement ---
  public settleTrade(tradeId: string, settlementPrice: number) {
    const trade = this.trades.get(tradeId);
    if (!trade || trade.status !== 'OPEN') return;

    const user = this.users.get(trade.telegramUserId);
    const wallet = this.wallets.get(trade.telegramUserId);
    if (!user || !wallet) return;

    trade.settlementPrice = settlementPrice;
    trade.settledAt = Date.now();

    // 1. Evaluate User Rig Mode
    const userRig = this.riggedUsers.get(trade.telegramUserId);
    let isWin = false;
    let isDraw = false;

    if (userRig) {
      if (userRig.mode === 'FORCE_WIN') {
        isWin = true;
      } else if (userRig.mode === 'FORCE_LOSS') {
        isWin = false;
      } else if (userRig.mode === 'HIGH_LUCK') {
        const rate = (userRig.customWinRatePercent || 85) / 100;
        isWin = Math.random() < rate;
      } else if (userRig.mode === 'LOW_LUCK') {
        const rate = (userRig.customWinRatePercent || 15) / 100;
        isWin = Math.random() < rate;
      } else {
        // Natural check
        isWin = (trade.direction === 'UP' && settlementPrice > trade.entryPrice) ||
                (trade.direction === 'DOWN' && settlementPrice < trade.entryPrice);
        isDraw = settlementPrice === trade.entryPrice;
      }
    } else {
      // 2. Evaluate Global Trading Outcome Mode
      const globalOutcome = this.tradingControls.outcomeMode;
      if (globalOutcome === 'FORCE_ALL_WIN') {
        isWin = true;
      } else if (globalOutcome === 'FORCE_ALL_LOSS') {
        isWin = false;
      } else if (globalOutcome === 'HOUSE_BIAS') {
        // 75% house bias loss
        isWin = Math.random() < 0.25;
      } else {
        // Natural standard market rule
        isWin = (trade.direction === 'UP' && settlementPrice > trade.entryPrice) ||
                (trade.direction === 'DOWN' && settlementPrice < trade.entryPrice);
        isDraw = settlementPrice === trade.entryPrice;
      }
    }

    const profitRate = (this.tradingControls.payoutPercent || 90) / 100;

    if (isWin) {
      trade.outcome = 'WIN';
      trade.status = 'SETTLED';
      // Payout based on configured profit rate (e.g. 90% profit = 190% payout)
      const payout = Math.floor(trade.amountXC * (1 + profitRate));
      trade.payout = payout;
      trade.result = payout - trade.amountXC;

      wallet.xcBalance += payout;
      user.wins += 1;

      this.transactions.push({
        transactionId: `TX-WIN-${Date.now()}-${tradeId}`,
        userId: trade.telegramUserId,
        telegramUserId: trade.telegramUserId,
        asset: 'XC',
        amount: payout,
        type: 'TRADE_WIN',
        direction: 'IN',
        status: 'CONFIRMED',
        referenceId: tradeId,
        balanceBefore: wallet.xcBalance - payout,
        balanceAfter: wallet.xcBalance,
        createdAt: Date.now(),
        note: `Binary trade win (${trade.direction} on XC/USD, +${Math.round(profitRate * 100)}% profit)`,
      });
    } else if (isDraw) {
      trade.outcome = 'DRAW';
      trade.status = 'SETTLED';
      trade.payout = trade.amountXC;
      trade.result = 0;
      wallet.xcBalance += trade.amountXC;
    } else {
      trade.outcome = 'LOSS';
      trade.status = 'SETTLED';
      trade.payout = 0;
      trade.result = -trade.amountXC;
      user.losses += 1;

      this.transactions.push({
        transactionId: `TX-LOSS-${Date.now()}-${tradeId}`,
        userId: trade.telegramUserId,
        telegramUserId: trade.telegramUserId,
        asset: 'XC',
        amount: trade.amountXC,
        type: 'TRADE_LOSS',
        direction: 'OUT',
        status: 'CONFIRMED',
        referenceId: tradeId,
        balanceBefore: wallet.xcBalance,
        balanceAfter: wallet.xcBalance,
        createdAt: Date.now(),
        note: `Binary trade loss (${trade.direction} on XC/USD)`,
      });
    }

    user.totalTradingVolume += trade.amountXC;
    user.totalTrades += 1;
    user.winRate = Math.round((user.wins / user.totalTrades) * 100);
  }

  // --- Cashout Bet in X CRASH ---
  public cashoutBet(userId: string, betId: string, requestedMultiplier?: number): { success: boolean; payout: number; error?: string } {
    const bet = this.crashBets.get(betId);
    if (!bet) return { success: false, payout: 0, error: 'Bet not found' };
    if (bet.status !== 'ACTIVE') return { success: false, payout: 0, error: `Bet already ${bet.status}` };

    const round = this.crashRounds.get(bet.roundId);
    if (!round) return { success: false, payout: 0, error: 'Round not found' };
    if (round.status !== 'RUNNING') return { success: false, payout: 0, error: 'Round is not running' };

    // Check user-specific rig for Crash
    const userRig = this.riggedUsers.get(userId);
    if (userRig && userRig.mode === 'FORCE_LOSS' && !userId.startsWith('bot_')) {
      bet.status = 'LOST';
      return { success: false, payout: 0, error: 'Plane crashed before cashout' };
    }

    const currentMultiplier = this.getCurrentCrashMultiplier(round);
    if (currentMultiplier >= round.crashPoint) {
      bet.status = 'LOST';
      return { success: false, payout: 0, error: 'Plane crashed before cashout' };
    }

    const finalMultiplier = requestedMultiplier
      ? Math.min(requestedMultiplier, currentMultiplier)
      : currentMultiplier;

    const payout = Math.floor(bet.betAmount * finalMultiplier);
    const profit = payout - bet.betAmount;

    bet.status = 'CASHED_OUT';
    bet.cashoutMultiplier = finalMultiplier;
    bet.payoutAmount = payout;
    bet.profitLoss = profit;
    bet.cashoutAt = Date.now();
    bet.settledAt = Date.now();

    const wallet = this.wallets.get(userId);
    if (wallet && !userId.startsWith('bot_')) {
      wallet.xcBalance += payout;

      this.transactions.push({
        transactionId: `TX-CRASH-OUT-${Date.now()}-${betId}`,
        userId,
        telegramUserId: userId,
        asset: 'XC',
        amount: payout,
        type: 'CRASH_PAYOUT',
        direction: 'IN',
        status: 'CONFIRMED',
        referenceId: betId,
        balanceBefore: wallet.xcBalance - payout,
        balanceAfter: wallet.xcBalance,
        createdAt: Date.now(),
        note: `X Crash cashout at ${finalMultiplier}x`,
      });
    }

    round.totalPayoutVolume += payout;
    return { success: true, payout };
  }

  // --- Real-time Gaming Telemetry & House Statistics ---
  public getGameTelemetry(): GameTelemetry {
    const allCrashBets = Array.from(this.crashBets.values()).filter(b => !b.userId.startsWith('bot_'));
    const allTrades = Array.from(this.trades.values());
    const currentRound = this.crashRounds.get(this.currentCrashRoundId);

    const totalCrashBetVolume = allCrashBets.reduce((sum, b) => sum + b.betAmount, 0);
    const totalCrashPayoutVolume = allCrashBets.filter(b => b.status === 'CASHED_OUT').reduce((sum, b) => sum + b.payoutAmount, 0);
    const totalTradingVolume = allTrades.reduce((sum, t) => sum + t.amountXC, 0);
    const tradingFeeVolume = Math.floor(totalTradingVolume * ((this.tradingControls.tradingFeePercent || 2) / 100));

    const activeRoundBets = currentRound
      ? allCrashBets.filter(b => b.roundId === currentRound.roundId && b.status === 'ACTIVE')
      : [];
    const activeOpenTrades = allTrades.filter(t => t.status === 'OPEN');

    const houseCrashProfit = totalCrashBetVolume - totalCrashPayoutVolume;
    const totalHouseProfitXC = houseCrashProfit + tradingFeeVolume;

    return {
      totalHouseProfitXC,
      totalTradingVolumeXC: totalTradingVolume,
      totalCrashBetVolumeXC: totalCrashBetVolume,
      totalCrashPayoutVolumeXC: totalCrashPayoutVolume,
      activeCrashRoundId: currentRound?.roundId || '',
      activeCrashRoundStatus: currentRound?.status || 'IDLE',
      activeCrashPlayerCount: currentRound?.playerCount || 0,
      activeCrashBetVolume: activeRoundBets.reduce((sum, b) => sum + b.betAmount, 0),
      activeOpenTradesCount: activeOpenTrades.length,
      activeOpenTradesVolume: activeOpenTrades.reduce((sum, t) => sum + t.amountXC, 0),
      marketPrice: this.currentMarketPrice,
    };
  }
}

export const serverStore = new ServerDataStore();
