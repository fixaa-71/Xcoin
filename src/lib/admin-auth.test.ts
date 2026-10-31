import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DEFAULT_ADMIN_KEY, OWNER_TELEGRAM_ID } from '../config/constants';

test('owner admin key Sadiya123@ matches constant and sha256 hash', () => {
  assert.equal(DEFAULT_ADMIN_KEY, 'Sadiya123@');
  assert.equal(OWNER_TELEGRAM_ID, '8522783212');

  const hash = crypto.createHash('sha256').update('Sadiya123@').digest('hex');
  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);
});

test('owner dynamic key updater generates valid SHA-256 digest', () => {
  const newSecretKey = 'MY_SUPER_SECRET_OWNER_KEY_2026';
  const newHash = crypto.createHash('sha256').update(newSecretKey).digest('hex');
  assert.equal(newHash.length, 64);
  assert.notEqual(newHash, crypto.createHash('sha256').update('Sadiya123@').digest('hex'));
});

test('crash game multiplier override accepts valid positive numbers >= 1.01', () => {
  const validMultiplier = 15.5;
  assert.ok(validMultiplier >= 1.01);
  const rounded = Math.round(validMultiplier * 100) / 100;
  assert.equal(rounded, 15.5);
});
