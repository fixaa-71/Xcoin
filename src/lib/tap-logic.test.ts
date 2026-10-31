import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRechargedEnergy, processTapBatch, getUpgradeInfo } from './tap-logic';

test('energy recharge accumulates properly over elapsed time up to capacity', () => {
  const now = Date.now();
  const state = {
    currentEnergy: 100,
    capacity: 1000,
    rechargeRate: 5, // 5 per sec
    lastEnergyUpdate: now - 10000, // 10s ago
  };

  const recharged = calculateRechargedEnergy(state, now);
  // 100 + (10 * 5) = 150
  assert.equal(recharged, 150);

  // When past capacity, caps at capacity
  const pastCapacityState = {
    ...state,
    lastEnergyUpdate: now - 300000, // 300s ago
  };
  const capped = calculateRechargedEnergy(pastCapacityState, now);
  assert.equal(capped, 1000);
});

test('tap batch processes up to available energy and awards exact reward', () => {
  const now = Date.now();
  const result = processTapBatch({
    requestedTaps: 10,
    tapPower: 5,
    tapEnergyCost: 1,
    currentEnergy: 6,
    capacity: 1000,
    rechargeRate: 0,
    lastEnergyUpdate: now,
    serverNow: now,
  });

  // Only 6 taps possible
  assert.equal(result.acceptedTaps, 6);
  assert.equal(result.rejectedTaps, 4);
  assert.equal(result.tapReward, 30); // 6 * 5
  assert.equal(result.newEnergy, 0);
});

test('upgrades calculate monotonically increasing costs and rewards', () => {
  const tapLvl1 = getUpgradeInfo('tapPower', 1);
  const tapLvl2 = getUpgradeInfo('tapPower', 2);
  assert.ok(tapLvl2.cost > tapLvl1.cost);
  assert.ok(tapLvl2.currentVal > tapLvl1.currentVal);
});
