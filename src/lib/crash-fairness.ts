import crypto from 'node:crypto';

export interface ProvablyFairResult {
  serverSeed: string;
  serverSeedHash: string;
  roundId: string;
  nonce: number;
  crashPoint: number;
  houseEdgeBps: number;
  algorithmVersion: string;
}

export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

/**
 * Deterministically computes the crash point multiplier using HMAC-SHA256.
 * House edge is purely mathematical and completely independent of bets or players.
 */
export function calculateCrashPoint(
  serverSeed: string,
  roundId: string,
  nonce: number,
  houseEdgeBps: number = 300 // 3.00%
): number {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${roundId}:${nonce}`);
  const hex = hmac.digest('hex');

  // Parse the first 13 hex characters (52 bits)
  const subHex = hex.substring(0, 13);
  const intVal = parseInt(subHex, 16);
  const maxVal = Math.pow(2, 52);

  // House edge factor (e.g., 0.97 for 300 bps)
  const houseEdgeFactor = Math.max(0.9, 1 - houseEdgeBps / 10000);

  // Instant crash chance (e.g., 1.00x on 1 in 33 rounds)
  if (intVal % 33 === 0) {
    return 1.00;
  }

  // Crash formula: (maxVal * houseEdgeFactor) / (maxVal - intVal)
  const rawMultiplier = (maxVal * houseEdgeFactor) / (maxVal - intVal);
  // Cap between 1.00x and 10000.00x, formatted to 2 decimals
  const bounded = Math.min(10000, Math.max(1.00, rawMultiplier));
  return Math.floor(bounded * 100) / 100;
}

export function verifyCrashRound(
  serverSeed: string,
  serverSeedHash: string,
  roundId: string,
  nonce: number,
  houseEdgeBps: number,
  claimedCrashPoint: number
): { validHash: boolean; calculatedCrashPoint: number; verified: boolean } {
  const computedHash = hashServerSeed(serverSeed);
  const validHash = computedHash.toLowerCase() === serverSeedHash.toLowerCase();
  const calculatedCrashPoint = calculateCrashPoint(serverSeed, roundId, nonce, houseEdgeBps);
  const verified = validHash && Math.abs(calculatedCrashPoint - claimedCrashPoint) < 0.001;

  return {
    validHash,
    calculatedCrashPoint,
    verified,
  };
}
