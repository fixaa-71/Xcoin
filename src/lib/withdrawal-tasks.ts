import {
  WithdrawalTask,
  UserWithdrawalTaskProgress,
  WithdrawalEligibilityResult,
} from '../types';

export function evaluateWithdrawalTasks(
  tasks: WithdrawalTask[],
  userData: {
    referralsCount: number;
    tradingVolume: number;
    totalEarned: number;
  },
  completedCustomTaskIds: string[] = []
): WithdrawalEligibilityResult {
  const enabledTasks = tasks.filter((t) => t.enabled);
  let totalRequired = 0;
  let totalCompleted = 0;

  const progressList: UserWithdrawalTaskProgress[] = enabledTasks.map((task) => {
    let currentValue = 0;

    switch (task.type) {
      case 'INVITES':
        currentValue = Math.max(0, userData.referralsCount || 0);
        break;
      case 'TRADING_VOLUME':
        currentValue = Math.max(0, userData.tradingVolume || 0);
        break;
      case 'TAP_COUNT':
        currentValue = Math.max(0, userData.totalEarned || 0);
        break;
      case 'CUSTOM_LINK':
        currentValue = completedCustomTaskIds.includes(task.taskId) ? 1 : 0;
        break;
      default:
        currentValue = 0;
    }

    const isCompleted = currentValue >= task.targetValue;
    const percentage = task.targetValue > 0
      ? Math.min(100, Math.round((currentValue / task.targetValue) * 100))
      : 100;

    if (task.isRequiredForWithdrawal) {
      totalRequired += 1;
      if (isCompleted) {
        totalCompleted += 1;
      }
    }

    return {
      taskId: task.taskId,
      currentValue,
      targetValue: task.targetValue,
      percentage,
      isCompleted,
      task,
    };
  });

  const isEligible = totalRequired === 0 || totalCompleted >= totalRequired;

  return {
    isEligible,
    totalRequired,
    totalCompleted,
    tasks: progressList,
  };
}
