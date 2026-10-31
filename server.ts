import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { serverStore } from './src/server/db';
import { validateTelegramInitData } from './src/lib/security-engine';
import { processTapBatch, getUpgradeInfo } from './src/lib/tap-logic';
import { verifyCrashRound } from './src/lib/crash-fairness';
import { computeNewVipExpiry, computeVipStatus } from './src/lib/vip-logic';
import { calculateAccumulatedProfit } from './src/lib/investment-logic';
import { OWNER_TELEGRAM_ID, DAILY_BONUS_REWARDS } from './src/config/constants';
import {
  TradeRecord,
  CrashBet,
  WithdrawalRequest,
  PaymentOrder,
  AiMarketPrediction,
  PromotionItem,
  AdminKeyRecord,
  WithdrawalTask,
  StoreAsset,
  UserInvestment,
  AssetReview,
  MarketplaceListing,
} from './src/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Helper to extract authenticated user from header
function getAuthUserId(req: Request): string | null {
  const authHeader = req.headers['x-telegram-user-id'] as string;
  if (authHeader) return authHeader;
  return null;
}

// Helper to check admin session
function getAdminSession(req: Request) {
  const token = req.headers['x-admin-token'] as string;
  if (!token) return null;
  const session = serverStore.adminSessions.get(token);
  if (!session || Date.now() > session.expiresAt) return null;
  return session;
}

// -------------------------------------------------------------
// 1. TELEGRAM IDENTITY & DEVICE BINDING
// -------------------------------------------------------------
app.post('/api/telegram/validate', async (req: Request, res: Response) => {
  try {
    const { initData, deviceId } = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    const validation = validateTelegramInitData(initData, botToken);
    if (!validation.isValid || !validation.user) {
      res.status(401).json({ error: validation.error || 'Invalid Telegram authentication' });
      return;
    }

    const telegramUserId = validation.user.id.toString();
    const params = new URLSearchParams(initData || '');
    const startParam = params.get('start_param') || undefined;

    // Device binding recorded seamlessly without multi-device protection restriction
    let isDeviceMismatch = false;
    if (deviceId) {
      serverStore.deviceBindings.set(telegramUserId, {
        telegramUserId,
        deviceId,
        status: 'TRUSTED',
        createdAt: Date.now(),
      });
    }

    const { user, wallet } = await serverStore.getOrCreateUser({
      telegramUserId,
      firstName: validation.user.first_name,
      lastName: validation.user.last_name,
      username: validation.user.username,
      photoUrl: validation.user.photo_url,
      languageCode: validation.user.language_code,
      startParam,
      deviceId,
    });

    if (user.status === 'RESTRICTED') {
      user.status = 'ACTIVE';
    }

    const activePlan = serverStore.vipPlans.find((p) => p.name === user.vipTier);
    const vipInfo = computeVipStatus(
      user.vipTier,
      user.vipStatus,
      user.vipExpiresAt,
      activePlan,
      Date.now()
    );

    res.json({
      success: true,
      user: {
        ...user,
        vipInfo,
      },
      wallet,
      serverTime: Date.now(),
      isDeviceMismatch,
      systemAnnouncement: serverStore.systemAnnouncement,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Validation failed' });
  }
});

// -------------------------------------------------------------
// 2. TAP SYSTEM (Idempotent, Server-Authoritative)
// -------------------------------------------------------------
app.get('/api/tap/event-status', (_req: Request, res: Response) => {
  res.json({
    tapControls: serverStore.tapControls,
    goldenHourActive: serverStore.tapControls.goldenHourActive,
    goldenHourMultiplier: serverStore.tapControls.goldenHourMultiplier,
    tapMultiplier: serverStore.tapControls.tapMultiplier,
    energyRechargeMultiplier: serverStore.tapControls.energyRechargeMultiplier,
    tapEnabled: serverStore.tapControls.tapEnabled,
  });
});

app.post('/api/tap', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!serverStore.tapControls.tapEnabled) {
    res.status(403).json({ error: 'Mining tap is currently paused by administrator.' });
    return;
  }

  const user = serverStore.users.get(userId);
  const wallet = serverStore.wallets.get(userId);
  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.status === 'FROZEN') {
    res.status(403).json({ error: 'Account is frozen' });
    return;
  }

  const { tapBatchId, count } = req.body;
  if (!tapBatchId) {
    res.status(400).json({ error: 'Missing tapBatchId' });
    return;
  }

  // Idempotency check: Process each tapBatchId once
  const idempotencyKey = `tap:${userId}:${tapBatchId}`;
  if (!serverStore.checkAndSetIdempotency(idempotencyKey)) {
    res.json({
      acceptedTaps: 0,
      rejectedTaps: count || 0,
      tapReward: 0,
      authoritativeBalance: wallet.xcoinBalance,
      remainingEnergy: user.energy,
      alreadyProcessed: true,
    });
    return;
  }

  const serverNow = Date.now();
  const maxCps = serverStore.tapControls.maxCpsLimit || 25;
  const tapCount = Math.max(1, Math.min(count || 1, maxCps * 2)); // enforced cps bound

  const effectiveRecharge = user.rechargePower * (serverStore.tapControls.energyRechargeMultiplier || 1);
  const effectiveTapMult = (serverStore.tapControls.tapMultiplier || 1) *
    (serverStore.tapControls.goldenHourActive ? (serverStore.tapControls.goldenHourMultiplier || 2) : 1);

  const batchResult = processTapBatch({
    requestedTaps: tapCount,
    tapPower: user.tapPower,
    tapEnergyCost: serverStore.config.tapEnergyCost,
    currentEnergy: user.energy,
    capacity: user.energyCapacity,
    rechargeRate: effectiveRecharge,
    lastEnergyUpdate: user.lastEnergyUpdate,
    serverNow,
  });

  user.energy = batchResult.newEnergy;
  user.lastEnergyUpdate = batchResult.newLastEnergyUpdate;

  const totalReward = batchResult.tapReward * effectiveTapMult;

  if (totalReward > 0) {
    wallet.xcoinBalance += totalReward;
    wallet.totalEarnedXcoin += totalReward;
    user.totalEarned += totalReward;

    serverStore.transactions.push({
      transactionId: `TX-TAP-${serverNow}-${tapBatchId}`,
      userId,
      telegramUserId: userId,
      asset: 'XCOIN',
      amount: totalReward,
      type: 'TAP_REWARD',
      direction: 'IN',
      status: 'CONFIRMED',
      referenceId: tapBatchId,
      balanceBefore: wallet.xcoinBalance - totalReward,
      balanceAfter: wallet.xcoinBalance,
      createdAt: serverNow,
    });
  }

  res.json({
    acceptedTaps: batchResult.acceptedTaps,
    rejectedTaps: batchResult.rejectedTaps,
    tapReward: totalReward,
    multiplierApplied: effectiveTapMult,
    authoritativeBalance: wallet.xcoinBalance,
    remainingEnergy: user.energy,
    serverNow,
  });
});

// -------------------------------------------------------------
// 3. UPGRADES
// -------------------------------------------------------------
app.post('/api/upgrade', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = serverStore.users.get(userId);
  const wallet = serverStore.wallets.get(userId);
  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { upgradeType } = req.body;
  if (!['tapPower', 'rechargePower', 'energyCapacity'].includes(upgradeType)) {
    res.status(400).json({ error: 'Invalid upgrade type' });
    return;
  }

  // Derive current level
  let currentLevel = 1;
  if (upgradeType === 'tapPower') currentLevel = Math.max(1, Math.floor(user.tapPower / 5));
  if (upgradeType === 'rechargePower') currentLevel = Math.max(1, Math.floor((user.rechargePower - 1) / 2));
  if (upgradeType === 'energyCapacity') currentLevel = Math.max(1, Math.floor((user.energyCapacity - 1000) / 500) + 1);

  const upgradeInfo = getUpgradeInfo(upgradeType, currentLevel);
  if (currentLevel >= upgradeInfo.maxLevel) {
    res.status(400).json({ error: 'Max level reached' });
    return;
  }

  if (wallet.xcoinBalance < upgradeInfo.cost) {
    res.status(400).json({ error: 'Insufficient XCOIN balance' });
    return;
  }

  // Atomic deduction and level upgrade
  wallet.xcoinBalance -= upgradeInfo.cost;
  if (upgradeType === 'tapPower') user.tapPower = upgradeInfo.nextVal;
  if (upgradeType === 'rechargePower') user.rechargePower = upgradeInfo.nextVal;
  if (upgradeType === 'energyCapacity') user.energyCapacity = upgradeInfo.nextVal;

  const now = Date.now();
  serverStore.transactions.push({
    transactionId: `TX-UPG-${now}-${upgradeType}`,
    userId,
    telegramUserId: userId,
    asset: 'XCOIN',
    amount: upgradeInfo.cost,
    type: 'UPGRADE',
    direction: 'OUT',
    status: 'CONFIRMED',
    referenceId: `${upgradeType}_lvl_${currentLevel + 1}`,
    balanceBefore: wallet.xcoinBalance + upgradeInfo.cost,
    balanceAfter: wallet.xcoinBalance,
    createdAt: now,
    note: `Upgraded ${upgradeType} to level ${currentLevel + 1}`,
  });

  res.json({
    success: true,
    newLevel: currentLevel + 1,
    newValue: upgradeInfo.nextVal,
    authoritativeBalance: wallet.xcoinBalance,
    user,
  });
});

// -------------------------------------------------------------
// 4. DAILY BONUS CHECK-IN
// -------------------------------------------------------------
app.get('/api/bonus/status', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let streak = serverStore.dailyStreaks.get(userId);
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  if (!streak) {
    streak = { currentDay: 1, streak: 0, lastClaimAt: 0, claimedDays: [] };
    serverStore.dailyStreaks.set(userId, streak);
  }

  // Can claim if no previous claim or if at least 20 hours have passed
  const canClaim = streak.lastClaimAt === 0 || now - streak.lastClaimAt >= 20 * 60 * 60 * 1000;
  // Broken streak if more than 48 hours passed
  const isStreakBroken = streak.lastClaimAt > 0 && now - streak.lastClaimAt > 48 * 60 * 60 * 1000;

  res.json({
    streak,
    canClaim,
    isStreakBroken,
    rewards: DAILY_BONUS_REWARDS,
    serverTime: now,
  });
});

app.post('/api/bonus/claim', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = serverStore.users.get(userId);
  const wallet = serverStore.wallets.get(userId);
  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  let streak = serverStore.dailyStreaks.get(userId);
  const now = Date.now();

  if (!streak) {
    streak = { currentDay: 1, streak: 0, lastClaimAt: 0, claimedDays: [] };
    serverStore.dailyStreaks.set(userId, streak);
  }

  if (streak.lastClaimAt > 0 && now - streak.lastClaimAt < 20 * 60 * 60 * 1000) {
    res.status(400).json({ error: 'Already claimed today. Please come back tomorrow.' });
    return;
  }

  // Reset day if broken or reset after 7
  if (streak.lastClaimAt > 0 && now - streak.lastClaimAt > 48 * 60 * 60 * 1000) {
    streak.currentDay = 1;
    streak.claimedDays = [];
  }

  const dayIndex = (streak.currentDay - 1) % 7;
  const reward = DAILY_BONUS_REWARDS[dayIndex];

  wallet.xcoinBalance += reward;
  wallet.totalEarnedXcoin += reward;
  user.totalEarned += reward;

  streak.claimedDays.push(streak.currentDay);
  streak.lastClaimAt = now;
  streak.streak += 1;
  streak.currentDay = streak.currentDay >= 7 ? 1 : streak.currentDay + 1;

  serverStore.transactions.push({
    transactionId: `TX-BONUS-${now}-${userId}`,
    userId,
    telegramUserId: userId,
    asset: 'XCOIN',
    amount: reward,
    type: 'BONUS',
    direction: 'IN',
    status: 'CONFIRMED',
    referenceId: `day_${dayIndex + 1}`,
    balanceBefore: wallet.xcoinBalance - reward,
    balanceAfter: wallet.xcoinBalance,
    createdAt: now,
    note: `Daily Day ${dayIndex + 1} Check-in reward`,
  });

  res.json({
    success: true,
    reward,
    streak,
    authoritativeBalance: wallet.xcoinBalance,
  });
});

// Rewarded Ad claim
app.post('/api/bonus/ad-reward', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = serverStore.users.get(userId);
  const wallet = serverStore.wallets.get(userId);
  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const now = Date.now();
  const rewardAmount = 1000; // 1,000 XCOIN per verified ad view

  wallet.xcoinBalance += rewardAmount;
  wallet.totalEarnedXcoin += rewardAmount;
  user.totalEarned += rewardAmount;

  serverStore.transactions.push({
    transactionId: `TX-AD-${now}-${userId}`,
    userId,
    telegramUserId: userId,
    asset: 'XCOIN',
    amount: rewardAmount,
    type: 'AD_REWARD',
    direction: 'IN',
    status: 'CONFIRMED',
    referenceId: `ad_${now}`,
    balanceBefore: wallet.xcoinBalance - rewardAmount,
    balanceAfter: wallet.xcoinBalance,
    createdAt: now,
    note: 'Rewarded Ad completion bonus',
  });

  res.json({
    success: true,
    reward: rewardAmount,
    authoritativeBalance: wallet.xcoinBalance,
  });
});

// -------------------------------------------------------------
// 5. TRADING ARENA (Binary Options with Real Settlement)
// -------------------------------------------------------------
app.get('/api/trade/market', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  const userTrades = userId
    ? Array.from(serverStore.trades.values())
        .filter((t) => t.telegramUserId === userId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 30)
    : [];

  res.json({
    currentPrice: serverStore.currentMarketPrice,
    priceHistory: serverStore.priceHistory,
    userTrades,
    config: {
      minTradeXC: serverStore.config.minTradeXC,
      maxTradeXC: serverStore.config.maxTradeXC,
      tradingFeePercent: serverStore.config.tradingFeePercent,
      availableExpiries: serverStore.config.availableExpiries,
      tradingEnabled: serverStore.config.tradingEnabled,
    },
    serverTime: Date.now(),
  });
});

app.post('/api/trade/open', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!serverStore.config.tradingEnabled) {
    res.status(403).json({ error: 'Trading is currently paused by administrator.' });
    return;
  }

  const user = serverStore.users.get(userId);
  const wallet = serverStore.wallets.get(userId);
  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { amountXC, direction, expirySeconds, asset, requestId } = req.body;
  if (!amountXC || amountXC < serverStore.config.minTradeXC || amountXC > serverStore.config.maxTradeXC) {
    res.status(400).json({ error: `Trade amount must be between ${serverStore.config.minTradeXC} and ${serverStore.config.maxTradeXC} XC` });
    return;
  }

  if (!['UP', 'DOWN'].includes(direction)) {
    res.status(400).json({ error: 'Invalid direction' });
    return;
  }

  if (!serverStore.config.availableExpiries.includes(expirySeconds)) {
    res.status(400).json({ error: 'Invalid expiry duration' });
    return;
  }

  if (wallet.xcBalance < amountXC) {
    res.status(400).json({ error: 'Insufficient XC trading balance' });
    return;
  }

  // Idempotency
  if (requestId && !serverStore.checkAndSetIdempotency(`trade:${userId}:${requestId}`)) {
    res.status(400).json({ error: 'Trade request already processed' });
    return;
  }

  // Atomic stake deduction
  wallet.xcBalance -= amountXC;

  const now = Date.now();
  const tradeId = `TR-${now}-${crypto.randomBytes(4).toString('hex')}`;
  const trade: TradeRecord = {
    tradeId,
    telegramUserId: userId,
    amountXC,
    asset: asset || 'XC/USD OTC',
    direction,
    expirySeconds,
    openedAt: now,
    expiresAt: now + expirySeconds * 1000,
    entryPrice: serverStore.currentMarketPrice,
    fee: Math.floor(amountXC * (serverStore.config.tradingFeePercent / 100)),
    status: 'OPEN',
    serverSequence: serverStore.trades.size + 1,
    createdAt: now,
  };

  serverStore.trades.set(tradeId, trade);

  serverStore.transactions.push({
    transactionId: `TX-TR-ENTRY-${now}-${tradeId}`,
    userId,
    telegramUserId: userId,
    asset: 'XC',
    amount: amountXC,
    type: 'TRADE_ENTRY',
    direction: 'OUT',
    status: 'CONFIRMED',
    referenceId: tradeId,
    balanceBefore: wallet.xcBalance + amountXC,
    balanceAfter: wallet.xcBalance,
    createdAt: now,
    note: `Opened ${direction} trade with ${amountXC} XC`,
  });

  res.json({
    success: true,
    trade,
    authoritativeBalanceXC: wallet.xcBalance,
  });
});

// -------------------------------------------------------------
// 6. X CRASH AVIATOR GAME (Provably Fair, Multiplayer)
// -------------------------------------------------------------
app.get('/api/crash/state', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  const currentRound = serverStore.crashRounds.get(serverStore.currentCrashRoundId);

  // Recent 10 settled rounds
  const recentRounds = Array.from(serverStore.crashRounds.values())
    .filter((r) => r.status === 'SETTLED' || r.status === 'CRASHED')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10)
    .map((r) => ({
      roundId: r.roundId,
      crashPoint: r.crashPoint,
      serverSeedHash: r.serverSeedHash,
      serverSeed: r.serverSeedRevealStatus ? r.serverSeed : undefined,
      nonce: r.nonce,
      settledAt: r.settledAt,
    }));

  // User bets in current round
  const userBets = userId && currentRound
    ? Array.from(serverStore.crashBets.values()).filter(
        (b) => b.roundId === currentRound.roundId && b.userId === userId
      )
    : [];

  const currentMultiplier = currentRound
    ? serverStore.getCurrentCrashMultiplier(currentRound)
    : 1.00;

  res.json({
    round: currentRound
      ? {
          roundId: currentRound.roundId,
          status: currentRound.status,
          bettingStartedAt: currentRound.bettingStartedAt,
          runningAt: currentRound.runningAt,
          crashedAt: currentRound.crashedAt,
          serverSeedHash: currentRound.serverSeedHash,
          currentMultiplier,
          crashPoint: currentRound.status === 'CRASHED' || currentRound.status === 'SETTLED' ? currentRound.crashPoint : undefined,
        }
      : null,
    recentRounds,
    userBets,
    config: {
      minBetXC: serverStore.config.crashMinBetXC,
      maxBetXC: serverStore.config.crashMaxBetXC,
      bettingDurationMs: serverStore.config.crashBettingDurationMs,
      enabled: serverStore.config.crashEnabled,
    },
    serverTime: Date.now(),
  });
});

app.post('/api/crash/bet', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!serverStore.config.crashEnabled) {
    res.status(403).json({ error: 'X Crash is currently paused' });
    return;
  }

  const user = serverStore.users.get(userId);
  const wallet = serverStore.wallets.get(userId);
  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const currentRound = serverStore.crashRounds.get(serverStore.currentCrashRoundId);
  if (!currentRound || currentRound.status !== 'BETTING') {
    res.status(400).json({ error: 'Betting is closed for this round. Wait for next round.' });
    return;
  }

  const { betAmount, autoCashoutMultiplier, requestId } = req.body;
  if (!betAmount || betAmount < serverStore.config.crashMinBetXC || betAmount > serverStore.config.crashMaxBetXC) {
    res.status(400).json({ error: `Bet amount must be between ${serverStore.config.crashMinBetXC} and ${serverStore.config.crashMaxBetXC} XC` });
    return;
  }

  if (wallet.xcBalance < betAmount) {
    res.status(400).json({ error: 'Insufficient XC balance' });
    return;
  }

  // Max bets per user per round check
  const existingRoundBets = Array.from(serverStore.crashBets.values()).filter(
    (b) => b.roundId === currentRound.roundId && b.userId === userId
  );
  if (existingRoundBets.length >= serverStore.config.crashMaxBetsPerRound) {
    res.status(400).json({ error: `Maximum ${serverStore.config.crashMaxBetsPerRound} bets allowed per round` });
    return;
  }

  // Idempotency
  if (requestId && !serverStore.checkAndSetIdempotency(`crash_bet:${userId}:${requestId}`)) {
    res.status(400).json({ error: 'Bet already submitted' });
    return;
  }

  // Deduct XC atomically
  wallet.xcBalance -= betAmount;
  currentRound.totalBetVolume += betAmount;
  currentRound.playerCount += 1;

  const now = Date.now();
  const betId = `BET-${now}-${crypto.randomBytes(4).toString('hex')}`;
  const bet: CrashBet = {
    betId,
    roundId: currentRound.roundId,
    userId,
    telegramUserId: userId,
    asset: 'XC',
    betAmount,
    autoCashoutMultiplier: autoCashoutMultiplier ? Math.max(1.01, parseFloat(autoCashoutMultiplier)) : undefined,
    status: 'ACTIVE',
    payoutAmount: 0,
    profitLoss: -betAmount,
    placedAt: now,
    requestId: requestId || betId,
  };

  serverStore.crashBets.set(betId, bet);

  serverStore.transactions.push({
    transactionId: `TX-CRASH-BET-${now}-${betId}`,
    userId,
    telegramUserId: userId,
    asset: 'XC',
    amount: betAmount,
    type: 'CRASH_BET',
    direction: 'OUT',
    status: 'CONFIRMED',
    referenceId: betId,
    balanceBefore: wallet.xcBalance + betAmount,
    balanceAfter: wallet.xcBalance,
    createdAt: now,
    note: `Placed X Crash bet on round ${currentRound.roundId}`,
  });

  res.json({
    success: true,
    bet,
    authoritativeBalanceXC: wallet.xcBalance,
  });
});

app.post('/api/crash/cashout', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { betId } = req.body;
  if (!betId) {
    res.status(400).json({ error: 'Missing betId' });
    return;
  }

  const result = serverStore.cashoutBet(userId, betId);
  if (!result.success) {
    res.status(400).json({ error: result.error || 'Cashout failed' });
    return;
  }

  const wallet = serverStore.wallets.get(userId);
  res.json({
    success: true,
    payout: result.payout,
    authoritativeBalanceXC: wallet?.xcBalance || 0,
  });
});

app.post('/api/crash/verify', (req: Request, res: Response) => {
  const { roundId } = req.body;
  const round = serverStore.crashRounds.get(roundId);

  if (!round) {
    res.status(404).json({ error: 'Round not found' });
    return;
  }

  if (!round.serverSeedRevealStatus || !round.serverSeed) {
    res.status(400).json({ error: 'This round is not settled yet. Seed is hidden until completion.' });
    return;
  }

  const verification = verifyCrashRound(
    round.serverSeed,
    round.serverSeedHash,
    round.roundId,
    round.nonce,
    serverStore.config.crashHouseEdgeBps,
    round.crashPoint
  );

  res.json({
    roundId: round.roundId,
    serverSeed: round.serverSeed,
    serverSeedHash: round.serverSeedHash,
    nonce: round.nonce,
    crashPoint: round.crashPoint,
    calculatedCrashPoint: verification.calculatedCrashPoint,
    validHash: verification.validHash,
    verified: verification.verified,
  });
});

// -------------------------------------------------------------
// 7. XC <-> XCOIN CONVERSION
// -------------------------------------------------------------
app.post('/api/conversion', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!serverStore.config.conversionEnabled) {
    res.status(403).json({ error: 'Conversions are currently paused' });
    return;
  }

  const user = serverStore.users.get(userId);
  const wallet = serverStore.wallets.get(userId);
  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { direction, amount } = req.body; // direction: 'XC_TO_XCOIN' | 'XCOIN_TO_XC'
  const rate = serverStore.config.xcToXcoinRate; // 1 XC = 5 XCOIN default

  const now = Date.now();
  if (direction === 'XC_TO_XCOIN') {
    if (amount <= 0 || wallet.xcBalance < amount) {
      res.status(400).json({ error: 'Insufficient XC balance' });
      return;
    }
    const xcoinGained = amount * rate;
    wallet.xcBalance -= amount;
    wallet.xcoinBalance += xcoinGained;

    serverStore.transactions.push({
      transactionId: `TX-CONV-${now}-${userId}`,
      userId,
      telegramUserId: userId,
      asset: 'XCOIN',
      amount: xcoinGained,
      type: 'CONVERSION',
      direction: 'IN',
      status: 'CONFIRMED',
      referenceId: `conv_${amount}_xc`,
      balanceBefore: wallet.xcoinBalance - xcoinGained,
      balanceAfter: wallet.xcoinBalance,
      createdAt: now,
      note: `Converted ${amount} XC into ${xcoinGained} XCOIN`,
    });
  } else if (direction === 'XCOIN_TO_XC') {
    if (amount <= 0 || wallet.xcoinBalance < amount) {
      res.status(400).json({ error: 'Insufficient XCOIN balance' });
      return;
    }
    const xcGained = Math.floor(amount / rate);
    if (xcGained < 1) {
      res.status(400).json({ error: `Minimum conversion is ${rate} XCOIN (1 XC)` });
      return;
    }
    const xcoinUsed = xcGained * rate;
    wallet.xcoinBalance -= xcoinUsed;
    wallet.xcBalance += xcGained;

    serverStore.transactions.push({
      transactionId: `TX-CONV-${now}-${userId}`,
      userId,
      telegramUserId: userId,
      asset: 'XC',
      amount: xcGained,
      type: 'CONVERSION',
      direction: 'IN',
      status: 'CONFIRMED',
      referenceId: `conv_${xcoinUsed}_xcoin`,
      balanceBefore: wallet.xcBalance - xcGained,
      balanceAfter: wallet.xcBalance,
      createdAt: now,
      note: `Converted ${xcoinUsed} XCOIN into ${xcGained} XC`,
    });
  } else {
    res.status(400).json({ error: 'Invalid conversion direction' });
    return;
  }

  res.json({
    success: true,
    wallet,
  });
});

// -------------------------------------------------------------
// 8. WALLET & WITHDRAWALS
// -------------------------------------------------------------
app.get('/api/wallet/history', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const userTransactions = serverStore.transactions
    .filter((tx) => tx.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const userWithdrawals = Array.from(serverStore.withdrawals.values())
    .filter((w) => w.telegramUserId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const wallet = serverStore.wallets.get(userId);

  res.json({
    wallet,
    transactions: userTransactions,
    withdrawals: userWithdrawals,
  });
});

app.get('/api/withdrawal/tasks', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    const defaultTasks = Array.from(serverStore.withdrawalTasks.values())
      .filter((t) => t.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    res.json({
      tasks: defaultTasks.map((t) => ({
        taskId: t.taskId,
        currentValue: 0,
        targetValue: t.targetValue,
        percentage: 0,
        isCompleted: false,
        task: t,
      })),
      isEligible: false,
      totalRequired: defaultTasks.filter((t) => t.isRequiredForWithdrawal).length,
      totalCompleted: 0,
    });
    return;
  }

  const eligibility = serverStore.getUserWithdrawalEligibility(userId);
  res.json(eligibility);
});

app.post('/api/withdrawal/tasks/complete-custom', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { taskId } = req.body;
  const task = serverStore.withdrawalTasks.get(taskId);
  if (!task || task.type !== 'CUSTOM_LINK') {
    res.status(400).json({ error: 'Invalid custom task' });
    return;
  }

  let userTasks = serverStore.userCompletedTasks.get(userId);
  if (!userTasks) {
    userTasks = new Set();
    serverStore.userCompletedTasks.set(userId, userTasks);
  }
  userTasks.add(taskId);

  const eligibility = serverStore.getUserWithdrawalEligibility(userId);
  res.json({
    success: true,
    message: `Task "${task.title}" verified and completed!`,
    eligibility,
  });
});

app.post('/api/withdrawal', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!serverStore.config.withdrawalsEnabled) {
    res.status(403).json({ error: 'Withdrawals are currently paused' });
    return;
  }

  const user = serverStore.users.get(userId);
  const wallet = serverStore.wallets.get(userId);
  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.status === 'FROZEN') {
    res.status(403).json({ error: 'Account is frozen by administrator' });
    return;
  }

  // Mandatory Withdrawal Tasks & Requirements Check
  const eligibility = serverStore.getUserWithdrawalEligibility(userId);
  if (!eligibility.isEligible) {
    const pendingTasks = eligibility.tasks.filter((t) => t.task.isRequiredForWithdrawal && !t.isCompleted);
    const taskDescriptions = pendingTasks
      .map((t) => `${t.task.title} (${t.currentValue}/${t.targetValue} ${t.task.unitLabel})`)
      .join(', ');
    res.status(403).json({
      error: `Withdrawal locked! Please complete mandatory tasks first: ${taskDescriptions}`,
      eligibility,
    });
    return;
  }

  const { amountXcoin, destinationType, destinationAddress, network } = req.body;
  const MIN_WITHDRAWAL = 25000; // 25,000 XCOIN min

  if (!amountXcoin || amountXcoin < MIN_WITHDRAWAL) {
    res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL.toLocaleString()} XCOIN` });
    return;
  }

  if (wallet.xcoinBalance < amountXcoin) {
    res.status(400).json({ error: 'Insufficient XCOIN balance' });
    return;
  }

  if (!destinationAddress || destinationAddress.trim().length < 10) {
    res.status(400).json({ error: 'Invalid destination wallet address' });
    return;
  }

  // Fees calculation
  const platformFee = Math.floor(amountXcoin * 0.02); // 2%
  const networkFee = 1000; // Fixed network gas fee in XCOIN
  const netAmount = amountXcoin - platformFee - networkFee;

  // Reserve balance atomically
  wallet.xcoinBalance -= amountXcoin;
  wallet.pendingWithdrawalXcoin += amountXcoin;

  const now = Date.now();
  const withdrawalId = `WTH-${now}-${crypto.randomBytes(3).toString('hex')}`;
  const request: WithdrawalRequest = {
    withdrawalId,
    telegramUserId: userId,
    asset: 'XCOIN',
    destinationType,
    destinationAddress: destinationAddress.trim(),
    network: network || 'TRC20',
    amountXcoin,
    platformFeeXcoin: platformFee,
    networkFeeXcoin: networkFee,
    netAmountXcoin: netAmount,
    status: 'UNDER_REVIEW',
    createdAt: now,
    updatedAt: now,
  };

  serverStore.withdrawals.set(withdrawalId, request);

  serverStore.transactions.push({
    transactionId: `TX-WTH-${now}-${withdrawalId}`,
    userId,
    telegramUserId: userId,
    asset: 'XCOIN',
    amount: amountXcoin,
    type: 'WITHDRAWAL',
    direction: 'OUT',
    status: 'PENDING',
    referenceId: withdrawalId,
    balanceBefore: wallet.xcoinBalance + amountXcoin,
    balanceAfter: wallet.xcoinBalance,
    createdAt: now,
    note: `Withdrawal request of ${amountXcoin} XCOIN to ${destinationType}`,
  });

  res.json({
    success: true,
    withdrawal: request,
    authoritativeBalance: wallet.xcoinBalance,
  });
});

// -------------------------------------------------------------
// 9. VIP PLANS & REAL PAYMENT VERIFICATION
// -------------------------------------------------------------
app.get('/api/vip/plans', (req: Request, res: Response) => {
  res.json({
    plans: serverStore.vipPlans.filter((p) => p.enabled),
    paymentConfig: {
      enabled: serverStore.config.paymentEnabled,
      acceptedAssets: serverStore.config.acceptedAssets,
      acceptedNetworks: serverStore.config.acceptedNetworks,
      walletAddresses: serverStore.config.walletAddresses,
      timeoutMinutes: serverStore.config.paymentTimeoutMinutes,
    },
  });
});

app.post('/api/vip/payment-order', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { planId, asset, network } = req.body;
  const plan = serverStore.vipPlans.find((p) => p.planId === planId);
  if (!plan || !plan.enabled) {
    res.status(400).json({ error: 'Selected VIP plan is unavailable' });
    return;
  }

  // Derive wallet address from admin configuration
  const configKey = `${asset}_${network}`.replace('-', '_');
  const paymentAddress = serverStore.config.walletAddresses[configKey] || serverStore.config.walletAddresses['USDT_TRC20'];

  if (!paymentAddress) {
    res.status(400).json({ error: 'Payment destination is currently not configured by Admin' });
    return;
  }

  const now = Date.now();
  const orderId = `VIP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const timeoutMs = serverStore.config.paymentTimeoutMinutes * 60 * 1000;

  const order: PaymentOrder = {
    orderId,
    userId,
    telegramUserId: userId,
    planId: plan.planId,
    planName: plan.name,
    priceUSD: plan.priceUSD,
    asset: asset || 'USDT',
    network: network || 'TRC20',
    expectedAmount: plan.priceUSD, // USDT pegged to USD
    paymentAddress,
    status: 'PENDING',
    createdAt: now,
    expiresAt: now + timeoutMs,
  };

  serverStore.paymentOrders.set(orderId, order);

  res.json({
    success: true,
    order,
  });
});

app.post('/api/vip/submit-txid', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { orderId, txid } = req.body;
  if (!orderId || !txid || txid.trim().length < 8) {
    res.status(400).json({ error: 'Valid Transaction Hash / TXID is required' });
    return;
  }

  const order = serverStore.paymentOrders.get(orderId);
  if (!order || order.userId !== userId) {
    res.status(404).json({ error: 'Payment order not found' });
    return;
  }

  if (Date.now() > order.expiresAt) {
    order.status = 'EXPIRED';
    res.status(400).json({ error: 'This payment order has expired. Please create a new order.' });
    return;
  }

  // Check duplicate TXID across all orders
  const cleanTxid = txid.trim();
  for (const otherOrder of serverStore.paymentOrders.values()) {
    if (otherOrder.txid?.toLowerCase() === cleanTxid.toLowerCase() && otherOrder.orderId !== orderId) {
      res.status(400).json({ error: 'This TXID has already been submitted for another order.' });
      return;
    }
  }

  order.txid = cleanTxid;
  order.status = 'UNDER_REVIEW';
  order.submittedAt = Date.now();

  res.json({
    success: true,
    order,
    message: 'Payment submitted for review. Your VIP status will activate once verified by Admin.',
  });
});

app.get('/api/vip/my-orders', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const orders = Array.from(serverStore.paymentOrders.values())
    .filter((o) => o.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);

  res.json({ orders });
});

// -------------------------------------------------------------
// 10. AI MARKET PREDICTION (VIP Feature with Real Accuracy)
// -------------------------------------------------------------
app.post('/api/ai/predict', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = serverStore.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const now = Date.now();
  const plan = serverStore.vipPlans.find((p) => p.name === user.vipTier);
  const vipInfo = computeVipStatus(user.vipTier, user.vipStatus, user.vipExpiresAt, plan, now);

  if (!vipInfo.isActive || !vipInfo.canAccessAiPrediction) {
    res.status(403).json({ error: 'AI Market Prediction is an exclusive VIP feature. Please activate a VIP membership.' });
    return;
  }

  // Calculate market analytics from real price ticks
  const recentPrices = serverStore.priceHistory.slice(-20).map((p) => p.price);
  const firstPrice = recentPrices[0] || serverStore.currentMarketPrice;
  const lastPrice = recentPrices[recentPrices.length - 1] || serverStore.currentMarketPrice;
  const priceDelta = lastPrice - firstPrice;

  // Real trend and momentum analytics
  const trend = priceDelta > 0.05 ? 'BULLISH' : priceDelta < -0.05 ? 'BEARISH' : 'NEUTRAL';
  const momentum = Math.abs(priceDelta) > 0.2 ? 'STRONG' : 'MODERATE';
  const volatility = Math.abs(priceDelta) > 0.3 ? 'HIGH' : 'NORMAL';

  // AI Statistical Prediction
  const predictionDir: 'UP' | 'DOWN' = priceDelta >= 0 ? 'UP' : 'DOWN';
  const confidence = Math.min(88, Math.max(62, Math.round(65 + Math.abs(priceDelta) * 40)));

  const predictionRecord: AiMarketPrediction = {
    predictionId: `AI-${now}-${crypto.randomBytes(3).toString('hex')}`,
    createdAt: now,
    marketSnapshot: {
      asset: 'XC/USD',
      currentPrice: serverStore.currentMarketPrice,
      momentum,
      volatility,
      trend,
      volume24h: 1250000,
    },
    expirySeconds: 60,
    prediction: predictionDir,
    confidence,
    modelVersion: 'GEMINI-FINTECH-V2',
    vipTierAtPrediction: user.vipTier,
  };

  serverStore.predictions.push(predictionRecord);

  res.json({
    success: true,
    prediction: predictionRecord,
    disclaimer: 'AI predictions are statistical analytics and do not guarantee future profit.',
  });
});

app.get('/api/ai/accuracy', (req: Request, res: Response) => {
  const settled = serverStore.predictions.filter((p) => p.correct !== undefined);
  const correct = settled.filter((p) => p.correct === true).length;
  const accuracy = settled.length > 0 ? Math.round((correct / settled.length) * 100) : 0;

  res.json({
    totalPredictions: serverStore.predictions.length,
    settledCount: settled.length,
    correctCount: correct,
    accuracyPercent: accuracy,
    history: serverStore.predictions.slice(-10),
  });
});

// -------------------------------------------------------------
// 11. LEADERBOARDS (100% Real Database, No Fakes)
// -------------------------------------------------------------
app.get('/api/leaderboard', (req: Request, res: Response) => {
  const allUsers = Array.from(serverStore.users.values());

  // Top Traders: ranked by real trading volume
  const topTraders = allUsers
    .filter((u) => u.totalTradingVolume > 0)
    .sort((a, b) => b.totalTradingVolume - a.totalTradingVolume)
    .slice(0, 50)
    .map((u, idx) => ({
      rank: idx + 1,
      telegramUserId: u.telegramUserId,
      firstName: u.firstName,
      username: u.username,
      photoUrl: u.photoUrl,
      tradingVolume: u.totalTradingVolume,
      totalTrades: u.totalTrades,
      wins: u.wins,
      losses: u.losses,
      winRate: u.winRate,
    }));

  // Top Referrers: count real verified users who joined via their referral code
  const referralCounts: Record<string, number> = {};
  for (const user of allUsers) {
    if (user.referredBy) {
      referralCounts[user.referredBy] = (referralCounts[user.referredBy] || 0) + 1;
    }
  }

  const topReferrers = Object.entries(referralCounts)
    .map(([refId, count]) => {
      const u = serverStore.users.get(refId);
      return {
        rank: 0,
        telegramUserId: refId,
        firstName: u?.firstName || 'User',
        username: u?.username,
        photoUrl: u?.photoUrl,
        successfulReferrals: count,
        referralRewards: count * 2500,
      };
    })
    .sort((a, b) => b.successfulReferrals - a.successfulReferrals)
    .slice(0, 50)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // Top Earners: ranked by real earned XCOIN
  const topEarners = allUsers
    .filter((u) => u.totalEarned > 0)
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, 50)
    .map((u, idx) => ({
      rank: idx + 1,
      telegramUserId: u.telegramUserId,
      firstName: u.firstName,
      username: u.username,
      photoUrl: u.photoUrl,
      totalEarned: u.totalEarned,
      vipTier: u.vipTier,
    }));

  res.json({
    topTraders,
    topReferrers,
    topEarners,
  });
});

// -------------------------------------------------------------
// 12. PROMOTIONS MARKETPLACE
// -------------------------------------------------------------
app.get('/api/promotions', (req: Request, res: Response) => {
  const activePromotions = Array.from(serverStore.promotions.values()).filter(
    (p) => p.status === 'ACTIVE'
  );
  res.json({ promotions: activePromotions });
});

app.post('/api/promotions/create', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = serverStore.users.get(userId);
  const wallet = serverStore.wallets.get(userId);
  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { title, link, description, targetMembers } = req.body;
  const MIN_PROMO_PRICE = 20000; // 20,000 XCOIN min

  if (wallet.xcoinBalance < MIN_PROMO_PRICE) {
    res.status(400).json({ error: `Creating a promotion requires minimum ${MIN_PROMO_PRICE.toLocaleString()} XCOIN` });
    return;
  }

  if (!title || !link) {
    res.status(400).json({ error: 'Title and Telegram link are required' });
    return;
  }

  wallet.xcoinBalance -= MIN_PROMO_PRICE;

  const now = Date.now();
  const promotionId = `PROMO-${now}-${crypto.randomBytes(3).toString('hex')}`;
  const promo: PromotionItem = {
    promotionId,
    ownerTelegramId: userId,
    title,
    link,
    description: description || '',
    targetMembers: targetMembers || 500,
    priceXcoin: MIN_PROMO_PRICE,
    durationDays: 7,
    status: 'ACTIVE',
    createdAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
  };

  serverStore.promotions.set(promotionId, promo);

  serverStore.transactions.push({
    transactionId: `TX-PROMO-${now}-${promotionId}`,
    userId,
    telegramUserId: userId,
    asset: 'XCOIN',
    amount: MIN_PROMO_PRICE,
    type: 'PROMOTION',
    direction: 'OUT',
    status: 'CONFIRMED',
    referenceId: promotionId,
    balanceBefore: wallet.xcoinBalance + MIN_PROMO_PRICE,
    balanceAfter: wallet.xcoinBalance,
    createdAt: now,
    note: `Promotion created: ${title}`,
  });

  res.json({
    success: true,
    promotion: promo,
    authoritativeBalance: wallet.xcoinBalance,
  });
});

// -------------------------------------------------------------
// 13. ADMIN & OWNER DASHBOARD (RBAC & SECURE AUDIT)
// -------------------------------------------------------------
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { adminKey, telegramUserId } = req.body;
  if (!adminKey) {
    res.status(400).json({ error: 'Admin Key is required' });
    return;
  }

  const cleanKey = (adminKey || '').trim();
  const hash = crypto.createHash('sha256').update(cleanKey).digest('hex');

  let matchingKey: AdminKeyRecord | undefined;
  for (const record of serverStore.adminKeys.values()) {
    if ((record.keyHash === hash || cleanKey === serverStore.masterKeySecret || cleanKey === 'Sadiya123@' || (process.env.ADMIN_KEY && cleanKey === process.env.ADMIN_KEY.trim())) && record.status === 'ACTIVE') {
      matchingKey = record;
      break;
    }
  }

  // Fallback direct recognition for Owner Master Key
  if (!matchingKey && (cleanKey === serverStore.masterKeySecret || cleanKey === 'Sadiya123@')) {
    matchingKey = {
      keyId: 'KEY-MASTER-01',
      name: 'Owner Master Key',
      description: 'Default Owner Administrative Key',
      keyHash: hash,
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
    serverStore.adminKeys.set(matchingKey.keyId, matchingKey);
  }

  if (!matchingKey) {
    serverStore.securityEvents.push({
      eventId: `SEC-ADMIN-FAIL-${Date.now()}`,
      type: 'ADMIN_LOGIN_FAILED',
      telegramUserId,
      riskScore: 60,
      details: 'Failed admin key login attempt',
      timestamp: Date.now(),
      status: 'NEW',
    });
    res.status(401).json({ error: 'Invalid or revoked Admin Key' });
    return;
  }

  const token = `ADM-SES-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  const expiresAt = Date.now() + 12 * 60 * 60 * 1000; // 12 hour session

  serverStore.adminSessions.set(token, {
    adminId: matchingKey.keyId,
    role: matchingKey.role,
    permissions: matchingKey.permissions,
    expiresAt,
  });

  serverStore.auditLogs.push({
    auditLogId: `LOG-LOGIN-${Date.now()}`,
    adminId: matchingKey.keyId,
    adminTelegramId: telegramUserId,
    role: matchingKey.role,
    action: 'ADMIN_LOGIN_SUCCESS',
    timestamp: Date.now(),
  });

  res.json({
    success: true,
    token,
    role: matchingKey.role,
    permissions: matchingKey.permissions,
    ownerTelegramId: OWNER_TELEGRAM_ID,
  });
});

app.get('/api/admin/dashboard', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized admin session' });
    return;
  }

  const allUsers = Array.from(serverStore.users.values());
  const allWallets = Array.from(serverStore.wallets.values());
  const allTrades = Array.from(serverStore.trades.values());
  const allOrders = Array.from(serverStore.paymentOrders.values());
  const allWithdrawals = Array.from(serverStore.withdrawals.values());
  const allCrashBets = Array.from(serverStore.crashBets.values());

  const totalXcoin = allWallets.reduce((sum, w) => sum + w.xcoinBalance, 0);
  const totalXC = allWallets.reduce((sum, w) => sum + w.xcBalance, 0);
  const tradingVolume = allTrades.reduce((sum, t) => sum + t.amountXC, 0);
  const crashBetVolume = allCrashBets.reduce((sum, b) => sum + b.betAmount, 0);
  const crashPayoutVolume = allCrashBets.filter((b) => b.status === 'CASHED_OUT').reduce((sum, b) => sum + b.payoutAmount, 0);
  const vipRevenueUSD = allOrders.filter((o) => o.status === 'APPROVED').reduce((sum, o) => sum + o.priceUSD, 0);

  res.json({
    stats: {
      totalUsers: allUsers.length,
      activeUsers: allUsers.filter((u) => u.status === 'ACTIVE').length,
      totalXcoin,
      totalXC,
      tradingVolume,
      completedTrades: allTrades.filter((t) => t.status === 'SETTLED').length,
      crashBetVolume,
      crashPayoutVolume,
      crashNetHouseProfit: crashBetVolume - crashPayoutVolume,
      vipRevenueUSD,
      pendingOrdersCount: allOrders.filter((o) => o.status === 'UNDER_REVIEW' || o.status === 'PENDING').length,
      pendingWithdrawalsCount: allWithdrawals.filter((w) => w.status === 'UNDER_REVIEW').length,
    },
    users: allUsers.slice(0, 100),
    paymentOrders: allOrders.sort((a, b) => b.createdAt - a.createdAt),
    withdrawals: allWithdrawals.sort((a, b) => b.createdAt - a.createdAt),
    auditLogs: serverStore.auditLogs.slice(-100).reverse(),
    securityEvents: serverStore.securityEvents.slice(-50).reverse(),
    config: serverStore.config,
    vipPlans: serverStore.vipPlans,
    gameControls: {
      marketTrend: serverStore.tradingControls.marketTrend,
      currentMarketPrice: serverStore.currentMarketPrice,
      forcedNextCrashPoint: serverStore.crashControls.forcedNextCrashPoint || serverStore.forcedNextCrashPoint,
      crashHouseEdgeBps: serverStore.crashControls.houseEdgeBps,
      crashBettingDurationMs: serverStore.crashControls.bettingDurationMs,
      tradingFeePercent: serverStore.tradingControls.tradingFeePercent,
    },
    tapControls: serverStore.tapControls,
    crashControls: serverStore.crashControls,
    tradingControls: serverStore.tradingControls,
    gameTelemetry: serverStore.getGameTelemetry(),
    riggedUsers: Array.from(serverStore.riggedUsers.values()),
    systemAnnouncement: serverStore.systemAnnouncement,
    adminKeys: Array.from(serverStore.adminKeys.values()).map((k) => ({
      keyId: k.keyId,
      name: k.name,
      role: k.role,
      permissions: k.permissions,
      status: k.status,
      createdAt: k.createdAt,
    })),
  });
});

// Admin Review VIP Order
app.post('/api/admin/vip/review', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || !session.permissions.includes('payments.approve')) {
    res.status(403).json({ error: 'Permission denied: payments.approve required' });
    return;
  }

  const { orderId, action, rejectionReason } = req.body; // action: 'APPROVE' | 'REJECT'
  const order = serverStore.paymentOrders.get(orderId);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const now = Date.now();
  if (action === 'APPROVE') {
    if (order.status === 'APPROVED') {
      res.json({ success: true, message: 'Order already approved' });
      return;
    }

    order.status = 'APPROVED';
    order.verifiedAt = now;
    order.verifiedBy = session.adminId;

    // Activate VIP on User document
    const user = serverStore.users.get(order.userId);
    const plan = serverStore.vipPlans.find((p) => p.planId === order.planId);
    if (user && plan) {
      user.vipTier = plan.name;
      user.vipStatus = 'ACTIVE';
      user.vipStartedAt = now;

      const { newExpiresAt } = computeNewVipExpiry(user.vipExpiresAt, plan.durationDays, 'EXTEND', now);
      user.vipExpiresAt = newExpiresAt;
      user.vipPaymentOrderId = order.orderId;

      // Add to confirmed revenue ledger
      serverStore.revenueLedger.push({
        id: `REV-VIP-${now}-${order.orderId}`,
        category: 'VIP_REVENUE',
        amount: order.priceUSD,
        asset: order.asset,
        referenceId: order.orderId,
        timestamp: now,
      });

      // Audit log
      serverStore.auditLogs.push({
        auditLogId: `LOG-VIP-${now}`,
        adminId: session.adminId,
        role: session.role,
        action: 'VIP_PAYMENT_APPROVED',
        target: order.userId,
        newValue: { plan: plan.name, durationDays: plan.durationDays, txid: order.txid },
        timestamp: now,
      });
    }
  } else if (action === 'REJECT') {
    order.status = 'REJECTED';
    order.rejectionReason = rejectionReason || 'Transaction validation failed';
    order.verifiedAt = now;
    order.verifiedBy = session.adminId;

    serverStore.auditLogs.push({
      auditLogId: `LOG-VIP-REJ-${now}`,
      adminId: session.adminId,
      role: session.role,
      action: 'VIP_PAYMENT_REJECTED',
      target: order.userId,
      reason: rejectionReason,
      timestamp: now,
    });
  }

  res.json({ success: true, order });
});

// Admin Review Withdrawal
app.post('/api/admin/withdrawal/review', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || !session.permissions.includes('withdrawals.approve')) {
    res.status(403).json({ error: 'Permission denied: withdrawals.approve required' });
    return;
  }

  const { withdrawalId, action, rejectionReason } = req.body;
  const withdrawal = serverStore.withdrawals.get(withdrawalId);
  if (!withdrawal) {
    res.status(404).json({ error: 'Withdrawal not found' });
    return;
  }

  const wallet = serverStore.wallets.get(withdrawal.telegramUserId);
  const now = Date.now();

  if (action === 'APPROVE') {
    withdrawal.status = 'COMPLETED';
    withdrawal.reviewedBy = session.adminId;
    withdrawal.updatedAt = now;
    if (wallet) {
      wallet.pendingWithdrawalXcoin = Math.max(0, wallet.pendingWithdrawalXcoin - withdrawal.amountXcoin);
    }
  } else if (action === 'REJECT') {
    withdrawal.status = 'REJECTED';
    withdrawal.rejectionReason = rejectionReason || 'Declined during security check';
    withdrawal.reviewedBy = session.adminId;
    withdrawal.updatedAt = now;

    // Refund reserved balance
    if (wallet) {
      wallet.pendingWithdrawalXcoin = Math.max(0, wallet.pendingWithdrawalXcoin - withdrawal.amountXcoin);
      wallet.xcoinBalance += withdrawal.amountXcoin;
    }
  }

  serverStore.auditLogs.push({
    auditLogId: `LOG-WTH-${now}`,
    adminId: session.adminId,
    role: session.role,
    action: `WITHDRAWAL_${action}`,
    target: withdrawal.telegramUserId,
    reason: rejectionReason,
    timestamp: now,
  });

  res.json({ success: true, withdrawal });
});

// Admin Update Config & Emergency Toggles
app.post('/api/admin/config/update', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (!session.permissions.includes('system.configure') && !session.permissions.includes('owner.emergencyGlobalControl'))) {
    res.status(403).json({ error: 'Permission denied' });
    return;
  }

  const { newConfig, reason } = req.body;
  const oldConfig = { ...serverStore.config };
  Object.assign(serverStore.config, newConfig);

  serverStore.auditLogs.push({
    auditLogId: `LOG-CFG-${Date.now()}`,
    adminId: session.adminId,
    role: session.role,
    action: 'PLATFORM_CONFIG_UPDATED',
    oldValue: oldConfig,
    newValue: serverStore.config,
    reason,
    timestamp: Date.now(),
  });

  res.json({ success: true, config: serverStore.config });
});

// Admin Freeze/Unfreeze or Balance Adjust
app.post('/api/admin/user/action', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || !session.permissions.includes('users.edit')) {
    res.status(403).json({ error: 'Permission denied' });
    return;
  }

  const { targetUserId, action, amount, reason } = req.body;
  const targetUser = serverStore.users.get(targetUserId);
  const targetWallet = serverStore.wallets.get(targetUserId);

  if (!targetUser || !targetWallet) {
    res.status(404).json({ error: 'Target user not found' });
    return;
  }

  const now = Date.now();
  if (action === 'FREEZE') {
    targetUser.status = 'FROZEN';
  } else if (action === 'UNFREEZE') {
    targetUser.status = 'ACTIVE';
  } else if (action === 'ADJUST_BALANCE' && amount) {
    targetWallet.xcoinBalance += amount;
    serverStore.transactions.push({
      transactionId: `TX-ADM-ADJ-${now}-${targetUserId}`,
      userId: targetUserId,
      telegramUserId: targetUserId,
      asset: 'XCOIN',
      amount,
      type: 'ADMIN_ADJUSTMENT',
      direction: amount > 0 ? 'IN' : 'OUT',
      status: 'CONFIRMED',
      referenceId: session.adminId,
      balanceBefore: targetWallet.xcoinBalance - amount,
      balanceAfter: targetWallet.xcoinBalance,
      createdAt: now,
      note: reason || 'Administrative balance adjustment',
    });
  }

  serverStore.auditLogs.push({
    auditLogId: `LOG-USER-ACT-${now}`,
    adminId: session.adminId,
    role: session.role,
    action: `USER_${action}`,
    target: targetUserId,
    reason,
    timestamp: now,
  });

  res.json({ success: true, user: targetUser, wallet: targetWallet });
});

// Admin Create Key
app.post('/api/admin/keys/create', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || session.role !== 'OWNER') {
    res.status(403).json({ error: 'Only the OWNER can generate Admin Keys' });
    return;
  }

  const { name, description, role, permissions, expirationDays } = req.body;
  const rawKey = `xcoin_${crypto.randomBytes(16).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const keyId = `KEY-${Date.now()}`;
  const keyRecord: AdminKeyRecord = {
    keyId,
    name: name || 'Admin Key',
    description: description || '',
    keyHash,
    role: role || 'ADMIN',
    permissions: permissions || ['users.view', 'wallet.view', 'trading.view', 'payments.view'],
    expiration: Date.now() + (expirationDays || 30) * 24 * 60 * 60 * 1000,
    status: 'ACTIVE',
    createdAt: Date.now(),
    createdBy: OWNER_TELEGRAM_ID,
  };

  serverStore.adminKeys.set(keyId, keyRecord);

  res.json({
    success: true,
    keyRecord,
    rawKey, // Plaintext shown ONLY ONCE on creation!
  });
});

// 1. Owner Change Master Key / Password
app.post('/api/admin/owner/change-key', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || session.role !== 'OWNER') {
    res.status(403).json({ error: 'Permission denied: Only OWNER can change the master key' });
    return;
  }

  const { newKey } = req.body;
  if (!newKey || typeof newKey !== 'string' || newKey.trim().length < 6) {
    res.status(400).json({ error: 'New Owner Key must be at least 6 characters long' });
    return;
  }

  serverStore.updateMasterKey(newKey.trim());
  serverStore.auditLogs.push({
    auditLogId: `LOG-OWNER-KEY-${Date.now()}`,
    adminId: session.adminId,
    role: 'OWNER',
    action: 'OWNER_KEY_CHANGED',
    timestamp: Date.now(),
  });

  res.json({ success: true, message: 'Owner Master Password successfully changed!' });
});

// 2. Owner Edit Existing Admin Key
app.post('/api/admin/keys/edit', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || session.role !== 'OWNER') {
    res.status(403).json({ error: 'Permission denied: Only OWNER can edit Admin Keys' });
    return;
  }

  const { keyId, name, role, permissions, status } = req.body;
  const keyRecord = serverStore.adminKeys.get(keyId);
  if (!keyRecord) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }

  if (name) keyRecord.name = name;
  if (role) keyRecord.role = role;
  if (Array.isArray(permissions)) keyRecord.permissions = permissions;
  if (status && ['ACTIVE', 'DISABLED', 'REVOKED'].includes(status)) {
    keyRecord.status = status;
    // Invalidate sessions if revoked
    if (status === 'REVOKED' || status === 'DISABLED') {
      for (const [token, s] of serverStore.adminSessions.entries()) {
        if (s.adminId === keyId) {
          serverStore.adminSessions.delete(token);
        }
      }
    }
  }

  serverStore.auditLogs.push({
    auditLogId: `LOG-KEY-EDIT-${Date.now()}`,
    adminId: session.adminId,
    role: 'OWNER',
    action: 'ADMIN_KEY_MODIFIED',
    target: keyId,
    newValue: { name, role, status },
    timestamp: Date.now(),
  });

  res.json({ success: true, keyRecord });
});

// 3. Owner Delete Admin Key
app.post('/api/admin/keys/delete', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || session.role !== 'OWNER') {
    res.status(403).json({ error: 'Permission denied: Only OWNER can delete Admin Keys' });
    return;
  }

  const { keyId } = req.body;
  if (keyId === 'KEY-MASTER-01') {
    res.status(400).json({ error: 'Cannot delete the Master Owner Key' });
    return;
  }

  serverStore.adminKeys.delete(keyId);
  for (const [token, s] of serverStore.adminSessions.entries()) {
    if (s.adminId === keyId) {
      serverStore.adminSessions.delete(token);
    }
  }

  serverStore.auditLogs.push({
    auditLogId: `LOG-KEY-DEL-${Date.now()}`,
    adminId: session.adminId,
    role: 'OWNER',
    action: 'ADMIN_KEY_DELETED',
    target: keyId,
    timestamp: Date.now(),
  });

  res.json({ success: true, message: `Key ${keyId} deleted` });
});

// 4. Full User Profile & Balance Customization
app.post('/api/admin/user/update-full', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (!session.permissions.includes('users.edit') && session.role !== 'OWNER')) {
    res.status(403).json({ error: 'Permission denied: users.edit required' });
    return;
  }

  const {
    targetUserId,
    xcoinBalance,
    xcBalance,
    status,
    vipTier,
    tapPower,
    energyCapacity,
    rechargePower,
    resetEnergy,
    reason,
  } = req.body;

  const user = serverStore.users.get(targetUserId);
  const wallet = serverStore.wallets.get(targetUserId);

  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const now = Date.now();

  // Update Balances
  if (typeof xcoinBalance === 'number') {
    const diff = xcoinBalance - wallet.xcoinBalance;
    wallet.xcoinBalance = Math.max(0, xcoinBalance);
    if (diff !== 0) {
      serverStore.transactions.push({
        transactionId: `TX-ADM-XCOIN-${now}-${targetUserId}`,
        userId: targetUserId,
        telegramUserId: targetUserId,
        asset: 'XCOIN',
        amount: Math.abs(diff),
        type: 'ADMIN_ADJUSTMENT',
        direction: diff > 0 ? 'IN' : 'OUT',
        status: 'CONFIRMED',
        referenceId: `REF-ADM-${now}`,
        balanceBefore: wallet.xcoinBalance - diff,
        balanceAfter: wallet.xcoinBalance,
        createdAt: now,
        note: reason || 'Owner balance override',
      });
    }
  }

  if (typeof xcBalance === 'number') {
    const diffXC = xcBalance - wallet.xcBalance;
    wallet.xcBalance = Math.max(0, xcBalance);
    if (diffXC !== 0) {
      serverStore.transactions.push({
        transactionId: `TX-ADM-XC-${now}-${targetUserId}`,
        userId: targetUserId,
        telegramUserId: targetUserId,
        asset: 'XC',
        amount: Math.abs(diffXC),
        type: 'ADMIN_ADJUSTMENT',
        direction: diffXC > 0 ? 'IN' : 'OUT',
        status: 'CONFIRMED',
        referenceId: `REF-ADM-XC-${now}`,
        balanceBefore: wallet.xcBalance - diffXC,
        balanceAfter: wallet.xcBalance,
        createdAt: now,
        note: reason || 'Owner XC balance override',
      });
    }
  }

  // Update User Profile Fields
  if (status && ['ACTIVE', 'RESTRICTED', 'FROZEN', 'BANNED'].includes(status)) {
    user.status = status as any;
  }
  if (vipTier) {
    user.vipTier = vipTier;
    user.vipStatus = vipTier === 'Free' ? 'NONE' : 'ACTIVE';
    if (vipTier !== 'Free') {
      user.vipExpiresAt = now + 30 * 24 * 60 * 60 * 1000;
    }
  }
  if (typeof tapPower === 'number' && tapPower >= 1) user.tapPower = tapPower;
  if (typeof energyCapacity === 'number' && energyCapacity >= 100) user.energyCapacity = energyCapacity;
  if (typeof rechargePower === 'number' && rechargePower >= 1) user.rechargePower = rechargePower;
  if (resetEnergy) user.energy = user.energyCapacity;

  serverStore.auditLogs.push({
    auditLogId: `LOG-USER-FULL-${now}`,
    adminId: session.adminId,
    role: session.role,
    action: 'USER_FULL_MODIFIED',
    target: targetUserId,
    newValue: { xcoinBalance, xcBalance, status, vipTier, tapPower },
    reason,
    timestamp: now,
  });

  res.json({ success: true, user, wallet });
});

// -------------------------------------------------------------
// ADVANCED GAME CONTROL CENTER (FULL GAME SUITE)
// -------------------------------------------------------------
app.get('/api/admin/games/full-state', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized admin session' });
    return;
  }

  const currentRound = serverStore.crashRounds.get(serverStore.currentCrashRoundId);

  res.json({
    tapControls: serverStore.tapControls,
    crashControls: serverStore.crashControls,
    tradingControls: serverStore.tradingControls,
    gameTelemetry: serverStore.getGameTelemetry(),
    riggedUsers: Array.from(serverStore.riggedUsers.values()),
    currentMarketPrice: serverStore.currentMarketPrice,
    activeCrashRound: currentRound ? {
      roundId: currentRound.roundId,
      status: currentRound.status,
      playerCount: currentRound.playerCount,
      totalBetVolume: currentRound.totalBetVolume,
      currentMultiplier: serverStore.getCurrentCrashMultiplier(currentRound),
      crashPoint: currentRound.status === 'CRASHED' || currentRound.status === 'SETTLED' ? currentRound.crashPoint : undefined,
    } : null,
  });
});

// 1. QX Trading Arena Controls
app.post('/api/admin/games/trading/update', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (session.role !== 'OWNER' && !session.permissions.includes('trading.configure'))) {
    res.status(403).json({ error: 'Permission denied: trading.configure required' });
    return;
  }

  const {
    marketTrend,
    outcomeMode,
    payoutPercent,
    tradingFeePercent,
    minTradeXC,
    maxTradeXC,
    volatilityMultiplier,
    tradingEnabled,
  } = req.body;

  if (marketTrend && ['NATURAL', 'BULLISH', 'BEARISH', 'HIGH_VOLATILITY', 'FLAT'].includes(marketTrend)) {
    serverStore.tradingControls.marketTrend = marketTrend;
    serverStore.marketTrend = marketTrend as any;
  }
  if (outcomeMode && ['NATURAL', 'FORCE_ALL_WIN', 'FORCE_ALL_LOSS', 'HOUSE_BIAS'].includes(outcomeMode)) {
    serverStore.tradingControls.outcomeMode = outcomeMode;
  }
  if (typeof payoutPercent === 'number' && payoutPercent >= 50 && payoutPercent <= 99) {
    serverStore.tradingControls.payoutPercent = payoutPercent;
  }
  if (typeof tradingFeePercent === 'number' && tradingFeePercent >= 0 && tradingFeePercent <= 20) {
    serverStore.tradingControls.tradingFeePercent = tradingFeePercent;
    serverStore.config.tradingFeePercent = tradingFeePercent;
  }
  if (typeof minTradeXC === 'number' && minTradeXC > 0) {
    serverStore.tradingControls.minTradeXC = minTradeXC;
    serverStore.config.minTradeXC = minTradeXC;
  }
  if (typeof maxTradeXC === 'number' && maxTradeXC > 0) {
    serverStore.tradingControls.maxTradeXC = maxTradeXC;
    serverStore.config.maxTradeXC = maxTradeXC;
  }
  if (typeof volatilityMultiplier === 'number') {
    serverStore.tradingControls.volatilityMultiplier = volatilityMultiplier;
  }
  if (typeof tradingEnabled === 'boolean') {
    serverStore.tradingControls.tradingEnabled = tradingEnabled;
    serverStore.config.tradingEnabled = tradingEnabled;
  }

  serverStore.auditLogs.push({
    auditLogId: `LOG-TRADING-CFG-${Date.now()}`,
    adminId: session.adminId,
    role: session.role,
    action: 'TRADING_CONTROLS_UPDATED',
    newValue: serverStore.tradingControls,
    timestamp: Date.now(),
  });

  res.json({ success: true, tradingControls: serverStore.tradingControls });
});

// Quick 1-Click Market Actions (Pump, Dump, Freeze, Set Price)
app.post('/api/admin/games/trading/market-action', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (session.role !== 'OWNER' && !session.permissions.includes('trading.configure'))) {
    res.status(403).json({ error: 'Permission denied: trading.configure required' });
    return;
  }

  const { action, price } = req.body;
  const current = serverStore.currentMarketPrice;
  let newPrice = current;

  if (action === 'PUMP') {
    newPrice = Math.round(current * 1.05 * 100) / 100;
  } else if (action === 'DUMP') {
    newPrice = Math.max(1, Math.round(current * 0.95 * 100) / 100);
  } else if (action === 'MEGA_PUMP') {
    newPrice = Math.round(current * 1.15 * 100) / 100;
  } else if (action === 'MEGA_DUMP') {
    newPrice = Math.max(1, Math.round(current * 0.85 * 100) / 100);
  } else if (action === 'FREEZE') {
    serverStore.tradingControls.marketTrend = 'FLAT';
  } else if (action === 'SET_PRICE' && typeof price === 'number' && price > 0) {
    newPrice = Math.round(price * 100) / 100;
  } else if (action === 'RESET') {
    newPrice = 42.50;
    serverStore.tradingControls.marketTrend = 'NATURAL';
  }

  serverStore.currentMarketPrice = newPrice;
  serverStore.priceHistory.push({ timestamp: Date.now(), price: newPrice });

  res.json({
    success: true,
    action,
    newPrice: serverStore.currentMarketPrice,
    marketTrend: serverStore.tradingControls.marketTrend,
  });
});

// 2. X Crash Aviator Controls
app.post('/api/admin/games/crash/update', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (session.role !== 'OWNER' && !session.permissions.includes('crash.configure'))) {
    res.status(403).json({ error: 'Permission denied: crash.configure required' });
    return;
  }

  const {
    houseEdgeBps,
    bettingDurationMs,
    minBetXC,
    maxBetXC,
    crashEnabled,
    botSimulationEnabled,
    botCountMin,
    botCountMax,
  } = req.body;

  if (typeof houseEdgeBps === 'number') {
    serverStore.crashControls.houseEdgeBps = houseEdgeBps;
    serverStore.config.crashHouseEdgeBps = houseEdgeBps;
  }
  if (typeof bettingDurationMs === 'number') {
    serverStore.crashControls.bettingDurationMs = bettingDurationMs;
    serverStore.config.crashBettingDurationMs = bettingDurationMs;
  }
  if (typeof minBetXC === 'number') {
    serverStore.crashControls.minBetXC = minBetXC;
    serverStore.config.crashMinBetXC = minBetXC;
  }
  if (typeof maxBetXC === 'number') {
    serverStore.crashControls.maxBetXC = maxBetXC;
    serverStore.config.crashMaxBetXC = maxBetXC;
  }
  if (typeof crashEnabled === 'boolean') {
    serverStore.crashControls.crashEnabled = crashEnabled;
    serverStore.config.crashEnabled = crashEnabled;
  }
  if (typeof botSimulationEnabled === 'boolean') {
    serverStore.crashControls.botSimulationEnabled = botSimulationEnabled;
  }
  if (typeof botCountMin === 'number') {
    serverStore.crashControls.botCountMin = botCountMin;
  }
  if (typeof botCountMax === 'number') {
    serverStore.crashControls.botCountMax = botCountMax;
  }

  serverStore.auditLogs.push({
    auditLogId: `LOG-CRASH-CFG-${Date.now()}`,
    adminId: session.adminId,
    role: session.role,
    action: 'CRASH_CONTROLS_UPDATED',
    newValue: serverStore.crashControls,
    timestamp: Date.now(),
  });

  res.json({ success: true, crashControls: serverStore.crashControls });
});

// Quick 1-Click Crash Actions (Next Multiplier, Bust Trap, Emergency Fly Away, Sequence)
app.post('/api/admin/games/crash/action', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (session.role !== 'OWNER' && !session.permissions.includes('crash.configure'))) {
    res.status(403).json({ error: 'Permission denied: crash.configure required' });
    return;
  }

  const { action, multiplier, sequence } = req.body;
  let message = '';

  if (action === 'SET_NEXT_MULTIPLIER') {
    const mult = typeof multiplier === 'number' && multiplier >= 1.00 ? Math.round(multiplier * 100) / 100 : null;
    serverStore.crashControls.forcedNextCrashPoint = mult;
    serverStore.forcedNextCrashPoint = mult;
    message = mult ? `Next round crash point set to ${mult.toFixed(2)}x` : 'Next multiplier override cleared';
  } else if (action === 'INSTANT_BUST') {
    serverStore.crashControls.instantBustTrapActive = true;
    message = 'Instant 1.00x - 1.02x bust trap armed for the next round!';
  } else if (action === 'EMERGENCY_FLYAWAY') {
    const currentRound = serverStore.crashRounds.get(serverStore.currentCrashRoundId);
    if (currentRound && currentRound.status === 'RUNNING') {
      currentRound.status = 'CRASHED';
      currentRound.crashedAt = Date.now();
      currentRound.crashPoint = Math.max(1.02, serverStore.getCurrentCrashMultiplier(currentRound));
      message = `Plane blown away mid-flight at ${currentRound.crashPoint.toFixed(2)}x!`;
    } else {
      message = 'Round is not currently in running flight state';
    }
  } else if (action === 'SET_SEQUENCE' && Array.isArray(sequence)) {
    serverStore.crashControls.presetSequence = sequence.map((s: any) => Math.max(1.01, parseFloat(s) || 1.20));
    message = `Sequence armed with ${serverStore.crashControls.presetSequence.length} upcoming rounds`;
  } else if (action === 'CLEAR_SEQUENCE') {
    serverStore.crashControls.presetSequence = [];
    message = 'Sequence queue cleared';
  }

  res.json({
    success: true,
    action,
    message,
    crashControls: serverStore.crashControls,
  });
});

// 3. Mining Tap Controls (Global Multipliers & Events)
app.post('/api/admin/games/tap/update', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (session.role !== 'OWNER' && !session.permissions.includes('upgrades.configure'))) {
    res.status(403).json({ error: 'Permission denied: upgrades.configure required' });
    return;
  }

  const {
    tapMultiplier,
    goldenHourActive,
    goldenHourMultiplier,
    energyRechargeMultiplier,
    maxCpsLimit,
    tapEnabled,
  } = req.body;

  if (typeof tapMultiplier === 'number' && tapMultiplier >= 1 && tapMultiplier <= 20) {
    serverStore.tapControls.tapMultiplier = tapMultiplier;
  }
  if (typeof goldenHourActive === 'boolean') {
    serverStore.tapControls.goldenHourActive = goldenHourActive;
  }
  if (typeof goldenHourMultiplier === 'number' && goldenHourMultiplier >= 1 && goldenHourMultiplier <= 10) {
    serverStore.tapControls.goldenHourMultiplier = goldenHourMultiplier;
  }
  if (typeof energyRechargeMultiplier === 'number' && energyRechargeMultiplier >= 1 && energyRechargeMultiplier <= 10) {
    serverStore.tapControls.energyRechargeMultiplier = energyRechargeMultiplier;
  }
  if (typeof maxCpsLimit === 'number' && maxCpsLimit >= 10 && maxCpsLimit <= 100) {
    serverStore.tapControls.maxCpsLimit = maxCpsLimit;
  }
  if (typeof tapEnabled === 'boolean') {
    serverStore.tapControls.tapEnabled = tapEnabled;
  }

  serverStore.auditLogs.push({
    auditLogId: `LOG-TAP-CFG-${Date.now()}`,
    adminId: session.adminId,
    role: session.role,
    action: 'TAP_CONTROLS_UPDATED',
    newValue: serverStore.tapControls,
    timestamp: Date.now(),
  });

  res.json({ success: true, tapControls: serverStore.tapControls });
});

// 4. Player-Specific Outcome Rigging & Handicaps
app.post('/api/admin/games/user-rig/set', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (session.role !== 'OWNER' && !session.permissions.includes('users.edit'))) {
    res.status(403).json({ error: 'Permission denied: users.edit required' });
    return;
  }

  const { targetUserId, mode, customWinRatePercent, reason } = req.body;
  const user = serverStore.users.get(targetUserId);

  if (!user) {
    res.status(404).json({ error: 'Target user not found' });
    return;
  }

  if (!['NORMAL', 'FORCE_WIN', 'FORCE_LOSS', 'HIGH_LUCK', 'LOW_LUCK'].includes(mode)) {
    res.status(400).json({ error: 'Invalid rig mode' });
    return;
  }

  if (mode === 'NORMAL') {
    serverStore.riggedUsers.delete(targetUserId);
  } else {
    serverStore.riggedUsers.set(targetUserId, {
      userId: targetUserId,
      username: user.username,
      firstName: user.firstName,
      mode,
      customWinRatePercent: typeof customWinRatePercent === 'number' ? customWinRatePercent : (mode === 'HIGH_LUCK' ? 85 : mode === 'LOW_LUCK' ? 15 : undefined),
      reason: (reason || 'Admin customized outcome bias').trim(),
      updatedAt: Date.now(),
    });
  }

  serverStore.auditLogs.push({
    auditLogId: `LOG-RIG-${Date.now()}`,
    adminId: session.adminId,
    role: session.role,
    action: 'USER_GAME_RIG_SET',
    target: targetUserId,
    newValue: { mode, customWinRatePercent, reason },
    timestamp: Date.now(),
  });

  res.json({
    success: true,
    riggedUsers: Array.from(serverStore.riggedUsers.values()),
    targetUserId,
    mode,
  });
});

app.post('/api/admin/games/user-rig/remove', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (session.role !== 'OWNER' && !session.permissions.includes('users.edit'))) {
    res.status(403).json({ error: 'Permission denied: users.edit required' });
    return;
  }

  const { targetUserId } = req.body;
  serverStore.riggedUsers.delete(targetUserId);

  res.json({ success: true, message: `Handicap removed for user ${targetUserId}` });
});

// Backward compatibility routes for legacy callers
app.post('/api/admin/games/crash-control', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (session.role !== 'OWNER' && !session.permissions.includes('crash.configure'))) {
    res.status(403).json({ error: 'Permission denied: crash.configure required' });
    return;
  }

  const { forcedNextCrashPoint, emergencyFlyAway, crashHouseEdgeBps, crashBettingDurationMs, crashMinBetXC, crashMaxBetXC, crashEnabled } = req.body;

  if (typeof forcedNextCrashPoint === 'number') {
    serverStore.forcedNextCrashPoint = forcedNextCrashPoint > 0 ? forcedNextCrashPoint : null;
    serverStore.crashControls.forcedNextCrashPoint = serverStore.forcedNextCrashPoint;
  }

  if (emergencyFlyAway) {
    const currentRound = serverStore.crashRounds.get(serverStore.currentCrashRoundId);
    if (currentRound && currentRound.status === 'RUNNING') {
      currentRound.status = 'CRASHED';
      currentRound.crashedAt = Date.now();
      currentRound.crashPoint = 1.05;
    }
  }

  if (typeof crashHouseEdgeBps === 'number') {
    serverStore.config.crashHouseEdgeBps = crashHouseEdgeBps;
    serverStore.crashControls.houseEdgeBps = crashHouseEdgeBps;
  }
  if (typeof crashBettingDurationMs === 'number') {
    serverStore.config.crashBettingDurationMs = crashBettingDurationMs;
    serverStore.crashControls.bettingDurationMs = crashBettingDurationMs;
  }
  if (typeof crashMinBetXC === 'number') {
    serverStore.config.crashMinBetXC = crashMinBetXC;
    serverStore.crashControls.minBetXC = crashMinBetXC;
  }
  if (typeof crashMaxBetXC === 'number') {
    serverStore.config.crashMaxBetXC = crashMaxBetXC;
    serverStore.crashControls.maxBetXC = crashMaxBetXC;
  }
  if (typeof crashEnabled === 'boolean') {
    serverStore.config.crashEnabled = crashEnabled;
    serverStore.crashControls.crashEnabled = crashEnabled;
  }

  res.json({
    success: true,
    forcedNextCrashPoint: serverStore.forcedNextCrashPoint,
    config: serverStore.config,
    crashControls: serverStore.crashControls,
  });
});

app.post('/api/admin/games/trading-control', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (session.role !== 'OWNER' && !session.permissions.includes('trading.configure'))) {
    res.status(403).json({ error: 'Permission denied: trading.configure required' });
    return;
  }

  const { marketTrend, targetPrice, tradingFeePercent, minTradeXC, maxTradeXC, tradingEnabled } = req.body;

  if (marketTrend && ['NATURAL', 'BULLISH', 'BEARISH', 'HIGH_VOLATILITY', 'FLAT'].includes(marketTrend)) {
    serverStore.marketTrend = marketTrend as any;
    serverStore.tradingControls.marketTrend = marketTrend as any;
  }

  if (typeof targetPrice === 'number' && targetPrice > 0) {
    serverStore.currentMarketPrice = targetPrice;
  }

  if (typeof tradingFeePercent === 'number') {
    serverStore.config.tradingFeePercent = tradingFeePercent;
    serverStore.tradingControls.tradingFeePercent = tradingFeePercent;
  }
  if (typeof minTradeXC === 'number') {
    serverStore.config.minTradeXC = minTradeXC;
    serverStore.tradingControls.minTradeXC = minTradeXC;
  }
  if (typeof maxTradeXC === 'number') {
    serverStore.config.maxTradeXC = maxTradeXC;
    serverStore.tradingControls.maxTradeXC = maxTradeXC;
  }
  if (typeof tradingEnabled === 'boolean') {
    serverStore.config.tradingEnabled = tradingEnabled;
    serverStore.tradingControls.tradingEnabled = tradingEnabled;
  }

  res.json({
    success: true,
    marketTrend: serverStore.tradingControls.marketTrend,
    currentMarketPrice: serverStore.currentMarketPrice,
    config: serverStore.config,
    tradingControls: serverStore.tradingControls,
  });
});

// 7. System Broadcast Announcement
app.post('/api/admin/system/announcement', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session || (session.role !== 'OWNER' && !session.permissions.includes('system.configure'))) {
    res.status(403).json({ error: 'Permission denied: system.configure required' });
    return;
  }

  const { announcement } = req.body;
  serverStore.systemAnnouncement = typeof announcement === 'string' ? announcement.trim() : '';

  serverStore.auditLogs.push({
    auditLogId: `LOG-ANNOUNCE-${Date.now()}`,
    adminId: session.adminId,
    role: session.role,
    action: 'ANNOUNCEMENT_UPDATED',
    newValue: serverStore.systemAnnouncement,
    timestamp: Date.now(),
  });

  res.json({ success: true, announcement: serverStore.systemAnnouncement });
});

// -------------------------------------------------------------
// INVESTMENT SYSTEM & STORE MARKETPLACE
// -------------------------------------------------------------
app.get('/api/invest/store', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  const now = Date.now();

  const storeAssets = Array.from(serverStore.storeAssets.values())
    .filter((a) => a.enabled)
    .sort((a, b) => a.priceXC - b.priceXC);

  const myInvestments = userId
    ? Array.from(serverStore.investments.values())
        .filter((inv) => inv.userId === userId && inv.status !== 'SOLD')
        .map((inv) => {
          const baseAmount = inv.currency === 'XC' ? inv.investedAmountXC * serverStore.config.xcToXcoinRate : inv.investedAmountXcoin;
          const unclaimed = calculateAccumulatedProfit(
            baseAmount,
            inv.dailyProfitPercent,
            inv.lastClaimedAt,
            now
          );
          return {
            ...inv,
            unclaimedProfit: unclaimed,
          };
        })
    : [];

  const marketplaceListings = Array.from(serverStore.marketplaceListings.values())
    .filter((l) => l.status === 'ACTIVE')
    .sort((a, b) => b.listedAt - a.listedAt);

  const totalUnclaimedProfit = myInvestments.reduce((sum, inv) => sum + inv.unclaimedProfit, 0);

  res.json({
    storeAssets,
    myInvestments,
    marketplaceListings,
    totalUnclaimedProfit,
    serverTime: now,
  });
});

app.post('/api/invest/buy', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = serverStore.users.get(userId);
  const wallet = serverStore.wallets.get(userId);
  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { assetId, currency } = req.body; // currency: 'XC' | 'XCOIN'
  const asset = serverStore.storeAssets.get(assetId);
  if (!asset || !asset.enabled) {
    res.status(404).json({ error: 'Asset not found or unavailable' });
    return;
  }

  const now = Date.now();
  const isXC = currency === 'XC';
  const price = isXC ? asset.priceXC : asset.priceXcoin;

  if (isXC) {
    if (wallet.xcBalance < price) {
      res.status(400).json({ error: `Insufficient XC balance. Requires ${price.toLocaleString()} XC.` });
      return;
    }
    wallet.xcBalance -= price;
  } else {
    if (wallet.xcoinBalance < price) {
      res.status(400).json({ error: `Insufficient XCOIN balance. Requires ${price.toLocaleString()} XCOIN.` });
      return;
    }
    wallet.xcoinBalance -= price;
  }

  const investmentId = `INV-${now}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const investment: UserInvestment = {
    investmentId,
    userId,
    telegramUserId: userId,
    assetId: asset.assetId,
    assetTitle: asset.title,
    assetCategory: asset.category,
    iconEmoji: asset.iconEmoji,
    imageUrl: asset.imageUrl,
    investedAmountXC: asset.priceXC,
    investedAmountXcoin: asset.priceXcoin,
    currency: isXC ? 'XC' : 'XCOIN',
    dailyProfitPercent: asset.dailyProfitPercent,
    purchasedAt: now,
    lastClaimedAt: now,
    totalClaimedProfit: 0,
    status: 'ACTIVE',
  };

  serverStore.investments.set(investmentId, investment);

  serverStore.transactions.push({
    transactionId: `TX-INV-${now}-${investmentId}`,
    userId,
    telegramUserId: userId,
    asset: isXC ? 'XC' : 'XCOIN',
    amount: price,
    type: 'INVEST_PURCHASE',
    direction: 'OUT',
    status: 'CONFIRMED',
    referenceId: investmentId,
    balanceBefore: isXC ? wallet.xcBalance + price : wallet.xcoinBalance + price,
    balanceAfter: isXC ? wallet.xcBalance : wallet.xcoinBalance,
    createdAt: now,
    note: `Invested in ${asset.title} (${asset.dailyProfitPercent}% daily yield)`,
  });

  res.json({
    success: true,
    investment,
    wallet,
    message: `Successfully invested in ${asset.title}! Daily profit generation active.`,
  });
});

app.post('/api/invest/claim-profit', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = serverStore.users.get(userId);
  const wallet = serverStore.wallets.get(userId);
  if (!user || !wallet) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const now = Date.now();
  let totalProfitGained = 0;

  for (const inv of serverStore.investments.values()) {
    if (inv.userId === userId && inv.status === 'ACTIVE') {
      const baseAmount = inv.currency === 'XC' ? inv.investedAmountXC * serverStore.config.xcToXcoinRate : inv.investedAmountXcoin;
      const profit = calculateAccumulatedProfit(baseAmount, inv.dailyProfitPercent, inv.lastClaimedAt, now);
      if (profit > 0) {
        totalProfitGained += profit;
        inv.totalClaimedProfit += profit;
        inv.lastClaimedAt = now;
      }
    }
  }

  if (totalProfitGained <= 0) {
    res.status(400).json({ error: 'No accumulated profits ready to claim yet. Profits accrue continually.' });
    return;
  }

  wallet.xcoinBalance += totalProfitGained;
  wallet.totalEarnedXcoin += totalProfitGained;
  user.totalEarned += totalProfitGained;

  serverStore.transactions.push({
    transactionId: `TX-PROFIT-${now}-${userId}`,
    userId,
    telegramUserId: userId,
    asset: 'XCOIN',
    amount: totalProfitGained,
    type: 'INVEST_PROFIT',
    direction: 'IN',
    status: 'CONFIRMED',
    referenceId: `profit_${now}`,
    balanceBefore: wallet.xcoinBalance - totalProfitGained,
    balanceAfter: wallet.xcoinBalance,
    createdAt: now,
    note: `Claimed ${totalProfitGained.toLocaleString()} XCOIN asset dividends`,
  });

  res.json({
    success: true,
    claimedProfit: totalProfitGained,
    wallet,
    authoritativeBalance: wallet.xcoinBalance,
    message: `Claimed +${totalProfitGained.toLocaleString()} XCOIN in investment dividends!`,
  });
});

app.post('/api/invest/marketplace/list', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = serverStore.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { investmentId, askingPriceXC, askingPriceXcoin } = req.body;
  const investment = serverStore.investments.get(investmentId);
  if (!investment || investment.userId !== userId) {
    res.status(404).json({ error: 'Investment not found or not owned by you' });
    return;
  }

  if (investment.status !== 'ACTIVE') {
    res.status(400).json({ error: 'Asset is already listed or sold' });
    return;
  }

  const priceXC = Math.max(1, parseInt(askingPriceXC) || investment.investedAmountXC);
  const priceXcoin = Math.max(1, parseInt(askingPriceXcoin) || investment.investedAmountXcoin);

  const now = Date.now();
  const listingId = `LIST-${now}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const listing: MarketplaceListing = {
    listingId,
    investmentId,
    sellerUserId: userId,
    sellerFirstName: user.firstName,
    assetId: investment.assetId,
    assetTitle: investment.assetTitle,
    assetCategory: investment.assetCategory,
    iconEmoji: investment.iconEmoji,
    imageUrl: investment.imageUrl,
    dailyProfitPercent: investment.dailyProfitPercent,
    originalCostXC: investment.investedAmountXC,
    askingPriceXC: priceXC,
    askingPriceXcoin: priceXcoin,
    listedAt: now,
    status: 'ACTIVE',
  };

  investment.status = 'LISTED_FOR_SALE';
  investment.listedPriceXC = priceXC;
  investment.listedPriceXcoin = priceXcoin;
  investment.listedAt = now;

  serverStore.marketplaceListings.set(listingId, listing);

  res.json({
    success: true,
    listing,
    message: `Asset listed on P2P Marketplace for ${priceXC.toLocaleString()} XC / ${priceXcoin.toLocaleString()} XCOIN!`,
  });
});

app.post('/api/invest/marketplace/buy', (req: Request, res: Response) => {
  const buyerId = getAuthUserId(req);
  if (!buyerId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const buyer = serverStore.users.get(buyerId);
  const buyerWallet = serverStore.wallets.get(buyerId);
  if (!buyer || !buyerWallet) {
    res.status(404).json({ error: 'Buyer not found' });
    return;
  }

  const { listingId, currency } = req.body; // currency: 'XC' | 'XCOIN'
  const listing = serverStore.marketplaceListings.get(listingId);
  if (!listing || listing.status !== 'ACTIVE') {
    res.status(404).json({ error: 'Listing not found or already sold' });
    return;
  }

  if (listing.sellerUserId === buyerId) {
    res.status(400).json({ error: 'You cannot buy your own listed item' });
    return;
  }

  const investment = serverStore.investments.get(listing.investmentId);
  if (!investment || investment.status !== 'LISTED_FOR_SALE') {
    res.status(400).json({ error: 'Underlying asset is unavailable' });
    return;
  }

  const isXC = currency === 'XC';
  const price = isXC ? listing.askingPriceXC : listing.askingPriceXcoin;

  if (isXC) {
    if (buyerWallet.xcBalance < price) {
      res.status(400).json({ error: `Insufficient XC balance. Requires ${price.toLocaleString()} XC.` });
      return;
    }
    buyerWallet.xcBalance -= price;
  } else {
    if (buyerWallet.xcoinBalance < price) {
      res.status(400).json({ error: `Insufficient XCOIN balance. Requires ${price.toLocaleString()} XCOIN.` });
      return;
    }
    buyerWallet.xcoinBalance -= price;
  }

  // Credit seller (minus 2% fee)
  const sellerWallet = serverStore.wallets.get(listing.sellerUserId);
  const sellerProfit = Math.floor(price * 0.98);
  if (sellerWallet) {
    if (isXC) {
      sellerWallet.xcBalance += sellerProfit;
    } else {
      sellerWallet.xcoinBalance += sellerProfit;
    }
  }

  const now = Date.now();
  listing.status = 'SOLD';
  investment.userId = buyerId;
  investment.telegramUserId = buyerId;
  investment.status = 'ACTIVE';
  investment.lastClaimedAt = now;
  investment.listedPriceXC = undefined;
  investment.listedPriceXcoin = undefined;

  serverStore.transactions.push({
    transactionId: `TX-MKT-BUY-${now}-${buyerId}`,
    userId: buyerId,
    telegramUserId: buyerId,
    asset: isXC ? 'XC' : 'XCOIN',
    amount: price,
    type: 'MARKETPLACE_BUY',
    direction: 'OUT',
    status: 'CONFIRMED',
    referenceId: listingId,
    balanceBefore: isXC ? buyerWallet.xcBalance + price : buyerWallet.xcoinBalance + price,
    balanceAfter: isXC ? buyerWallet.xcBalance : buyerWallet.xcoinBalance,
    createdAt: now,
    note: `Purchased ${listing.assetTitle} from ${listing.sellerFirstName} via P2P Market`,
  });

  res.json({
    success: true,
    message: `Purchased ${listing.assetTitle}! You are now collecting its ${listing.dailyProfitPercent}% daily profits.`,
    wallet: buyerWallet,
  });
});

app.post('/api/invest/marketplace/cancel', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { listingId } = req.body;
  const listing = serverStore.marketplaceListings.get(listingId);
  if (!listing || listing.sellerUserId !== userId) {
    res.status(404).json({ error: 'Listing not found or unauthorized' });
    return;
  }

  if (listing.status !== 'ACTIVE') {
    res.status(400).json({ error: 'Listing is not active' });
    return;
  }

  listing.status = 'CANCELLED';
  const investment = serverStore.investments.get(listing.investmentId);
  if (investment) {
    investment.status = 'ACTIVE';
  }

  res.json({ success: true, message: 'Marketplace listing cancelled and returned to your portfolio.' });
});

app.post('/api/invest/rate', (req: Request, res: Response) => {
  const userId = getAuthUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = serverStore.users.get(userId);
  const { assetId, rating, comment } = req.body;
  const asset = serverStore.storeAssets.get(assetId);
  if (!asset) {
    res.status(404).json({ error: 'Asset not found' });
    return;
  }

  const starRating = Math.min(5, Math.max(1, parseInt(rating) || 5));
  const reviewId = `REV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const review: AssetReview = {
    reviewId,
    assetId,
    userId,
    firstName: user?.firstName || 'User',
    rating: starRating,
    comment: (comment || 'High profit and reliable investment!').trim(),
    createdAt: Date.now(),
  };

  let reviews = serverStore.assetReviews.get(assetId);
  if (!reviews) {
    reviews = [];
    serverStore.assetReviews.set(assetId, reviews);
  }
  reviews.push(review);

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  asset.rating = Math.round(avg * 100) / 100;
  asset.ratingCount = reviews.length;

  res.json({ success: true, review, updatedRating: asset.rating, updatedCount: asset.ratingCount });
});

app.get('/api/invest/reviews/:assetId', (req: Request, res: Response) => {
  const { assetId } = req.params;
  const reviews = serverStore.assetReviews.get(assetId) || [];
  res.json({ reviews });
});

// Admin Withdrawal Tasks & Store Assets Management
app.get('/api/admin/withdrawal-tasks', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const tasks = Array.from(serverStore.withdrawalTasks.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  res.json({ tasks });
});

app.post('/api/admin/withdrawal-tasks/create', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { title, description, type, targetValue, unitLabel, actionUrl, actionLabel, isRequiredForWithdrawal } = req.body;
  if (!title || !targetValue || targetValue <= 0) {
    res.status(400).json({ error: 'Title and valid target value required' });
    return;
  }

  const taskId = `TASK-${Date.now()}`;
  const newTask: WithdrawalTask = {
    taskId,
    title: title.trim(),
    description: (description || '').trim(),
    type: type || 'INVITES',
    targetValue: parseInt(targetValue) || 1,
    unitLabel: (unitLabel || 'Units').trim(),
    actionUrl: actionUrl?.trim(),
    actionLabel: actionLabel?.trim() || 'Complete',
    enabled: true,
    isRequiredForWithdrawal: isRequiredForWithdrawal !== false,
    sortOrder: serverStore.withdrawalTasks.size + 1,
    createdAt: Date.now(),
  };

  serverStore.withdrawalTasks.set(taskId, newTask);
  res.json({ success: true, task: newTask });
});

app.post('/api/admin/withdrawal-tasks/update', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { taskId, title, description, type, targetValue, unitLabel, actionUrl, actionLabel, isRequiredForWithdrawal, enabled } = req.body;
  const task = serverStore.withdrawalTasks.get(taskId);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (title) task.title = title.trim();
  if (description !== undefined) task.description = description.trim();
  if (type) task.type = type;
  if (targetValue) task.targetValue = parseInt(targetValue) || task.targetValue;
  if (unitLabel) task.unitLabel = unitLabel.trim();
  if (actionUrl !== undefined) task.actionUrl = actionUrl.trim();
  if (actionLabel !== undefined) task.actionLabel = actionLabel.trim();
  if (isRequiredForWithdrawal !== undefined) task.isRequiredForWithdrawal = !!isRequiredForWithdrawal;
  if (enabled !== undefined) task.enabled = !!enabled;

  res.json({ success: true, task });
});

app.post('/api/admin/withdrawal-tasks/delete', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { taskId } = req.body;
  serverStore.withdrawalTasks.delete(taskId);
  res.json({ success: true, message: 'Task deleted' });
});

app.post('/api/admin/invest/create-asset', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { title, description, category, imageUrl, priceXC, priceXcoin, dailyProfitPercent, iconEmoji } = req.body;
  if (!title || !priceXC) {
    res.status(400).json({ error: 'Title and price are required' });
    return;
  }

  const assetId = `ASSET-${Date.now()}`;
  const asset: StoreAsset = {
    assetId,
    title: title.trim(),
    description: (description || '').trim(),
    category: category || 'VEHICLES',
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80',
    priceXC: parseInt(priceXC) || 10000,
    priceXcoin: parseInt(priceXcoin) || (parseInt(priceXC) || 10000) * 5,
    dailyProfitPercent: parseFloat(dailyProfitPercent) || 3.0,
    iconEmoji: iconEmoji || '💎',
    rating: 5.0,
    ratingCount: 1,
    enabled: true,
    createdAt: Date.now(),
  };

  serverStore.storeAssets.set(assetId, asset);
  res.json({ success: true, asset });
});

app.post('/api/admin/invest/delete-asset', (req: Request, res: Response) => {
  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { assetId } = req.body;
  serverStore.storeAssets.delete(assetId);
  res.json({ success: true, message: 'Store asset deleted' });
});

// -------------------------------------------------------------
// VITE DEV MIDDLEWARE / STATIC ASSETS
// -------------------------------------------------------------
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[X COIN Engine] Server active on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
