import { VipPlan, VipTier } from '../types';

export interface VipStatusInfo {
  isActive: boolean;
  isExpired: boolean;
  remainingDays: number;
  remainingHours: number;
  displayText: string;
  canAccessAiPrediction: boolean;
  dailyPredictionLimit: number;
}

/**
 * Computes VIP status, remaining time, and AI prediction capability against server timestamp.
 * Server time is strictly authoritative.
 */
export function computeVipStatus(
  vipTier: VipTier,
  vipStatus: 'ACTIVE' | 'EXPIRED' | 'NONE' | undefined,
  vipExpiresAt: number | undefined,
  plan: VipPlan | undefined,
  serverTime: number = Date.now()
): VipStatusInfo {
  if (!vipTier || vipTier === 'FREE' || !vipExpiresAt || vipStatus !== 'ACTIVE') {
    return {
      isActive: false,
      isExpired: vipStatus === 'EXPIRED',
      remainingDays: 0,
      remainingHours: 0,
      displayText: 'No active VIP',
      canAccessAiPrediction: false,
      dailyPredictionLimit: 0,
    };
  }

  const remainingMs = vipExpiresAt - serverTime;

  if (remainingMs <= 0) {
    return {
      isActive: false,
      isExpired: true,
      remainingDays: 0,
      remainingHours: 0,
      displayText: 'Expired',
      canAccessAiPrediction: false,
      dailyPredictionLimit: 0,
    };
  }

  const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

  let displayText = '';
  if (remainingDays > 1) {
    displayText = `${remainingDays} Days Remaining`;
  } else if (remainingHours > 1) {
    displayText = `${remainingHours} Hours Remaining`;
  } else {
    displayText = 'Less than 1 hour remaining';
  }

  const canAccessAiPrediction = Boolean(plan?.aiPrediction && plan?.enabled);
  const dailyPredictionLimit = plan?.dailyPredictionLimit || 0;

  return {
    isActive: true,
    isExpired: false,
    remainingDays,
    remainingHours,
    displayText,
    canAccessAiPrediction,
    dailyPredictionLimit,
  };
}

/**
 * Computes new expiration time on purchase or renewal.
 * Supports EXTEND and REPLACE policies.
 */
export function computeNewVipExpiry(
  currentExpiresAt: number | undefined,
  durationDays: number,
  mode: 'EXTEND' | 'REPLACE' = 'EXTEND',
  serverTime: number = Date.now()
): { newStartedAt: number; newExpiresAt: number } {
  const durationMs = durationDays * 24 * 60 * 60 * 1000;

  if (mode === 'EXTEND' && currentExpiresAt && currentExpiresAt > serverTime) {
    return {
      newStartedAt: serverTime,
      newExpiresAt: currentExpiresAt + durationMs,
    };
  }

  return {
    newStartedAt: serverTime,
    newExpiresAt: serverTime + durationMs,
  };
}
