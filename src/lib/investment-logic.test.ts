import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAccumulatedProfit,
  calculateDailyProfit,
  validateMarketplaceListingPrice,
} from './investment-logic';

test('daily profit calculation produces expected amount', () => {
  // 100,000 XCOIN invested with 4% daily yield = 4,000 XCOIN daily
  const daily = calculateDailyProfit(100000, 4);
  assert.equal(daily, 4000);

  // 25,000 XC invested with 3.5% daily yield = 875 XC daily
  const daily2 = calculateDailyProfit(25000, 3.5);
  assert.equal(daily2, 875);
});

test('accumulated profit scales accurately over elapsed time', () => {
  const invested = 100000;
  const dailyRate = 4; // 4% = 4000 per 24 hours
  const baseTime = 1000000;

  // 12 hours later (half day) = 2000
  const halfDay = baseTime + 12 * 60 * 60 * 1000;
  const profitHalf = calculateAccumulatedProfit(invested, dailyRate, baseTime, halfDay);
  assert.equal(profitHalf, 2000);

  // 24 hours later = 4000
  const fullDay = baseTime + 24 * 60 * 60 * 1000;
  const profitFull = calculateAccumulatedProfit(invested, dailyRate, baseTime, fullDay);
  assert.equal(profitFull, 4000);

  // 48 hours later = 8000
  const twoDays = baseTime + 48 * 60 * 60 * 1000;
  const profitTwoDays = calculateAccumulatedProfit(invested, dailyRate, baseTime, twoDays);
  assert.equal(profitTwoDays, 8000);
});

test('marketplace listing price validation guards against negative and extreme values', () => {
  const originalCost = 50000;

  // Invalid: zero or negative
  assert.equal(validateMarketplaceListingPrice(originalCost, 0).isValid, false);
  assert.equal(validateMarketplaceListingPrice(originalCost, -100).isValid, false);

  // Too low (below 20% of 50000 = 10000)
  assert.equal(validateMarketplaceListingPrice(originalCost, 5000).isValid, false);

  // Valid price (30,000 or 75,000)
  assert.equal(validateMarketplaceListingPrice(originalCost, 30000).isValid, true);
  assert.equal(validateMarketplaceListingPrice(originalCost, 75000).isValid, true);

  // Too high (exceeding 500% = 250000)
  assert.equal(validateMarketplaceListingPrice(originalCost, 300000).isValid, false);
});
