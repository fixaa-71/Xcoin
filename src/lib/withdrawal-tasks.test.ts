import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWithdrawalTasks } from './withdrawal-tasks';
import { WithdrawalTask } from '../types';

test('withdrawal tasks evaluation correctly calculates progress and eligibility', () => {
  const sampleTasks: WithdrawalTask[] = [
    {
      taskId: 'TASK-INVITES',
      title: 'Complete 15 Invites',
      description: 'Invite 15 friends to join X COIN',
      type: 'INVITES',
      targetValue: 15,
      unitLabel: 'Friends',
      actionUrl: 'friends',
      enabled: true,
      isRequiredForWithdrawal: true,
      sortOrder: 1,
      createdAt: Date.now(),
    },
    {
      taskId: 'TASK-TRADING',
      title: 'Complete 50k XC Trading',
      description: 'Trade at least 50,000 XC in QX Trading Arena',
      type: 'TRADING_VOLUME',
      targetValue: 50000,
      unitLabel: 'XC',
      actionUrl: 'trade',
      enabled: true,
      isRequiredForWithdrawal: true,
      sortOrder: 2,
      createdAt: Date.now(),
    },
    {
      taskId: 'TASK-OPTIONAL',
      title: 'Tap to Earn 100k',
      description: 'Mine 100,000 XCOIN via tap',
      type: 'TAP_COUNT',
      targetValue: 100000,
      unitLabel: 'XCOIN',
      enabled: true,
      isRequiredForWithdrawal: false,
      sortOrder: 3,
      createdAt: Date.now(),
    },
  ];

  // User with 10 invites and 25k volume (Ineligible)
  const result1 = evaluateWithdrawalTasks(
    sampleTasks,
    { referralsCount: 10, tradingVolume: 25000, totalEarned: 10000 },
    []
  );

  assert.equal(result1.isEligible, false);
  assert.equal(result1.totalRequired, 2);
  assert.equal(result1.totalCompleted, 0);
  assert.equal(result1.tasks[0].currentValue, 10);
  assert.equal(result1.tasks[0].percentage, 67);
  assert.equal(result1.tasks[0].isCompleted, false);
  assert.equal(result1.tasks[1].currentValue, 25000);
  assert.equal(result1.tasks[1].percentage, 50);

  // User with 15 invites and 50k volume (Eligible)
  const result2 = evaluateWithdrawalTasks(
    sampleTasks,
    { referralsCount: 15, tradingVolume: 50000, totalEarned: 0 },
    []
  );

  assert.equal(result2.isEligible, true);
  assert.equal(result2.totalCompleted, 2);
  assert.equal(result2.tasks[0].isCompleted, true);
  assert.equal(result2.tasks[1].isCompleted, true);
});

test('custom quest task tracks completion via completedCustomTaskIds', () => {
  const customTask: WithdrawalTask = {
    taskId: 'TASK-CUSTOM-CHANNEL',
    title: 'Join Telegram Channel',
    description: 'Join official channel',
    type: 'CUSTOM_LINK',
    targetValue: 1,
    unitLabel: 'Action',
    enabled: true,
    isRequiredForWithdrawal: true,
    sortOrder: 1,
    createdAt: Date.now(),
  };

  const incomplete = evaluateWithdrawalTasks([customTask], { referralsCount: 0, tradingVolume: 0, totalEarned: 0 }, []);
  assert.equal(incomplete.isEligible, false);

  const complete = evaluateWithdrawalTasks([customTask], { referralsCount: 0, tradingVolume: 0, totalEarned: 0 }, ['TASK-CUSTOM-CHANNEL']);
  assert.equal(complete.isEligible, true);
  assert.equal(complete.tasks[0].isCompleted, true);
});
