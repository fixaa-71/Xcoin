import { PlatformConfig, VipPlan } from '../types';

export const OWNER_TELEGRAM_ID = '8522783212';
export const DEFAULT_ADMIN_KEY = 'Sadiya123@';
export const COIN_LOGO_URL = 'https://i.ibb.co.com/9mnXfgXr/images-2.jpg';

export const FIREBASE_CLIENT_CONFIG = {
  apiKey: "AIzaSyBVY4CPyFZHPz28326R42gDl4cu9d1nn0g",
  authDomain: "x-coin-71398.firebaseapp.com",
  projectId: "x-coin-71398",
  storageBucket: "x-coin-71398.firebasestorage.app",
  messagingSenderId: "198674045130",
  appId: "1:198674045130:web:3c2e8bd3c25f8e1ed77c33",
  measurementId: "G-LH0ZWY7FH2"
};

export const DEFAULT_VIP_PLANS: VipPlan[] = [
  {
    planId: 'standard',
    name: 'Standard',
    priceUSD: 1,
    durationDays: 7,
    aiPrediction: false,
    dailyPredictionLimit: 0,
    advancedAnalytics: false,
    benefits: ['Standard VIP badge', 'Priority tap sync', 'Dedicated support'],
    enabled: true,
    sortOrder: 1,
  },
  {
    planId: 'premium',
    name: 'Premium',
    priceUSD: 3,
    durationDays: 30,
    aiPrediction: true,
    dailyPredictionLimit: 10,
    advancedAnalytics: true,
    benefits: ['AI Market Prediction (10/day)', 'Advanced trading analytics', 'Golden VIP badge', 'Faster withdrawals'],
    enabled: true,
    sortOrder: 2,
  },
  {
    planId: 'pro',
    name: 'Pro',
    priceUSD: 5,
    durationDays: 30,
    aiPrediction: true,
    dailyPredictionLimit: 25,
    advancedAnalytics: true,
    benefits: ['AI Market Prediction (25/day)', 'Real-time momentum alerts', 'Pro VIP badge', 'Reduced trading fee 1.5%'],
    enabled: true,
    sortOrder: 3,
  },
  {
    planId: 'elite',
    name: 'Elite',
    priceUSD: 10,
    durationDays: 60,
    aiPrediction: true,
    dailyPredictionLimit: 50,
    advancedAnalytics: true,
    benefits: ['AI Market Prediction (50/day)', 'Crash volatility forecast', 'Elite badge', 'Reduced trading fee 1.0%'],
    enabled: true,
    sortOrder: 4,
  },
  {
    planId: 'master',
    name: 'Master',
    priceUSD: 25,
    durationDays: 90,
    aiPrediction: true,
    dailyPredictionLimit: 100,
    advancedAnalytics: true,
    benefits: ['AI Market Prediction (100/day)', 'VIP master channel signals', 'Master badge', 'Instant withdrawal approval'],
    enabled: true,
    sortOrder: 5,
  },
  {
    planId: 'diamond',
    name: 'Diamond',
    priceUSD: 50,
    durationDays: 180,
    aiPrediction: true,
    dailyPredictionLimit: 250,
    advancedAnalytics: true,
    benefits: ['AI Market Prediction (250/day)', 'Zero fee conversions', 'Diamond sparkling badge', 'Direct owner concierge'],
    enabled: true,
    sortOrder: 6,
  },
  {
    planId: 'legend',
    name: 'Legend',
    priceUSD: 100,
    durationDays: 365,
    aiPrediction: true,
    dailyPredictionLimit: 1000,
    advancedAnalytics: true,
    benefits: ['Unlimited AI Market Predictions', 'Maximum withdrawal priority', 'Legendary obsidian badge', 'All premium perks'],
    enabled: true,
    sortOrder: 7,
  },
];

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  appName: 'X COIN',
  logoUrl: COIN_LOGO_URL,
  maintenanceMode: false,
  tradingEnabled: true,
  crashEnabled: true,
  withdrawalsEnabled: true,
  vipEnabled: true,
  referralsEnabled: true,
  adsEnabled: true,
  bonusEnabled: true,
  conversionEnabled: true,
  xcToXcoinRate: 5, // 1 XC = 5 XCOIN
  baseTapPower: 5,
  baseRechargeRate: 3, // 3 energy per second
  baseEnergyCapacity: 1000,
  tapEnergyCost: 1,
  minTradeXC: 100,
  maxTradeXC: 100000,
  tradingFeePercent: 2, // 2%
  availableExpiries: [5, 10, 30, 60, 120, 300],
  crashMinBetXC: 100,
  crashMaxBetXC: 100000,
  crashBettingDurationMs: 8000,
  crashHouseEdgeBps: 300, // 3.00%
  crashMaxBetsPerRound: 2,
  paymentEnabled: true,
  acceptedAssets: ['USDT', 'TON'],
  acceptedNetworks: {
    USDT: ['TRC20', 'BEP20', 'TON'],
    TON: ['TON-MAINNET'],
  },
  walletAddresses: {
    'USDT_TRC20': 'TYDzsYUbEmVbT91dXZuGz7bH2xKq9eQwPz',
    'USDT_BEP20': '0x71C8360144574f17c8008892410a5631BFFe6677',
    'TON_MAINNET': 'EQBvW8Z5huBkMJYdnF64A5P3VQWG169g-Up9Nq1-kY-8K7vA',
  },
  paymentTimeoutMinutes: 30,
  manualVerificationEnabled: true,
  automaticVerificationEnabled: false,
  ownerTelegramId: OWNER_TELEGRAM_ID,
};

export const DAILY_BONUS_REWARDS = [500, 1000, 2500, 5000, 10000, 25000, 50000]; // 7 days in XCOIN
