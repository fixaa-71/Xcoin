import test from 'node:test';
import assert from 'node:assert/strict';
import { computeVipStatus, computeNewVipExpiry } from './vip-logic';
import { VipPlan } from '../types';

test('computeVipStatus marks expired when serverTime exceeds vipExpiresAt', () => {
  const plan: VipPlan = {
    planId: 'premium',
    name: 'Premium',
    priceUSD: 3,
    durationDays: 30,
    aiPrediction: true,
    dailyPredictionLimit: 10,
    advancedAnalytics: true,
    benefits: [],
    enabled: true,
    sortOrder: 1,
  };

  const now = 1000000000000;
  const expiredTime = now - 1000;

  const expiredStatus = computeVipStatus('Premium', 'ACTIVE', expiredTime, plan, now);
  assert.equal(expiredStatus.isActive, false);
  assert.equal(expiredStatus.isExpired, true);
  assert.equal(expiredStatus.canAccessAiPrediction, false);

  const activeTime = now + 15 * 24 * 60 * 60 * 1000; // 15 days ahead
  const activeStatus = computeVipStatus('Premium', 'ACTIVE', activeTime, plan, now);
  assert.equal(activeStatus.isActive, true);
  assert.equal(activeStatus.isExpired, false);
  assert.equal(activeStatus.remainingDays, 15);
  assert.equal(activeStatus.canAccessAiPrediction, true);
  assert.equal(activeStatus.dailyPredictionLimit, 10);
});

test('computeNewVipExpiry properly extends existing duration on EXTEND renewal mode', () => {
  const now = 1000000000000;
  const currentExpiry = now + 5 * 24 * 60 * 60 * 1000; // 5 days left
  const durationDays = 30;

  const { newExpiresAt } = computeNewVipExpiry(currentExpiry, durationDays, 'EXTEND', now);
  // Should be currentExpiry + 30 days = 35 days from now
  const expected = currentExpiry + 30 * 24 * 60 * 60 * 1000;
  assert.equal(newExpiresAt, expected);
});
