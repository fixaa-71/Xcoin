export interface EnergyState {
  currentEnergy: number;
  capacity: number;
  rechargeRate: number; // energy per second
  lastEnergyUpdate: number; // timestamp in ms
}

/**
 * Calculates current recharged energy based on elapsed server time.
 */
export function calculateRechargedEnergy(
  state: EnergyState,
  nowTimestamp: number = Date.now()
): number {
  if (state.currentEnergy >= state.capacity) {
    return state.capacity;
  }
  const elapsedSeconds = Math.max(0, (nowTimestamp - state.lastEnergyUpdate) / 1000);
  const recharged = Math.floor(elapsedSeconds * state.rechargeRate);
  return Math.min(state.capacity, state.currentEnergy + recharged);
}

/**
 * Processes requested taps against available energy.
 * Returns accepted taps, remaining energy, and total reward.
 */
export function processTapBatch(params: {
  requestedTaps: number;
  tapPower: number;
  tapEnergyCost: number;
  currentEnergy: number;
  capacity: number;
  rechargeRate: number;
  lastEnergyUpdate: number;
  serverNow: number;
}): {
  acceptedTaps: number;
  rejectedTaps: number;
  tapReward: number;
  newEnergy: number;
  newLastEnergyUpdate: number;
} {
  const rechargedEnergy = calculateRechargedEnergy(
    {
      currentEnergy: params.currentEnergy,
      capacity: params.capacity,
      rechargeRate: params.rechargeRate,
      lastEnergyUpdate: params.lastEnergyUpdate,
    },
    params.serverNow
  );

  const costPerTap = Math.max(1, params.tapEnergyCost);
  const maxPossibleTaps = Math.floor(rechargedEnergy / costPerTap);
  const acceptedTaps = Math.max(0, Math.min(params.requestedTaps, maxPossibleTaps));
  const rejectedTaps = Math.max(0, params.requestedTaps - acceptedTaps);

  const newEnergy = Math.max(0, rechargedEnergy - (acceptedTaps * costPerTap));
  const tapReward = acceptedTaps * params.tapPower;

  return {
    acceptedTaps,
    rejectedTaps,
    tapReward,
    newEnergy,
    newLastEnergyUpdate: params.serverNow,
  };
}

/**
 * Upgrades calculations
 */
export function getUpgradeInfo(
  type: 'tapPower' | 'rechargePower' | 'energyCapacity',
  level: number
): { currentVal: number; nextVal: number; cost: number; maxLevel: number } {
  const maxLevel = 25;
  const currentLvl = Math.max(1, level);
  const nextLvl = currentLvl + 1;

  switch (type) {
    case 'tapPower': {
      const currentVal = currentLvl * 5;
      const nextVal = nextLvl * 5;
      const cost = Math.floor(1000 * Math.pow(1.6, currentLvl - 1));
      return { currentVal, nextVal, cost, maxLevel };
    }
    case 'rechargePower': {
      const currentVal = currentLvl * 2 + 1;
      const nextVal = nextLvl * 2 + 1;
      const cost = Math.floor(1500 * Math.pow(1.7, currentLvl - 1));
      return { currentVal, nextVal, cost, maxLevel };
    }
    case 'energyCapacity': {
      const currentVal = 1000 + (currentLvl - 1) * 500;
      const nextVal = 1000 + currentLvl * 500;
      const cost = Math.floor(2000 * Math.pow(1.5, currentLvl - 1));
      return { currentVal, nextVal, cost, maxLevel };
    }
  }
}
