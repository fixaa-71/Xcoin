import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateServerSeed,
  hashServerSeed,
  calculateCrashPoint,
  verifyCrashRound,
} from './crash-fairness';

test('provably fair crash point generation is deterministic', () => {
  const seed = 'a'.repeat(64);
  const roundId = 'round-1001';
  const nonce = 1;
  const houseEdgeBps = 300;

  const point1 = calculateCrashPoint(seed, roundId, nonce, houseEdgeBps);
  const point2 = calculateCrashPoint(seed, roundId, nonce, houseEdgeBps);

  assert.equal(point1, point2);
  assert.ok(point1 >= 1.00);
});

test('hash and round verification succeeds with valid seed and fails with altered point', () => {
  const seed = generateServerSeed();
  const hash = hashServerSeed(seed);
  const roundId = 'round-555';
  const nonce = 42;
  const houseEdgeBps = 300;

  const point = calculateCrashPoint(seed, roundId, nonce, houseEdgeBps);

  const verificationSuccess = verifyCrashRound(seed, hash, roundId, nonce, houseEdgeBps, point);
  assert.equal(verificationSuccess.validHash, true);
  assert.equal(verificationSuccess.verified, true);

  // Altered point should fail verification
  const verificationFailure = verifyCrashRound(seed, hash, roundId, nonce, houseEdgeBps, point + 1.5);
  assert.equal(verificationFailure.verified, false);
});
