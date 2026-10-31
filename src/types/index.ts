export type UserStatus = 'ACTIVE' | 'RESTRICTED' | 'FROZEN';

export type VipTier = 'FREE' | 'Standard' | 'Premium' | 'Pro' | 'Elite' | 'Master' | 'Diamond' | 'Legend';

export interface UserProfile {
  telegramUserId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  languageCode?: string;
  createdAt: number;
  lastSeenAt: number;
  status: UserStatus;
  vipTier: VipTier;
  vipStatus?: 'ACTIVE' | 'EXPIRED' | 'NONE';
  vipExpiresAt?: number;
  vipStartedAt?: number;
  vipPaymentOrderId?: string;
  referralCode: string;
  referredBy?: string;
  totalEarned: number;
  totalTradingVolume: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  tapPower: number;
  rechargePower: number;
  energy: number;
  energyCapacity: number;
  lastEnergyUpdate: number;
  createdFrom: string;
  updatedAt: number;
  securityVersion: number;
  trustedDeviceId?: string;
}

export interface UserWallet {
  xcoinBalance: number;
  xcBalance: number;
  pendingWithdrawalXcoin: number;
  totalEarnedXcoin: number;
  lastUpdated: number;
}

export type TransactionType =
  | 'TAP_REWARD'
  | 'BONUS'
  | 'REFERRAL'
  | 'UPGRADE'
  | 'CONVERSION'
  | 'TRADE_ENTRY'
  | 'TRADE_WIN'
  | 'TRADE_LOSS'
  | 'TRADING_FEE'
  | 'WITHDRAWAL'
  | 'WITHDRAWAL_FEE'
  | 'VIP_PAYMENT'
  | 'PROMOTION'
  | 'AD_REWARD'
  | 'ADMIN_ADJUSTMENT'
  | 'CRASH_BET'
  | 'CRASH_PAYOUT'
  | 'CRASH_REFUND'
  | 'SECURITY_CONFISCATION'
  | 'INVEST_PURCHASE'
  | 'INVEST_PROFIT'
  | 'MARKETPLACE_SALE'
  | 'MARKETPLACE_BUY';

export interface WalletTransaction {
  transactionId: string;
  userId: string;
  telegramUserId: string;
  asset: 'XCOIN' | 'XC' | 'USDT' | 'TON';
  amount: number;
  type: TransactionType;
  direction: 'IN' | 'OUT';
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REJECTED';
  referenceId: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: number;
  note?: string;
}

export type TradeDirection = 'UP' | 'DOWN';
export type TradeStatus = 'OPEN' | 'SETTLED' | 'CANCELLED' | 'REJECTED';

export interface TradeRecord {
  tradeId: string;
  telegramUserId: string;
  amountXC: number;
  asset?: string;
  direction: TradeDirection;
  expirySeconds: number;
  openedAt: number;
  expiresAt: number;
  entryPrice: number;
  settlementPrice?: number;
  outcome?: 'WIN' | 'LOSS' | 'DRAW';
  result?: number; // payout delta
  payout?: number;
  fee: number;
  status: TradeStatus;
  serverSequence: number;
  createdAt: number;
  settledAt?: number;
}

export type CrashRoundStatus = 'WAITING' | 'BETTING' | 'RUNNING' | 'CRASHED' | 'SETTLED';

export interface CrashRound {
  roundId: string;
  status: CrashRoundStatus;
  createdAt: number;
  bettingStartedAt: number;
  runningAt: number;
  crashedAt: number;
  settledAt: number;
  serverTimeStart: number;
  serverTimeEnd: number;
  serverSeedHash: string;
  serverSeed?: string; // Revealed after settled
  serverSeedRevealStatus: boolean;
  nonce: number;
  crashPoint: number;
  algorithmVersion: string;
  configVersion: number;
  totalBetVolume: number;
  totalPayoutVolume: number;
  playerCount: number;
  createdBy: 'SYSTEM';
}

export type CrashBetStatus = 'PENDING' | 'ACTIVE' | 'CASHED_OUT' | 'LOST' | 'CANCELLED';

export interface CrashBet {
  betId: string;
  roundId: string;
  userId: string;
  telegramUserId: string;
  asset: 'XC';
  betAmount: number;
  autoCashoutMultiplier?: number;
  status: CrashBetStatus;
  cashoutMultiplier?: number;
  payoutAmount: number;
  profitLoss: number;
  placedAt: number;
  cashoutAt?: number;
  settledAt?: number;
  requestId: string;
  deviceSessionId?: string;
  riskScore?: number;
}

export interface VipPlan {
  planId: string;
  name: VipTier;
  priceUSD: number;
  durationDays: number;
  aiPrediction: boolean;
  dailyPredictionLimit: number;
  advancedAnalytics: boolean;
  benefits: string[];
  enabled: boolean;
  sortOrder: number;
}

export type PaymentOrderStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export interface PaymentOrder {
  orderId: string;
  userId: string;
  telegramUserId: string;
  planId: string;
  planName: string;
  priceUSD: number;
  asset: 'USDT' | 'TON';
  network: string;
  expectedAmount: number;
  paymentAddress: string;
  status: PaymentOrderStatus;
  createdAt: number;
  expiresAt: number;
  txid?: string;
  submittedAt?: number;
  verifiedAt?: number;
  verifiedBy?: string;
  rejectionReason?: string;
}

export type WithdrawalStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

export interface WithdrawalRequest {
  withdrawalId: string;
  telegramUserId: string;
  asset: 'XCOIN';
  destinationType: 'USDT' | 'TON';
  destinationAddress: string;
  network: string;
  amountXcoin: number;
  platformFeeXcoin: number;
  networkFeeXcoin: number;
  netAmountXcoin: number;
  status: WithdrawalStatus;
  createdAt: number;
  updatedAt: number;
  reviewedBy?: string;
  rejectionReason?: string;
  txHash?: string;
}

export interface PromotionItem {
  promotionId: string;
  ownerTelegramId: string;
  title: string;
  link: string;
  description: string;
  targetMembers: number;
  priceXcoin: number;
  durationDays: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  createdAt: number;
  expiresAt: number;
}

export interface DailyBonusStreak {
  currentDay: number;
  streak: number;
  lastClaimAt: number;
  claimedDays: number[];
}

export interface AiMarketPrediction {
  predictionId: string;
  createdAt: number;
  marketSnapshot: {
    asset: string;
    currentPrice: number;
    momentum: string;
    volatility: string;
    trend: string;
    volume24h: number;
  };
  expirySeconds: number;
  prediction: 'UP' | 'DOWN';
  confidence: number;
  actualOutcome?: 'UP' | 'DOWN';
  correct?: boolean;
  modelVersion: string;
  vipTierAtPrediction: string;
}

export type AdminRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'SUPPORT';

export interface AdminKeyRecord {
  keyId: string;
  name: string;
  description: string;
  keyHash: string;
  role: AdminRole;
  permissions: string[];
  expiration: number;
  status: 'ACTIVE' | 'DISABLED' | 'REVOKED' | 'EXPIRED';
  createdAt: number;
  createdBy: string;
}

export interface AuditLog {
  auditLogId: string;
  adminId: string;
  adminTelegramId?: string;
  role: string;
  action: string;
  permission?: string;
  target?: string;
  oldValue?: any;
  newValue?: any;
  timestamp: number;
  sessionId?: string;
  reason?: string;
  referenceId?: string;
}

export interface SecurityEvent {
  eventId: string;
  type: string;
  telegramUserId?: string;
  deviceId?: string;
  trustedDeviceId?: string;
  riskScore: number;
  details: string;
  timestamp: number;
  status: 'NEW' | 'REVIEWED' | 'RESOLVED';
}

export interface PlatformConfig {
  appName: string;
  logoUrl: string;
  maintenanceMode: boolean;
  tradingEnabled: boolean;
  crashEnabled: boolean;
  withdrawalsEnabled: boolean;
  vipEnabled: boolean;
  referralsEnabled: boolean;
  adsEnabled: boolean;
  bonusEnabled: boolean;
  conversionEnabled: boolean;
  xcToXcoinRate: number; // e.g. 1 XC = 5 XCOIN
  // Tap config
  baseTapPower: number;
  baseRechargeRate: number; // energy per second
  baseEnergyCapacity: number;
  tapEnergyCost: number;
  // Trading config
  minTradeXC: number;
  maxTradeXC: number;
  tradingFeePercent: number; // e.g. 2%
  availableExpiries: number[]; // [5, 10, 30, 60, 120, 300]
  // Crash config
  crashMinBetXC: number;
  crashMaxBetXC: number;
  crashBettingDurationMs: number;
  crashHouseEdgeBps: number; // e.g. 300 for 3%
  crashMaxBetsPerRound: number;
  // VIP Payment config
  paymentEnabled: boolean;
  acceptedAssets: string[];
  acceptedNetworks: Record<string, string[]>;
  walletAddresses: Record<string, string>; // e.g. "USDT_TRC20": "TYDzsYUbEm..."
  paymentTimeoutMinutes: number;
  manualVerificationEnabled: boolean;
  automaticVerificationEnabled: boolean;
  // Owner info
  ownerTelegramId: string;
}

// -------------------------------------------------------------
// WITHDRAWAL TASKS & PREREQUISITES
// -------------------------------------------------------------
export type WithdrawalTaskType = 'INVITES' | 'TRADING_VOLUME' | 'TAP_COUNT' | 'CUSTOM_LINK';

export interface WithdrawalTask {
  taskId: string;
  title: string;
  description: string;
  type: WithdrawalTaskType;
  targetValue: number; // e.g. 15 for 15 invites, 50000 for 50k XC trading volume
  unitLabel: string; // e.g. "Invites", "XC Trading", "Taps", "Link"
  actionUrl?: string; // e.g. "friends", "trade", "tap", or external "https://t.me/..."
  actionLabel?: string; // e.g. "Invite Friends", "Start Trading", "Complete"
  enabled: boolean;
  isRequiredForWithdrawal: boolean;
  sortOrder: number;
  createdAt: number;
}

export interface UserWithdrawalTaskProgress {
  taskId: string;
  currentValue: number;
  targetValue: number;
  percentage: number;
  isCompleted: boolean;
  task: WithdrawalTask;
}

export interface WithdrawalEligibilityResult {
  isEligible: boolean;
  totalRequired: number;
  totalCompleted: number;
  tasks: UserWithdrawalTaskProgress[];
}

// -------------------------------------------------------------
// INVESTMENT SYSTEM & STORE MARKETPLACE
// -------------------------------------------------------------
export type StoreAssetCategory = 'VEHICLES' | 'SOCIAL_GIFTS' | 'REAL_ESTATE_MINING';

export interface StoreAsset {
  assetId: string;
  title: string;
  description: string;
  category: StoreAssetCategory;
  imageUrl: string;
  priceXC: number;
  priceXcoin: number;
  dailyProfitPercent: number; // e.g. 3.5 = 3.5% daily return
  iconEmoji: string;
  rating: number; // e.g. 4.9
  ratingCount: number;
  enabled: boolean;
  createdAt: number;
}

export interface UserInvestment {
  investmentId: string;
  userId: string;
  telegramUserId: string;
  assetId: string;
  assetTitle: string;
  assetCategory: StoreAssetCategory;
  iconEmoji: string;
  imageUrl: string;
  investedAmountXC: number;
  investedAmountXcoin: number;
  currency: 'XC' | 'XCOIN';
  dailyProfitPercent: number;
  purchasedAt: number;
  lastClaimedAt: number;
  totalClaimedProfit: number;
  status: 'ACTIVE' | 'LISTED_FOR_SALE' | 'SOLD';
  listedPriceXC?: number;
  listedPriceXcoin?: number;
  listedAt?: number;
}

export interface AssetReview {
  reviewId: string;
  assetId: string;
  userId: string;
  firstName: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: number;
}

export interface MarketplaceListing {
  listingId: string;
  investmentId: string;
  sellerUserId: string;
  sellerFirstName: string;
  assetId: string;
  assetTitle: string;
  assetCategory: StoreAssetCategory;
  iconEmoji: string;
  imageUrl: string;
  dailyProfitPercent: number;
  originalCostXC: number;
  askingPriceXC: number;
  askingPriceXcoin: number;
  listedAt: number;
  status: 'ACTIVE' | 'SOLD' | 'CANCELLED';
}

// -------------------------------------------------------------
// ADVANCED GAME CONTROL & TELEMETRY SUITE
// -------------------------------------------------------------
export type TradingOutcomeMode = 'NATURAL' | 'FORCE_ALL_WIN' | 'FORCE_ALL_LOSS' | 'HOUSE_BIAS';
export type MarketTrendMode = 'NATURAL' | 'BULLISH' | 'BEARISH' | 'HIGH_VOLATILITY' | 'FLAT';
export type UserGameRigMode = 'NORMAL' | 'FORCE_WIN' | 'FORCE_LOSS' | 'HIGH_LUCK' | 'LOW_LUCK';

export interface GameRiggedUser {
  userId: string;
  username?: string;
  firstName?: string;
  mode: UserGameRigMode;
  customWinRatePercent?: number; // e.g. 90 = 90% win rate
  reason?: string;
  updatedAt: number;
}

export interface TapGameControls {
  tapMultiplier: number; // 1x, 2x, 5x, 10x
  goldenHourActive: boolean;
  goldenHourMultiplier: number;
  energyRechargeMultiplier: number; // 1x to 5x
  maxCpsLimit: number; // e.g. 25 taps/sec
  tapEnabled: boolean;
}

export interface CrashGameControls {
  forcedNextCrashPoint: number | null;
  presetSequence: number[];
  instantBustTrapActive: boolean;
  houseEdgeBps: number;
  bettingDurationMs: number;
  minBetXC: number;
  maxBetXC: number;
  crashEnabled: boolean;
  botSimulationEnabled: boolean;
  botCountMin: number;
  botCountMax: number;
}

export interface TradingGameControls {
  marketTrend: MarketTrendMode;
  outcomeMode: TradingOutcomeMode;
  payoutPercent: number; // default 90% profit
  tradingFeePercent: number; // default 2%
  minTradeXC: number;
  maxTradeXC: number;
  volatilityMultiplier: number;
  tradingEnabled: boolean;
}

export interface GameTelemetry {
  totalHouseProfitXC: number;
  totalTradingVolumeXC: number;
  totalCrashBetVolumeXC: number;
  totalCrashPayoutVolumeXC: number;
  activeCrashRoundId: string;
  activeCrashRoundStatus: string;
  activeCrashPlayerCount: number;
  activeCrashBetVolume: number;
  activeOpenTradesCount: number;
  activeOpenTradesVolume: number;
  marketPrice: number;
}

