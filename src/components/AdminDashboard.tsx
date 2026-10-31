import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Users,
  CreditCard,
  ArrowDownRight,
  TrendingUp,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Lock,
  LogOut,
  X,
  RefreshCw,
  Search,
  Gamepad2,
  Eye,
  EyeOff,
  Flame,
  Radio,
  Sliders,
  DollarSign,
  UserCheck,
  UserX,
  Trash2,
  Edit3,
  Megaphone,
  Save,
  Zap,
  ListChecks,
  Gem,
  ShoppingBag,
  Plus,
  Bot,
  Activity,
  Gauge,
  Target,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Crosshair,
  Percent,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { OWNER_TELEGRAM_ID } from '../config/constants';
import {
  WithdrawalTask,
  StoreAsset,
  TapGameControls,
  CrashGameControls,
  TradingGameControls,
  GameRiggedUser,
  GameTelemetry,
  TradingOutcomeMode,
  MarketTrendMode,
  UserGameRigMode,
} from '../types';

interface AdminDashboardProps {
  onClose: () => void;
  triggerHaptic: (type?: any) => void;
  onRefreshUserData?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose, triggerHaptic, onRefreshUserData }) => {
  const [adminToken, setAdminToken] = useState<string>(
    () => localStorage.getItem('xcoin_admin_token') || ''
  );
  const [adminRole, setAdminRole] = useState<string>('');
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [inputKey, setInputKey] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Active section
  const [activeSection, setActiveSection] = useState<
    | 'overview'
    | 'games'
    | 'users'
    | 'tasks'
    | 'store'
    | 'admins'
    | 'owner_key'
    | 'payments'
    | 'withdrawals'
    | 'system'
    | 'audit'
  >('overview');

  // Withdrawal Tasks Management State
  const [tasksList, setTasksList] = useState<WithdrawalTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDesc, setNewTaskDesc] = useState<string>('');
  const [newTaskType, setNewTaskType] = useState<string>('INVITES');
  const [newTaskTarget, setNewTaskTarget] = useState<number>(15);
  const [newTaskUnit, setNewTaskUnit] = useState<string>('Invites');
  const [newTaskUrl, setNewTaskUrl] = useState<string>('friends');
  const [newTaskLabel, setNewTaskLabel] = useState<string>('Invite Friends');
  const [newTaskRequired, setNewTaskRequired] = useState<boolean>(true);
  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);

  // Store Assets Management State
  const [adminStoreAssets, setAdminStoreAssets] = useState<StoreAsset[]>([]);
  const [newAssetTitle, setNewAssetTitle] = useState<string>('');
  const [newAssetDesc, setNewAssetDesc] = useState<string>('');
  const [newAssetCategory, setNewAssetCategory] = useState<string>('VEHICLES');
  const [newAssetPriceXC, setNewAssetPriceXC] = useState<number>(20000);
  const [newAssetDailyProfit, setNewAssetDailyProfit] = useState<number>(3.5);
  const [newAssetEmoji, setNewAssetEmoji] = useState<string>('🏎️');
  const [newAssetImage, setNewAssetImage] = useState<string>('https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80');
  const [isCreatingAsset, setIsCreatingAsset] = useState<boolean>(false);

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // User search & edit state
  const [userSearch, setUserSearch] = useState<string>('');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any | null>(null);
  const [editXcoinBalance, setEditXcoinBalance] = useState<number>(0);
  const [editXcBalance, setEditXcBalance] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [editVipTier, setEditVipTier] = useState<string>('Free');
  const [editTapPower, setEditTapPower] = useState<number>(5);
  const [editEnergyCapacity, setEditEnergyCapacity] = useState<number>(1000);
  const [isSavingUser, setIsSavingUser] = useState<boolean>(false);

  // Key creation & edit state
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [newKeyRole, setNewKeyRole] = useState<string>('ADMIN');
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([
    'users.view',
    'users.edit',
    'wallet.view',
    'trading.view',
    'crash.view',
    'payments.view',
  ]);
  const [generatedRawKey, setGeneratedRawKey] = useState<string | null>(null);
  const [editingAdminKey, setEditingAdminKey] = useState<any | null>(null);

  // Change Owner Password state
  const [newOwnerKey, setNewOwnerKey] = useState<string>('');
  const [confirmOwnerKey, setConfirmOwnerKey] = useState<string>('');
  const [isChangingKey, setIsChangingKey] = useState<boolean>(false);

  // Game Sub-navigation
  const [gameSubTab, setGameSubTab] = useState<'trading' | 'crash' | 'tap' | 'rigging' | 'telemetry'>('trading');

  // Advanced Game Controls State
  const [fullGameData, setFullGameData] = useState<any>(null);

  // Trading Controls State
  const [marketTrend, setMarketTrend] = useState<MarketTrendMode>('NATURAL');
  const [tradingOutcomeMode, setTradingOutcomeMode] = useState<TradingOutcomeMode>('NATURAL');
  const [tradingPayoutPercent, setTradingPayoutPercent] = useState<number>(90);
  const [tradingFeePercent, setTradingFeePercent] = useState<number>(2);
  const [targetMarketPrice, setTargetMarketPrice] = useState<string>('');
  const [volatilityMultiplier, setVolatilityMultiplier] = useState<number>(1.0);
  const [tradingEnabled, setTradingEnabled] = useState<boolean>(true);

  // Crash Controls State
  const [forcedCrashPoint, setForcedCrashPoint] = useState<string>('');
  const [crashHouseEdgeBps, setCrashHouseEdgeBps] = useState<number>(300);
  const [crashBettingDurationMs, setCrashBettingDurationMs] = useState<number>(5000);
  const [crashMinBetXC, setCrashMinBetXC] = useState<number>(100);
  const [crashMaxBetXC, setCrashMaxBetXC] = useState<number>(100000);
  const [crashEnabled, setCrashEnabled] = useState<boolean>(true);
  const [crashBotSimulationEnabled, setCrashBotSimulationEnabled] = useState<boolean>(true);
  const [presetSequenceInput, setPresetSequenceInput] = useState<string>('1.25, 2.10, 1.05, 5.00, 1.50');

  // Tap Controls State
  const [tapMultiplier, setTapMultiplier] = useState<number>(1);
  const [goldenHourActive, setGoldenHourActive] = useState<boolean>(false);
  const [goldenHourMultiplier, setGoldenHourMultiplier] = useState<number>(2);
  const [energyRechargeMultiplier, setEnergyRechargeMultiplier] = useState<number>(1);
  const [maxCpsLimit, setMaxCpsLimit] = useState<number>(25);
  const [tapEnabled, setTapEnabled] = useState<boolean>(true);

  // Rigging & Handicap State
  const [rigTargetUserId, setRigTargetUserId] = useState<string>('');
  const [rigMode, setRigMode] = useState<UserGameRigMode>('FORCE_WIN');
  const [rigCustomRate, setRigCustomRate] = useState<number>(85);
  const [rigReason, setRigReason] = useState<string>('VIP luck boost');
  const [riggedUsersList, setRiggedUsersList] = useState<GameRiggedUser[]>([]);

  // Announcement state
  const [announcementText, setAnnouncementText] = useState<string>('');

  const fetchTasks = async () => {
    try {
      const data = await apiFetch('/api/admin/withdrawal-tasks');
      setTasksList(data.tasks || []);
    } catch (err) {
      console.warn('Failed to fetch tasks:', err);
    }
  };

  const fetchStoreAssets = async () => {
    try {
      const data = await apiFetch('/api/invest/store');
      setAdminStoreAssets(data.storeAssets || []);
    } catch (err) {
      console.warn('Failed to fetch store assets:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || newTaskTarget <= 0) return;
    setIsCreatingTask(true);
    setActionError(null);
    try {
      await apiFetch('/api/admin/withdrawal-tasks/create', {
        method: 'POST',
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim(),
          type: newTaskType,
          targetValue: newTaskTarget,
          unitLabel: newTaskUnit.trim() || 'Units',
          actionUrl: newTaskUrl.trim(),
          actionLabel: newTaskLabel.trim() || 'Complete',
          isRequiredForWithdrawal: newTaskRequired,
        }),
      });
      triggerHaptic('success');
      setActionSuccess('New Withdrawal Task successfully created!');
      setNewTaskTitle('');
      setNewTaskDesc('');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchTasks();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create task');
      triggerHaptic('error');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleToggleTask = async (task: WithdrawalTask) => {
    try {
      await apiFetch('/api/admin/withdrawal-tasks/update', {
        method: 'POST',
        body: JSON.stringify({
          taskId: task.taskId,
          enabled: !task.enabled,
        }),
      });
      triggerHaptic('medium');
      fetchTasks();
    } catch (err: any) {
      setActionError(err.message || 'Failed to toggle task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiFetch('/api/admin/withdrawal-tasks/delete', {
        method: 'POST',
        body: JSON.stringify({ taskId }),
      });
      triggerHaptic('medium');
      fetchTasks();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete task');
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetTitle.trim() || newAssetPriceXC <= 0) return;
    setIsCreatingAsset(true);
    setActionError(null);
    try {
      await apiFetch('/api/admin/invest/create-asset', {
        method: 'POST',
        body: JSON.stringify({
          title: newAssetTitle.trim(),
          description: newAssetDesc.trim(),
          category: newAssetCategory,
          priceXC: newAssetPriceXC,
          priceXcoin: newAssetPriceXC * 5,
          dailyProfitPercent: newAssetDailyProfit,
          iconEmoji: newAssetEmoji.trim() || '💎',
          imageUrl: newAssetImage.trim(),
        }),
      });
      triggerHaptic('success');
      setActionSuccess('New Store Asset published to Investment Marketplace!');
      setNewAssetTitle('');
      setNewAssetDesc('');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchStoreAssets();
    } catch (err: any) {
      setActionError(err.message || 'Failed to add asset');
      triggerHaptic('error');
    } finally {
      setIsCreatingAsset(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await apiFetch('/api/admin/invest/delete-asset', {
        method: 'POST',
        body: JSON.stringify({ assetId }),
      });
      triggerHaptic('medium');
      fetchStoreAssets();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete asset');
    }
  };

  const fetchFullGameState = async () => {
    try {
      const data = await apiFetch('/api/admin/games/full-state');
      setFullGameData(data);
      if (data.tradingControls) {
        setMarketTrend(data.tradingControls.marketTrend || 'NATURAL');
        setTradingOutcomeMode(data.tradingControls.outcomeMode || 'NATURAL');
        setTradingPayoutPercent(data.tradingControls.payoutPercent ?? 90);
        setTradingFeePercent(data.tradingControls.tradingFeePercent ?? 2);
        setVolatilityMultiplier(data.tradingControls.volatilityMultiplier ?? 1.0);
        setTradingEnabled(data.tradingControls.tradingEnabled !== false);
      }
      if (data.crashControls) {
        setCrashHouseEdgeBps(data.crashControls.houseEdgeBps ?? 300);
        setCrashBettingDurationMs(data.crashControls.bettingDurationMs ?? 5000);
        setCrashMinBetXC(data.crashControls.minBetXC ?? 100);
        setCrashMaxBetXC(data.crashControls.maxBetXC ?? 100000);
        setCrashEnabled(data.crashControls.crashEnabled !== false);
        setCrashBotSimulationEnabled(data.crashControls.botSimulationEnabled !== false);
      }
      if (data.tapControls) {
        setTapMultiplier(data.tapControls.tapMultiplier ?? 1);
        setGoldenHourActive(!!data.tapControls.goldenHourActive);
        setGoldenHourMultiplier(data.tapControls.goldenHourMultiplier ?? 2);
        setEnergyRechargeMultiplier(data.tapControls.energyRechargeMultiplier ?? 1);
        setMaxCpsLimit(data.tapControls.maxCpsLimit ?? 25);
        setTapEnabled(data.tapControls.tapEnabled !== false);
      }
      if (data.riggedUsers) {
        setRiggedUsersList(data.riggedUsers);
      }
    } catch (err) {
      console.warn('Failed to fetch full game state:', err);
    }
  };

  const fetchDashboard = async () => {
    if (!adminToken) return;
    setIsLoadingData(true);
    try {
      const data = await apiFetch('/api/admin/dashboard');
      setDashboardData(data);
      if (data.gameControls?.marketTrend) {
        setMarketTrend(data.gameControls.marketTrend);
      }
      if (data.systemAnnouncement) {
        setAnnouncementText(data.systemAnnouncement);
      }
      fetchTasks();
      fetchStoreAssets();
      fetchFullGameState();
    } catch (err: any) {
      if (err.message?.includes('Unauthorized')) {
        handleLogout();
      }
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetchDashboard();
      fetchTasks();
      fetchStoreAssets();
      fetchFullGameState();
    }
  }, [adminToken]);

  // Handle Clean Login (No plaintext keys displayed)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    setIsLoggingIn(true);
    setActionError(null);

    try {
      const data = await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ adminKey: inputKey.trim() }),
      });

      triggerHaptic('success');
      localStorage.setItem('xcoin_admin_token', data.token);
      setAdminToken(data.token);
      setAdminRole(data.role);
      setAdminPermissions(data.permissions || []);
      setInputKey('');
    } catch (err: any) {
      setActionError(err.message || 'Invalid or revoked Admin Key');
      triggerHaptic('error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('xcoin_admin_token');
    setAdminToken('');
    setDashboardData(null);
  };

  // 1. Change Owner Master Password
  const handleChangeOwnerKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOwnerKey !== confirmOwnerKey) {
      setActionError('Passwords do not match');
      return;
    }
    if (newOwnerKey.trim().length < 6) {
      setActionError('Key must be at least 6 characters long');
      return;
    }

    setIsChangingKey(true);
    setActionError(null);
    try {
      await apiFetch('/api/admin/owner/change-key', {
        method: 'POST',
        body: JSON.stringify({ newKey: newOwnerKey.trim() }),
      });
      triggerHaptic('success');
      setActionSuccess('Owner Master Key updated successfully! Keep it confidential.');
      setNewOwnerKey('');
      setConfirmOwnerKey('');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchDashboard();
    } catch (err: any) {
      setActionError(err.message || 'Failed to change master key');
      triggerHaptic('error');
    } finally {
      setIsChangingKey(false);
    }
  };

  // 2. Select User for Full Edit
  const handleSelectUser = (u: any) => {
    setSelectedUserForEdit(u);
    setEditXcoinBalance(u.xcoinBalance || 0);
    setEditXcBalance(u.xcBalance || 0);
    setEditStatus(u.status || 'ACTIVE');
    setEditVipTier(u.vipTier || 'Free');
    setEditTapPower(u.tapPower || 5);
    setEditEnergyCapacity(u.energyCapacity || 1000);
  };

  // 3. Save User Profile & Balance Edits
  const handleSaveUser = async () => {
    if (!selectedUserForEdit) return;
    setIsSavingUser(true);
    setActionError(null);
    try {
      await apiFetch('/api/admin/user/update-full', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: selectedUserForEdit.telegramUserId,
          xcoinBalance: editXcoinBalance,
          xcBalance: editXcBalance,
          status: editStatus,
          vipTier: editVipTier,
          tapPower: editTapPower,
          energyCapacity: editEnergyCapacity,
          reason: 'Owner full customization',
        }),
      });

      triggerHaptic('success');
      setActionSuccess(`User ${selectedUserForEdit.telegramUserId} updated successfully!`);
      setSelectedUserForEdit(null);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchDashboard();
      onRefreshUserData?.();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user');
      triggerHaptic('error');
    } finally {
      setIsSavingUser(false);
    }
  };

  // 4. Advanced Game Handlers: QX Trading Arena
  const handleUpdateTradingControls = async (overrides?: any) => {
    try {
      const payload = {
        marketTrend: overrides?.marketTrend ?? marketTrend,
        outcomeMode: overrides?.outcomeMode ?? tradingOutcomeMode,
        payoutPercent: overrides?.payoutPercent ?? tradingPayoutPercent,
        tradingFeePercent: overrides?.tradingFeePercent ?? tradingFeePercent,
        volatilityMultiplier: overrides?.volatilityMultiplier ?? volatilityMultiplier,
        tradingEnabled: overrides?.tradingEnabled ?? tradingEnabled,
      };
      await apiFetch('/api/admin/games/trading/update', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      triggerHaptic('success');
      setActionSuccess('Trading controls updated successfully!');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchFullGameState();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update trading controls');
      triggerHaptic('error');
    }
  };

  const handleMarketAction = async (action: string, price?: number) => {
    try {
      const res = await apiFetch('/api/admin/games/trading/market-action', {
        method: 'POST',
        body: JSON.stringify({ action, price }),
      });
      triggerHaptic('medium');
      setActionSuccess(`Market action [${action}] executed! Price is now $${res.newPrice.toFixed(2)}`);
      setTargetMarketPrice('');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchFullGameState();
    } catch (err: any) {
      setActionError(err.message || 'Market action failed');
      triggerHaptic('error');
    }
  };

  // 5. Advanced Game Handlers: X Crash Aviator
  const handleUpdateCrashControls = async (overrides?: any) => {
    try {
      const payload = {
        houseEdgeBps: overrides?.houseEdgeBps ?? crashHouseEdgeBps,
        bettingDurationMs: overrides?.bettingDurationMs ?? crashBettingDurationMs,
        minBetXC: overrides?.minBetXC ?? crashMinBetXC,
        maxBetXC: overrides?.maxBetXC ?? crashMaxBetXC,
        crashEnabled: overrides?.crashEnabled ?? crashEnabled,
        botSimulationEnabled: overrides?.botSimulationEnabled ?? crashBotSimulationEnabled,
      };
      await apiFetch('/api/admin/games/crash/update', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      triggerHaptic('success');
      setActionSuccess('Crash game parameters updated!');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchFullGameState();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update crash controls');
      triggerHaptic('error');
    }
  };

  const handleCrashAction = async (action: string, multiplier?: number, sequence?: number[]) => {
    try {
      const res = await apiFetch('/api/admin/games/crash/action', {
        method: 'POST',
        body: JSON.stringify({ action, multiplier, sequence }),
      });
      triggerHaptic(action === 'EMERGENCY_FLYAWAY' ? 'error' : 'success');
      setActionSuccess(res.message || `Crash action [${action}] applied!`);
      if (action === 'SET_NEXT_MULTIPLIER') setForcedCrashPoint('');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchFullGameState();
    } catch (err: any) {
      setActionError(err.message || 'Crash action failed');
      triggerHaptic('error');
    }
  };

  const handleArmPresetSequence = (presetName: string) => {
    let seq: number[] = [];
    if (presetName === 'BAIT_HIGH') {
      seq = [1.20, 1.45, 3.80, 8.50, 1.05];
    } else if (presetName === 'BUST_TRAP') {
      seq = [1.00, 1.05, 1.02, 1.10, 1.01];
    } else if (presetName === 'GENEROUS') {
      seq = [2.50, 4.00, 2.10, 12.00, 3.20];
    } else {
      seq = presetSequenceInput.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n >= 1.01);
    }
    handleCrashAction('SET_SEQUENCE', undefined, seq);
  };

  // 6. Advanced Game Handlers: Mining Tap Controls
  const handleUpdateTapControls = async (overrides?: any) => {
    try {
      const payload = {
        tapMultiplier: overrides?.tapMultiplier ?? tapMultiplier,
        goldenHourActive: overrides?.goldenHourActive ?? goldenHourActive,
        goldenHourMultiplier: overrides?.goldenHourMultiplier ?? goldenHourMultiplier,
        energyRechargeMultiplier: overrides?.energyRechargeMultiplier ?? energyRechargeMultiplier,
        maxCpsLimit: overrides?.maxCpsLimit ?? maxCpsLimit,
        tapEnabled: overrides?.tapEnabled ?? tapEnabled,
      };
      await apiFetch('/api/admin/games/tap/update', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      triggerHaptic('success');
      setActionSuccess('Mining Tap controls saved!');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchFullGameState();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update tap controls');
      triggerHaptic('error');
    }
  };

  // 7. Player Rigging & Handicap Controls
  const handleSetUserRig = async () => {
    if (!rigTargetUserId.trim()) {
      setActionError('Telegram User ID required');
      return;
    }
    try {
      await apiFetch('/api/admin/games/user-rig/set', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: rigTargetUserId.trim(),
          mode: rigMode,
          customWinRatePercent: rigCustomRate,
          reason: rigReason,
        }),
      });
      triggerHaptic('success');
      setActionSuccess(`Rig mode [${rigMode}] applied to user ${rigTargetUserId}!`);
      setRigTargetUserId('');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchFullGameState();
    } catch (err: any) {
      setActionError(err.message || 'Failed to set user rig');
      triggerHaptic('error');
    }
  };

  const handleRemoveUserRig = async (userId: string) => {
    try {
      await apiFetch('/api/admin/games/user-rig/remove', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: userId }),
      });
      triggerHaptic('medium');
      setActionSuccess(`Handicap removed for user ${userId}`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchFullGameState();
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove user rig');
    }
  };

  // 6. Broadcast Announcement
  const handleSaveAnnouncement = async () => {
    try {
      await apiFetch('/api/admin/system/announcement', {
        method: 'POST',
        body: JSON.stringify({ announcement: announcementText }),
      });
      triggerHaptic('success');
      setActionSuccess('System announcement broadcasted to all users!');
      setTimeout(() => setActionSuccess(null), 3000);
      fetchDashboard();
      onRefreshUserData?.();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update announcement');
    }
  };

  // 7. Admin Keys Management
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      const data = await apiFetch('/api/admin/keys/create', {
        method: 'POST',
        body: JSON.stringify({
          name: newKeyName.trim(),
          role: newKeyRole,
          permissions: newKeyPermissions,
          expirationDays: 90,
        }),
      });

      triggerHaptic('success');
      setGeneratedRawKey(data.rawKey);
      setNewKeyName('');
      setActionSuccess('New Admin Key generated!');
      fetchDashboard();
    } catch (err: any) {
      setActionError(err.message || 'Key generation failed');
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!window.confirm(`Delete admin key ${keyId}?`)) return;
    try {
      await apiFetch('/api/admin/keys/delete', {
        method: 'POST',
        body: JSON.stringify({ keyId }),
      });
      triggerHaptic('medium');
      setActionSuccess(`Admin Key ${keyId} deleted!`);
      setTimeout(() => setActionSuccess(null), 3000);
      fetchDashboard();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete key');
    }
  };

  const handleToggleKeyStatus = async (key: any) => {
    const nextStatus = key.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await apiFetch('/api/admin/keys/edit', {
        method: 'POST',
        body: JSON.stringify({ keyId: key.keyId, status: nextStatus }),
      });
      triggerHaptic('medium');
      fetchDashboard();
    } catch (err: any) {
      setActionError(err.message || 'Failed to toggle status');
    }
  };

  // Filter users
  const filteredUsers = (dashboardData?.users || []).filter((u: any) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      u.telegramUserId?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q)
    );
  });

  const isOwner = adminRole === 'OWNER';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/90 backdrop-blur-xl select-none">
      <div className="relative w-full max-w-3xl max-h-[94vh] bg-zinc-950 border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3 overflow-hidden text-white">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-yellow-600/30 rounded-xl border border-amber-500/40">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>X COIN OWNER & ADMIN PORTAL</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 text-amber-300 border border-amber-500/30 font-mono">
                  {isOwner ? '👑 MASTER OWNER' : `ROLE: ${adminRole || 'ADMIN'}`}
                </span>
              </h2>
              <span className="text-[11px] text-zinc-400 font-mono">
                Authoritative Master Engine • Telegram ID: {OWNER_TELEGRAM_ID}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {adminToken && (
              <button
                onClick={fetchDashboard}
                disabled={isLoadingData}
                className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
              </button>
            )}
            {adminToken && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-xl bg-zinc-900 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-white/10 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Notifications */}
        {actionError && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* 1. CONFIDENTIAL LOGIN SCREEN (NO KEYS DISPLAYED TO OTHERS) */}
        {!adminToken ? (
          <div className="py-10 flex flex-col items-center justify-center max-w-sm mx-auto w-full gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/30 border border-amber-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.2)]">
              <Lock className="w-8 h-8 text-amber-400" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-extrabold text-white">Owner & Admin Authentication</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Enter your secret password or administrator key to proceed.
              </p>
            </div>

            <form onSubmit={handleLogin} className="w-full flex flex-col gap-3">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Enter secret Owner Password / Admin Key"
                  className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl pl-3 pr-10 font-mono text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-xs shadow-md transition-all active:scale-[0.98] hover:from-amber-400 hover:to-yellow-300"
              >
                {isLoggingIn ? 'AUTHENTICATING...' : 'SECURE LOGIN'}
              </button>
            </form>

            <span className="text-[10px] text-zinc-500 text-center font-mono">
              Direct Owner & Admin Access
            </span>
          </div>
        ) : (
          /* 2. AUTHENTICATED OWNER & ADMIN DASHBOARD */
          <div className="flex flex-col flex-1 overflow-hidden gap-3">
            {/* Top Navigation Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/10 pb-2 shrink-0">
              {[
                { id: 'overview', label: 'Overview', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                { id: 'games', label: '🎮 Games Control', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
                { id: 'users', label: 'Users & Balances', icon: <Users className="w-3.5 h-3.5" /> },
                { id: 'tasks', label: '📋 Withdraw Tasks', icon: <ListChecks className="w-3.5 h-3.5" /> },
                { id: 'store', label: '🏪 Store Assets', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
                { id: 'admins', label: 'Admins (RBAC)', icon: <Key className="w-3.5 h-3.5" /> },
                { id: 'owner_key', label: 'Owner Key', icon: <Lock className="w-3.5 h-3.5" /> },
                { id: 'payments', label: 'VIP Orders', icon: <CreditCard className="w-3.5 h-3.5" /> },
                { id: 'withdrawals', label: 'Withdrawals', icon: <ArrowDownRight className="w-3.5 h-3.5" /> },
                { id: 'system', label: 'System & Notice', icon: <Megaphone className="w-3.5 h-3.5" /> },
                { id: 'audit', label: 'Audit Logs', icon: <Shield className="w-3.5 h-3.5" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    activeSection === tab.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar pr-1 flex flex-col gap-3">
              {/* TAB 1: OVERVIEW */}
              {activeSection === 'overview' && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-zinc-900/70 border border-white/10 p-3 rounded-2xl flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-mono">TOTAL REAL USERS</span>
                      <span className="text-xl font-mono font-black text-white mt-1">
                        {dashboardData?.stats?.totalUsers || 0}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold mt-1">
                        {dashboardData?.stats?.activeUsers || 0} Active
                      </span>
                    </div>

                    <div className="bg-zinc-900/70 border border-white/10 p-3 rounded-2xl flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-mono">TOTAL XCOIN</span>
                      <span className="text-xl font-mono font-black text-amber-300 mt-1">
                        {(dashboardData?.stats?.totalXcoin || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-1 font-mono">In Circulation</span>
                    </div>

                    <div className="bg-zinc-900/70 border border-white/10 p-3 rounded-2xl flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-mono">TRADING VOLUME</span>
                      <span className="text-xl font-mono font-black text-emerald-400 mt-1">
                        {(dashboardData?.stats?.tradingVolume || 0).toLocaleString()} XC
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-1">
                        {dashboardData?.stats?.completedTrades || 0} settled
                      </span>
                    </div>

                    <div className="bg-zinc-900/70 border border-white/10 p-3 rounded-2xl flex flex-col">
                      <span className="text-[10px] text-zinc-400 font-mono">VIP REVENUE</span>
                      <span className="text-xl font-mono font-black text-white mt-1">
                        ${dashboardData?.stats?.vipRevenueUSD || 0} USD
                      </span>
                      <span className="text-[10px] text-amber-400 mt-1 font-semibold">
                        {dashboardData?.stats?.pendingOrdersCount || 0} Pending
                      </span>
                    </div>
                  </div>

                  {/* Aviator & Crash Financial Stats */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-zinc-900/70 border border-rose-500/20 p-3 rounded-2xl">
                      <span className="text-[10px] text-rose-400 font-mono uppercase font-bold">
                        AVIATOR GAME TURNOVER
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-xl font-mono font-black text-white">
                          {(dashboardData?.stats?.crashBetVolume || 0).toLocaleString()} XC
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-bold">
                          Net House P&L: +{(dashboardData?.stats?.crashNetHouseProfit || 0).toLocaleString()} XC
                        </span>
                      </div>
                    </div>

                    <div className="bg-zinc-900/70 border border-white/10 p-3 rounded-2xl">
                      <span className="text-[10px] text-zinc-400 font-mono uppercase font-bold">
                        PENDING REVIEWS
                      </span>
                      <div className="flex items-center gap-4 mt-1 font-mono text-sm">
                        <span className="text-amber-300 font-bold">
                          {dashboardData?.stats?.pendingOrdersCount || 0} VIP Orders
                        </span>
                        <span className="text-rose-400 font-bold">
                          {dashboardData?.stats?.pendingWithdrawalsCount || 0} Withdrawals
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ADVANCED GAMES CONTROL CENTER (FULL SUITE) */}
              {activeSection === 'games' && (
                <div className="flex flex-col gap-3">
                  {/* Game Sub-navigation Tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-black/40 p-1 rounded-xl border border-white/5">
                    {[
                      { id: 'trading', label: '📈 QX Trading Arena', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                      { id: 'crash', label: '✈️ X Crash (Aviator)', icon: <Activity className="w-3.5 h-3.5" /> },
                      { id: 'tap', label: '⚡ Tap & Mining Engine', icon: <Zap className="w-3.5 h-3.5" /> },
                      { id: 'rigging', label: '🎯 Player Rigging', icon: <Target className="w-3.5 h-3.5" /> },
                      { id: 'telemetry', label: '📊 House Telemetry', icon: <Gauge className="w-3.5 h-3.5" /> },
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() => setGameSubTab(st.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                          gameSubTab === st.id
                            ? 'bg-amber-500 text-black shadow-xs'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {st.icon}
                        <span>{st.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* 1. QX TRADING ARENA ADVANCED CONTROLS */}
                  {gameSubTab === 'trading' && (
                    <div className="flex flex-col gap-3">
                      {/* Live Market Price & 1-Click Quick Triggers */}
                      <div className="bg-zinc-900/70 border border-emerald-500/30 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">📊</span>
                            <div>
                              <h3 className="text-sm font-extrabold text-white">QX Real-Time Candle & Price Engine</h3>
                              <p className="text-[11px] text-zinc-400">Manipulate live market ticks and trigger instant market surges or dumps</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl">
                              ${fullGameData?.currentMarketPrice?.toFixed(2) || dashboardData?.gameControls?.currentMarketPrice?.toFixed(2) || '42.50'}
                            </span>
                            <button
                              onClick={() => {
                                const next = !tradingEnabled;
                                setTradingEnabled(next);
                                handleUpdateTradingControls({ tradingEnabled: next });
                              }}
                              className={`px-3 py-1 rounded-xl font-bold text-xs flex items-center gap-1 border transition-colors ${
                                tradingEnabled
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              }`}
                            >
                              {tradingEnabled ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                              <span>{tradingEnabled ? 'ACTIVE' : 'PAUSED'}</span>
                            </button>
                          </div>
                        </div>

                        {/* 1-Click Instant Action Buttons */}
                        <div className="bg-black/50 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                          <span className="text-xs font-bold text-amber-300">1-Click Instant Market Actions</span>
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                            <button
                              onClick={() => handleMarketAction('PUMP')}
                              className="py-2 px-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-500/40 border border-emerald-500/40 text-emerald-300 font-black text-xs transition-all active:scale-95"
                            >
                              🚀 PUMP (+5%)
                            </button>
                            <button
                              onClick={() => handleMarketAction('DUMP')}
                              className="py-2 px-2 rounded-xl bg-rose-600/30 hover:bg-rose-500/40 border border-rose-500/40 text-rose-300 font-black text-xs transition-all active:scale-95"
                            >
                              💥 DUMP (-5%)
                            </button>
                            <button
                              onClick={() => handleMarketAction('MEGA_PUMP')}
                              className="py-2 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition-all active:scale-95"
                            >
                              ⚡ MEGA (+15%)
                            </button>
                            <button
                              onClick={() => handleMarketAction('MEGA_DUMP')}
                              className="py-2 px-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all active:scale-95"
                            >
                              🚨 DUMP (-15%)
                            </button>
                            <button
                              onClick={() => handleMarketAction('FREEZE')}
                              className="py-2 px-2 rounded-xl bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-500/40 text-cyan-300 font-black text-xs transition-all active:scale-95"
                            >
                              ❄️ FREEZE
                            </button>
                            <button
                              onClick={() => handleMarketAction('RESET')}
                              className="py-2 px-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black text-xs transition-all active:scale-95"
                            >
                              🔄 RESET
                            </button>
                          </div>
                        </div>

                        {/* Set Custom Exact Price */}
                        <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
                          <div>
                            <span className="text-xs font-bold text-white block">Set Exact Live Market Price</span>
                            <span className="text-[11px] text-zinc-400">Forces instant price snapshot on all open and upcoming trades</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={targetMarketPrice}
                              onChange={(e) => setTargetMarketPrice(e.target.value)}
                              placeholder="e.g. 52.80"
                              className="w-28 h-8 bg-zinc-900 border border-white/10 rounded-xl px-2 font-mono text-xs text-white focus:outline-none focus:border-amber-500/50"
                            />
                            <button
                              onClick={() => {
                                const p = parseFloat(targetMarketPrice);
                                if (!isNaN(p) && p > 0) handleMarketAction('SET_PRICE', p);
                              }}
                              className="px-3 h-8 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors"
                            >
                              SET PRICE
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Market Trend Bias & Global Outcome Force */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Market Trend Drift */}
                        <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-2.5">
                          <span className="text-xs font-bold text-amber-300">Continuous Market Trend Drift</span>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'NATURAL', label: '⚖️ NATURAL WALK' },
                              { id: 'BULLISH', label: '▲ BULLISH DRIFT' },
                              { id: 'BEARISH', label: '▼ BEARISH DRIFT' },
                              { id: 'HIGH_VOLATILITY', label: '⚡ HIGH VOLATILITY' },
                              { id: 'FLAT', label: '➖ FLAT SIDEWAYS' },
                            ].map((tr) => (
                              <button
                                key={tr.id}
                                onClick={() => {
                                  setMarketTrend(tr.id as any);
                                  handleUpdateTradingControls({ marketTrend: tr.id });
                                }}
                                className={`py-2 px-2 rounded-xl font-bold text-[11px] border transition-colors ${
                                  marketTrend === tr.id
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                    : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
                                }`}
                              >
                                {tr.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Global Outcome Bias */}
                        <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-2.5">
                          <span className="text-xs font-bold text-amber-300">Global Trade Settlement Bias</span>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'NATURAL', label: '⚖️ NATURAL (Fair)' },
                              { id: 'FORCE_ALL_WIN', label: '🏆 FORCE ALL WIN' },
                              { id: 'FORCE_ALL_LOSS', label: '💀 FORCE ALL LOSS' },
                              { id: 'HOUSE_BIAS', label: '🎲 75% HOUSE BIAS' },
                            ].map((om) => (
                              <button
                                key={om.id}
                                onClick={() => {
                                  setTradingOutcomeMode(om.id as any);
                                  handleUpdateTradingControls({ outcomeMode: om.id });
                                }}
                                className={`py-2 px-2 rounded-xl font-bold text-[11px] border transition-colors ${
                                  tradingOutcomeMode === om.id
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                    : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
                                }`}
                              >
                                {om.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Economy Adjustments */}
                      <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                        <span className="text-xs font-bold text-white">Trading Payout & Economy Rules</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-zinc-400 uppercase font-mono">Profit Payout % ({tradingPayoutPercent}% profit = {100 + tradingPayoutPercent}% payout)</label>
                            <input
                              type="number"
                              min="50"
                              max="95"
                              value={tradingPayoutPercent}
                              onChange={(e) => setTradingPayoutPercent(parseInt(e.target.value) || 90)}
                              className="h-9 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-xs text-white"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-zinc-400 uppercase font-mono">Platform Fee % ({tradingFeePercent}%)</label>
                            <input
                              type="number"
                              min="0"
                              max="15"
                              value={tradingFeePercent}
                              onChange={(e) => setTradingFeePercent(parseInt(e.target.value) || 2)}
                              className="h-9 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-xs text-white"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-zinc-400 uppercase font-mono">Volatility Multiplier ({volatilityMultiplier}x)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.5"
                              max="5"
                              value={volatilityMultiplier}
                              onChange={(e) => setVolatilityMultiplier(parseFloat(e.target.value) || 1.0)}
                              className="h-9 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-xs text-white"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => handleUpdateTradingControls()}
                          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors"
                        >
                          SAVE TRADING CONFIGURATION
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. X CRASH (AVIATOR) ADVANCED CONTROLS */}
                  {gameSubTab === 'crash' && (
                    <div className="flex flex-col gap-3">
                      {/* Live Flight Monitor & Emergency Triggers */}
                      <div className="bg-zinc-900/70 border border-rose-500/30 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">✈️</span>
                            <div>
                              <h3 className="text-sm font-extrabold text-white">X Crash (Aviator) Master Suite</h3>
                              <p className="text-[11px] text-zinc-400">Live flight monitor, instant crash triggers, and sequence programming</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const next = !crashEnabled;
                              setCrashEnabled(next);
                              handleUpdateCrashControls({ crashEnabled: next });
                            }}
                            className={`px-3 py-1 rounded-xl font-bold text-xs flex items-center gap-1 border transition-colors ${
                              crashEnabled
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {crashEnabled ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                            <span>{crashEnabled ? 'ENGINE ACTIVE' : 'PAUSED'}</span>
                          </button>
                        </div>

                        {/* Active Round Status Strip */}
                        {fullGameData?.activeCrashRound && (
                          <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between font-mono text-xs">
                            <span className="text-zinc-400">ROUND: <strong className="text-white">{fullGameData.activeCrashRound.roundId}</strong></span>
                            <span className="text-amber-400">STATUS: <strong className="uppercase">{fullGameData.activeCrashRound.status}</strong></span>
                            <span className="text-emerald-400">MULTIPLIER: <strong>{fullGameData.activeCrashRound.currentMultiplier?.toFixed(2)}x</strong></span>
                            <span className="text-zinc-300">PLAYERS: <strong>{fullGameData.activeCrashRound.playerCount}</strong></span>
                          </div>
                        )}

                        {/* Emergency 1-Click Action Traps */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="bg-black/50 p-3 rounded-xl border border-rose-500/30 flex flex-col justify-between">
                            <div>
                              <span className="text-xs font-bold text-rose-400 block">🚨 Instant Emergency Fly Away</span>
                              <span className="text-[11px] text-zinc-400">Instantly blows away the current running flight mid-air</span>
                            </div>
                            <button
                              onClick={() => handleCrashAction('EMERGENCY_FLYAWAY')}
                              className="mt-2 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all active:scale-95"
                            >
                              CRASH NOW (FLEW AWAY)
                            </button>
                          </div>

                          <div className="bg-black/50 p-3 rounded-xl border border-amber-500/30 flex flex-col justify-between">
                            <div>
                              <span className="text-xs font-bold text-amber-300 block">💣 Instant 1.00x Bust Trap</span>
                              <span className="text-[11px] text-zinc-400">Arms next round to crash instantly at 1.00x - 1.02x taking all bets</span>
                            </div>
                            <button
                              onClick={() => handleCrashAction('INSTANT_BUST')}
                              className="mt-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all active:scale-95"
                            >
                              ARM 1.00x BUST TRAP
                            </button>
                          </div>
                        </div>

                        {/* Force Next Crash Point */}
                        <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
                          <div>
                            <span className="text-xs font-bold text-white block">Force Exact Next Crash Multiplier</span>
                            <span className="text-[11px] text-zinc-400">Set next crash point (e.g. 1.25, 2.00, 10.00, 100.00x)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              value={forcedCrashPoint}
                              onChange={(e) => setForcedCrashPoint(e.target.value)}
                              placeholder="e.g. 15.00"
                              className="w-28 h-8 bg-zinc-900 border border-white/10 rounded-xl px-2 font-mono text-xs text-white focus:outline-none focus:border-amber-500/50"
                            />
                            <button
                              onClick={() => {
                                const m = parseFloat(forcedCrashPoint);
                                if (!isNaN(m) && m >= 1.00) handleCrashAction('SET_NEXT_MULTIPLIER', m);
                              }}
                              className="px-3 h-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors"
                            >
                              SET MULTIPLIER
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 5-Round Sequence Queue */}
                      <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-amber-300 block">Pre-Programmed Round Sequence</span>
                            <span className="text-[11px] text-zinc-400">Rounds will pop upcoming multipliers sequentially from this queue</span>
                          </div>
                          {fullGameData?.crashControls?.presetSequence?.length > 0 && (
                            <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                              Queue: {fullGameData.crashControls.presetSequence.join('x, ')}x
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={presetSequenceInput}
                            onChange={(e) => setPresetSequenceInput(e.target.value)}
                            placeholder="e.g. 1.20, 1.80, 5.00, 1.05"
                            className="flex-1 h-9 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-xs text-white"
                          />
                          <button
                            onClick={() => handleArmPresetSequence('CUSTOM')}
                            className="px-3 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs"
                          >
                            ARM QUEUE
                          </button>
                          <button
                            onClick={() => handleCrashAction('CLEAR_SEQUENCE')}
                            className="px-3 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-bold text-xs"
                          >
                            CLEAR
                          </button>
                        </div>

                        {/* Preset Quick Sequence Templates */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400 uppercase font-mono">QUICK PRESETS:</span>
                          <button
                            onClick={() => handleArmPresetSequence('BAIT_HIGH')}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-amber-300 font-bold border border-white/5"
                          >
                            🎣 High Roller Bait
                          </button>
                          <button
                            onClick={() => handleArmPresetSequence('BUST_TRAP')}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-rose-300 font-bold border border-white/5"
                          >
                            💣 Bust Trap Series
                          </button>
                          <button
                            onClick={() => handleArmPresetSequence('GENEROUS')}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-emerald-300 font-bold border border-white/5"
                          >
                            ✨ Generous Streak
                          </button>
                        </div>
                      </div>

                      {/* Bot Players & House Edge Settings */}
                      <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                        <span className="text-xs font-bold text-white">Aviator House Edge & Bot Simulator</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-zinc-400 uppercase font-mono">House Edge BPS ({(crashHouseEdgeBps / 100).toFixed(1)}%)</label>
                            <input
                              type="number"
                              min="100"
                              max="2000"
                              step="50"
                              value={crashHouseEdgeBps}
                              onChange={(e) => setCrashHouseEdgeBps(parseInt(e.target.value) || 300)}
                              className="h-9 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-xs text-white"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-zinc-400 uppercase font-mono">Betting Window ({crashBettingDurationMs / 1000}s)</label>
                            <input
                              type="number"
                              min="2000"
                              max="15000"
                              step="1000"
                              value={crashBettingDurationMs}
                              onChange={(e) => setCrashBettingDurationMs(parseInt(e.target.value) || 5000)}
                              className="h-9 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-xs text-white"
                            />
                          </div>
                          <div className="flex flex-col justify-end">
                            <button
                              onClick={() => {
                                const next = !crashBotSimulationEnabled;
                                setCrashBotSimulationEnabled(next);
                                handleUpdateCrashControls({ botSimulationEnabled: next });
                              }}
                              className={`h-9 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-colors ${
                                crashBotSimulationEnabled
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-zinc-800 text-zinc-400 border-white/10'
                              }`}
                            >
                              <Bot className="w-3.5 h-3.5" />
                              <span>{crashBotSimulationEnabled ? 'BOTS SIMULATION ACTIVE' : 'BOTS DISABLED'}</span>
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUpdateCrashControls()}
                          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors"
                        >
                          SAVE CRASH CONFIGURATION
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 3. MINING TAP ENGINE & ANTI-CHEAT CONTROLS */}
                  {gameSubTab === 'tap' && (
                    <div className="flex flex-col gap-3">
                      {/* Global Multiplier & Golden Hour */}
                      <div className="bg-zinc-900/70 border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">⚡</span>
                            <div>
                              <h3 className="text-sm font-extrabold text-white">Tap Mining Engine & Events</h3>
                              <p className="text-[11px] text-zinc-400">Configure global mining multipliers, Golden Tap Hour, and anti-autoclicker limits</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const next = !tapEnabled;
                              setTapEnabled(next);
                              handleUpdateTapControls({ tapEnabled: next });
                            }}
                            className={`px-3 py-1 rounded-xl font-bold text-xs flex items-center gap-1 border transition-colors ${
                              tapEnabled
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            }`}
                          >
                            {tapEnabled ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                            <span>{tapEnabled ? 'MINING ACTIVE' : 'MINING PAUSED'}</span>
                          </button>
                        </div>

                        {/* Golden Tap Hour Banner Switch */}
                        <div className="bg-black/50 p-3 rounded-xl border border-amber-500/30 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-yellow-300 block">🔥 Golden Tap Hour Event</span>
                            <span className="text-[11px] text-zinc-400">Broadcasts animated glowing event banner to all live tap miners</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const next = !goldenHourActive;
                                setGoldenHourActive(next);
                                handleUpdateTapControls({ goldenHourActive: next });
                              }}
                              className={`px-4 py-2 rounded-xl font-black text-xs transition-all active:scale-95 ${
                                goldenHourActive
                                  ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(251,191,36,0.5)]'
                                  : 'bg-zinc-800 text-zinc-400 hover:text-white border border-white/10'
                              }`}
                            >
                              {goldenHourActive ? 'GOLDEN HOUR ON' : 'ACTIVATE EVENT'}
                            </button>
                          </div>
                        </div>

                        {/* Global Tap Multiplier Presets */}
                        <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                          <span className="text-xs font-bold text-white">Global Tap Reward Multiplier</span>
                          <div className="grid grid-cols-5 gap-2">
                            {[1, 2, 3, 5, 10].map((mult) => (
                              <button
                                key={mult}
                                onClick={() => {
                                  setTapMultiplier(mult);
                                  handleUpdateTapControls({ tapMultiplier: mult });
                                }}
                                className={`py-2 rounded-xl font-black text-xs border transition-colors ${
                                  tapMultiplier === mult
                                    ? 'bg-amber-500 text-black border-amber-400'
                                    : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
                                }`}
                              >
                                {mult}X BOOST
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Energy Recharge & Anti-Cheat */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                            <span className="text-xs font-bold text-white">Energy Recharge Multiplier</span>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[1, 2, 3, 5].map((rm) => (
                                <button
                                  key={rm}
                                  onClick={() => {
                                    setEnergyRechargeMultiplier(rm);
                                    handleUpdateTapControls({ energyRechargeMultiplier: rm });
                                  }}
                                  className={`py-1.5 rounded-lg font-bold text-xs border transition-colors ${
                                    energyRechargeMultiplier === rm
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                      : 'bg-zinc-900 text-zinc-400 border-white/5'
                                  }`}
                                >
                                  {rm}X REGEN
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
                            <span className="text-xs font-bold text-white">Anti-Autoclicker CPS Cap</span>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[15, 25, 40, 60].map((cps) => (
                                <button
                                  key={cps}
                                  onClick={() => {
                                    setMaxCpsLimit(cps);
                                    handleUpdateTapControls({ maxCpsLimit: cps });
                                  }}
                                  className={`py-1.5 rounded-lg font-bold text-xs border transition-colors ${
                                    maxCpsLimit === cps
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                      : 'bg-zinc-900 text-zinc-400 border-white/5'
                                  }`}
                                >
                                  {cps} CPS
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. PLAYER RIGGING & HANDICAP CENTER */}
                  {gameSubTab === 'rigging' && (
                    <div className="flex flex-col gap-3">
                      <div className="bg-zinc-900/70 border border-purple-500/30 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🎯</span>
                          <div>
                            <h3 className="text-sm font-extrabold text-white">Target Player Outcome Bias & Rigging</h3>
                            <p className="text-[11px] text-zinc-400">Force individual accounts to win or lose on all binary trades and crash flights</p>
                          </div>
                        </div>

                        {/* Rig Configuration Form */}
                        <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col gap-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-zinc-400 uppercase font-mono">Telegram User ID</label>
                              <input
                                type="text"
                                value={rigTargetUserId}
                                onChange={(e) => setRigTargetUserId(e.target.value)}
                                placeholder="e.g. 5984920412"
                                className="h-9 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-xs text-white focus:outline-none focus:border-amber-500/50"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-zinc-400 uppercase font-mono">Reason / Audit Tag</label>
                              <input
                                type="text"
                                value={rigReason}
                                onChange={(e) => setRigReason(e.target.value)}
                                placeholder="e.g. VIP high roller perk"
                                className="h-9 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-amber-500/50"
                              />
                            </div>
                          </div>

                          {/* Outcome Mode Buttons */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] text-zinc-400 uppercase font-mono">Outcome Bias Mode</label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              {[
                                { id: 'FORCE_WIN', label: '🏆 FORCE WIN (100%)', color: 'emerald' },
                                { id: 'FORCE_LOSS', label: '💀 FORCE LOSS (100%)', color: 'rose' },
                                { id: 'HIGH_LUCK', label: '🌟 85% HIGH LUCK', color: 'amber' },
                                { id: 'LOW_LUCK', label: '📉 15% LOW LUCK', color: 'zinc' },
                                { id: 'NORMAL', label: '⚖️ NORMAL (Fair)', color: 'blue' },
                              ].map((m) => (
                                <button
                                  key={m.id}
                                  onClick={() => setRigMode(m.id as any)}
                                  className={`py-2 px-2 rounded-xl font-bold text-[11px] border transition-colors ${
                                    rigMode === m.id
                                      ? 'bg-amber-500 text-black border-amber-400 font-black'
                                      : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={handleSetUserRig}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-xs shadow-md transition-all active:scale-98"
                          >
                            APPLY RIGGING HANDICAP TO USER
                          </button>
                        </div>

                        {/* List of Rigged Users */}
                        <div className="flex flex-col gap-2 mt-1">
                          <span className="text-xs font-bold text-white">Actively Rigged Players ({riggedUsersList.length})</span>
                          {riggedUsersList.length === 0 ? (
                            <span className="text-xs text-zinc-500 font-mono italic">No user-specific rigging active. All players are in Natural fair mode.</span>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {riggedUsersList.map((r) => (
                                <div
                                  key={r.userId}
                                  className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono font-bold text-amber-300">ID: {r.userId}</span>
                                    {r.username && <span className="text-xs text-zinc-400">(@{r.username})</span>}
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                                      r.mode === 'FORCE_WIN' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                      r.mode === 'FORCE_LOSS' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                      'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    }`}>
                                      {r.mode} {r.customWinRatePercent ? `(${r.customWinRatePercent}%)` : ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-zinc-500 hidden sm:inline">{r.reason}</span>
                                    <button
                                      onClick={() => handleRemoveUserRig(r.userId)}
                                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 text-xs font-bold transition-colors"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 5. LIVE TELEMETRY & HOUSE FINANCIALS */}
                  {gameSubTab === 'telemetry' && (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-zinc-900/70 border border-emerald-500/30 p-3 rounded-2xl flex flex-col">
                          <span className="text-[10px] text-zinc-400 font-mono">NET HOUSE XC PROFIT</span>
                          <span className="text-xl font-mono font-black text-emerald-400 mt-1">
                            +{(fullGameData?.gameTelemetry?.totalHouseProfitXC || 0).toLocaleString()} XC
                          </span>
                          <span className="text-[10px] text-zinc-400 mt-1">Crash + Trading Fees</span>
                        </div>

                        <div className="bg-zinc-900/70 border border-white/10 p-3 rounded-2xl flex flex-col">
                          <span className="text-[10px] text-zinc-400 font-mono">CRASH BET TURNOVER</span>
                          <span className="text-xl font-mono font-black text-white mt-1">
                            {(fullGameData?.gameTelemetry?.totalCrashBetVolumeXC || 0).toLocaleString()} XC
                          </span>
                          <span className="text-[10px] text-rose-400 mt-1">
                            Paid: {(fullGameData?.gameTelemetry?.totalCrashPayoutVolumeXC || 0).toLocaleString()} XC
                          </span>
                        </div>

                        <div className="bg-zinc-900/70 border border-white/10 p-3 rounded-2xl flex flex-col">
                          <span className="text-[10px] text-zinc-400 font-mono">TRADING TURNOVER</span>
                          <span className="text-xl font-mono font-black text-amber-300 mt-1">
                            {(fullGameData?.gameTelemetry?.totalTradingVolumeXC || 0).toLocaleString()} XC
                          </span>
                          <span className="text-[10px] text-zinc-400 mt-1">Total Binary Trades</span>
                        </div>

                        <div className="bg-zinc-900/70 border border-white/10 p-3 rounded-2xl flex flex-col">
                          <span className="text-[10px] text-zinc-400 font-mono">LIVE OPEN EXPOSURE</span>
                          <span className="text-xl font-mono font-black text-yellow-300 mt-1">
                            {((fullGameData?.gameTelemetry?.activeCrashBetVolume || 0) + (fullGameData?.gameTelemetry?.activeOpenTradesVolume || 0)).toLocaleString()} XC
                          </span>
                          <span className="text-[10px] text-zinc-400 mt-1">
                            {fullGameData?.gameTelemetry?.activeOpenTradesCount || 0} open positions
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: USERS & BALANCES (EDIT ALL USER DETAILS) */}
              {activeSection === 'users' && (
                <div className="flex flex-col gap-3">
                  {/* Search Bar */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search user by Telegram ID, name or username..."
                        className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3 text-xs text-white focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>

                  {/* User Editor Modal Overlay if a user is selected */}
                  {selectedUserForEdit && (
                    <div className="bg-zinc-900/90 border border-amber-500/40 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <div>
                          <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                            <span>Editing User: {selectedUserForEdit.firstName}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              ({selectedUserForEdit.telegramUserId})
                            </span>
                          </h4>
                        </div>
                        <button
                          onClick={() => setSelectedUserForEdit(null)}
                          className="text-zinc-400 hover:text-white text-xs"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        {/* XCOIN Balance */}
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">
                            XCOIN BALANCE
                          </label>
                          <input
                            type="number"
                            value={editXcoinBalance}
                            onChange={(e) => setEditXcoinBalance(parseInt(e.target.value) || 0)}
                            className="w-full h-8 bg-black/60 border border-white/10 rounded-lg px-2 font-mono text-white text-xs"
                          />
                        </div>

                        {/* XC Balance */}
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">
                            XC TRADING BALANCE
                          </label>
                          <input
                            type="number"
                            value={editXcBalance}
                            onChange={(e) => setEditXcBalance(parseInt(e.target.value) || 0)}
                            className="w-full h-8 bg-black/60 border border-white/10 rounded-lg px-2 font-mono text-white text-xs"
                          />
                        </div>

                        {/* User Status */}
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">
                            USER STATUS
                          </label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="w-full h-8 bg-black/60 border border-white/10 rounded-lg px-2 text-white text-xs"
                          >
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="FROZEN">FROZEN</option>
                            <option value="RESTRICTED">RESTRICTED</option>
                            <option value="BANNED">BANNED</option>
                          </select>
                        </div>

                        {/* VIP Tier */}
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">
                            VIP MEMBERSHIP TIER
                          </label>
                          <select
                            value={editVipTier}
                            onChange={(e) => setEditVipTier(e.target.value)}
                            className="w-full h-8 bg-black/60 border border-white/10 rounded-lg px-2 text-white text-xs"
                          >
                            <option value="Free">Free</option>
                            <option value="Standard">Standard ($1)</option>
                            <option value="Premium">Premium ($3)</option>
                            <option value="Pro">Pro ($5)</option>
                            <option value="Elite">Elite ($10)</option>
                            <option value="Master">Master ($25)</option>
                            <option value="Diamond">Diamond ($50)</option>
                            <option value="Legend">Legend ($100)</option>
                          </select>
                        </div>

                        {/* Tap Power */}
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">
                            TAP POWER (+per tap)
                          </label>
                          <input
                            type="number"
                            value={editTapPower}
                            onChange={(e) => setEditTapPower(parseInt(e.target.value) || 1)}
                            className="w-full h-8 bg-black/60 border border-white/10 rounded-lg px-2 font-mono text-white text-xs"
                          />
                        </div>

                        {/* Energy Capacity */}
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">
                            ENERGY CAPACITY
                          </label>
                          <input
                            type="number"
                            value={editEnergyCapacity}
                            onChange={(e) => setEditEnergyCapacity(parseInt(e.target.value) || 100)}
                            className="w-full h-8 bg-black/60 border border-white/10 rounded-lg px-2 font-mono text-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                        <button
                          onClick={() => setSelectedUserForEdit(null)}
                          className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={isSavingUser}
                          onClick={handleSaveUser}
                          className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSavingUser ? 'Saving...' : 'Save Changes'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Users Table */}
                  <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto no-scrollbar">
                    {filteredUsers.length === 0 ? (
                      <div className="text-center py-6 text-xs text-zinc-500 font-mono">
                        No matching users found
                      </div>
                    ) : (
                      filteredUsers.map((u: any) => (
                        <div
                          key={u.telegramUserId}
                          className="bg-zinc-900/60 border border-white/5 p-2.5 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center font-bold text-amber-300">
                              {u.firstName?.[0] || 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white">{u.firstName}</span>
                                {u.username && (
                                  <span className="text-zinc-500 text-[11px]">@{u.username}</span>
                                )}
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                    u.status === 'ACTIVE'
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-rose-500/20 text-rose-400'
                                  }`}
                                >
                                  {u.status}
                                </span>
                              </div>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                ID: {u.telegramUserId} • VIP: {u.vipTier || 'Free'}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSelectUser(u)}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Balance & User</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: ADMINS & RBAC (CUSTOMIZE & CREATE SUB-ADMINS) */}
              {activeSection === 'admins' && (
                <div className="flex flex-col gap-4">
                  {/* Create New Sub-Admin Form */}
                  <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-400" />
                      <span>Create New Sub-Administrator</span>
                    </h3>

                    <form onSubmit={handleCreateKey} className="flex flex-col gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">
                            ADMIN / AGENT NAME
                          </label>
                          <input
                            type="text"
                            required
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            placeholder="e.g. John Doe (Support Lead)"
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">
                            ROLE TEMPLATE
                          </label>
                          <select
                            value={newKeyRole}
                            onChange={(e) => setNewKeyRole(e.target.value)}
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-2 text-white text-xs"
                          >
                            <option value="ADMIN">ADMIN (Full Sub-Admin)</option>
                            <option value="SUPPORT">SUPPORT (User Inquiries)</option>
                            <option value="TRADING_MANAGER">TRADING MANAGER</option>
                            <option value="FINANCIAL_OFFICER">FINANCIAL OFFICER</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors"
                      >
                        + GENERATE NEW ADMIN KEY
                      </button>
                    </form>

                    {/* Show Generated Plaintext Key ONCE */}
                    {generatedRawKey && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs flex flex-col gap-1.5 font-mono">
                        <span className="font-bold text-amber-300">
                          SECRET KEY GENERATED (COPIABLE ONCE):
                        </span>
                        <div className="p-2 bg-black/80 rounded-lg select-all border border-amber-500/20 text-white font-bold break-all">
                          {generatedRawKey}
                        </div>
                        <span className="text-[10px] text-zinc-400">
                          Copy and send this key securely to your administrator.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Existing Admin Keys List */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase">
                      Active Sub-Admins & Keys
                    </h4>
                    {(dashboardData?.adminKeys || []).map((k: any) => (
                      <div
                        key={k.keyId}
                        className="bg-zinc-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{k.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/15 text-amber-300">
                              {k.role}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                k.status === 'ACTIVE'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {k.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                            ID: {k.keyId} • Created: {new Date(k.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {k.keyId !== 'KEY-MASTER-01' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleToggleKeyStatus(k)}
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-[11px]"
                            >
                              {k.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => handleDeleteKey(k.keyId)}
                              className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                              title="Delete Key"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: CHANGE OWNER MASTER KEY */}
              {activeSection === 'owner_key' && (
                <div className="bg-zinc-900/70 border border-amber-500/30 rounded-2xl p-5 flex flex-col gap-4 max-w-md mx-auto w-full">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/40">
                      <Lock className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">
                        Change Master Owner Key
                      </h3>
                      <span className="text-xs text-zinc-400">
                        Update the top-secret master key for Telegram ID {OWNER_TELEGRAM_ID}
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleChangeOwnerKey} className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">
                        NEW MASTER KEY / PASSWORD
                      </label>
                      <input
                        type="password"
                        required
                        value={newOwnerKey}
                        onChange={(e) => setNewOwnerKey(e.target.value)}
                        placeholder="Enter new strong password"
                        className="w-full h-10 bg-black/60 border border-white/10 rounded-xl px-3 font-mono text-xs text-white focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-1">
                        CONFIRM NEW MASTER KEY
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmOwnerKey}
                        onChange={(e) => setConfirmOwnerKey(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full h-10 bg-black/60 border border-white/10 rounded-xl px-3 font-mono text-xs text-white focus:outline-none focus:border-amber-500/50"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isChangingKey}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-xs shadow-md transition-all active:scale-[0.98] hover:from-amber-400 hover:to-yellow-300 mt-1"
                    >
                      {isChangingKey ? 'SAVING KEY...' : 'UPDATE OWNER MASTER PASSWORD'}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 6: VIP PAYMENT ORDERS */}
              {activeSection === 'payments' && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase">VIP Orders</h4>
                  {(dashboardData?.paymentOrders || []).length === 0 ? (
                    <div className="text-center py-6 text-xs text-zinc-500 font-mono">
                      No payment orders yet
                    </div>
                  ) : (
                    (dashboardData?.paymentOrders || []).map((o: any) => (
                      <div
                        key={o.orderId}
                        className="bg-zinc-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{o.orderId}</span>
                            <span className="text-emerald-400 font-mono font-bold">
                              ${o.priceUSD} USD
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                o.status === 'APPROVED'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : o.status === 'REJECTED'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {o.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                            User: {o.userId} • TXID: {o.txid?.slice(0, 16)}...
                          </span>
                        </div>

                        {(o.status === 'UNDER_REVIEW' || o.status === 'PENDING') && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                await apiFetch('/api/admin/vip/review', {
                                  method: 'POST',
                                  body: JSON.stringify({ orderId: o.orderId, action: 'APPROVE' }),
                                });
                                fetchDashboard();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[11px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                await apiFetch('/api/admin/vip/review', {
                                  method: 'POST',
                                  body: JSON.stringify({ orderId: o.orderId, action: 'REJECT' }),
                                });
                                fetchDashboard();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-extrabold text-[11px]"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 7: WITHDRAWALS */}
              {activeSection === 'withdrawals' && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase">
                    Withdrawal Requests
                  </h4>
                  {(dashboardData?.withdrawals || []).length === 0 ? (
                    <div className="text-center py-6 text-xs text-zinc-500 font-mono">
                      No withdrawal requests yet
                    </div>
                  ) : (
                    (dashboardData?.withdrawals || []).map((w: any) => (
                      <div
                        key={w.withdrawalId}
                        className="bg-zinc-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{w.withdrawalId}</span>
                            <span className="text-amber-300 font-mono font-bold">
                              {w.amountXcoin?.toLocaleString()} XCOIN
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-zinc-800 text-zinc-300">
                              {w.status}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                            Dest: {w.destinationType} • Address: {w.destinationAddress?.slice(0, 16)}...
                          </span>
                        </div>

                        {w.status === 'UNDER_REVIEW' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                await apiFetch('/api/admin/withdrawal/review', {
                                  method: 'POST',
                                  body: JSON.stringify({ withdrawalId: w.withdrawalId, action: 'APPROVE' }),
                                });
                                fetchDashboard();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[11px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                await apiFetch('/api/admin/withdrawal/review', {
                                  method: 'POST',
                                  body: JSON.stringify({ withdrawalId: w.withdrawalId, action: 'REJECT' }),
                                });
                                fetchDashboard();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-extrabold text-[11px]"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 8: SYSTEM SETTINGS & BROADCAST NOTICE */}
              {activeSection === 'system' && (
                <div className="flex flex-col gap-4">
                  {/* Broadcast Announcement */}
                  <div className="bg-zinc-900/70 border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-extrabold text-white">
                        System Announcement Banner
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Write an announcement to broadcast across the top of all players' screens in real time.
                    </p>

                    <div className="flex flex-col gap-2">
                      <textarea
                        rows={2}
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        placeholder="e.g. 🚀 Weekend 2x Tap Mining Bonus is now active! Happy trading!"
                        className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
                      />
                      <button
                        onClick={handleSaveAnnouncement}
                        className="py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors self-end px-5"
                      >
                        BROADCAST ANNOUNCEMENT
                      </button>
                    </div>
                  </div>

                  {/* System Emergency Toggles */}
                  <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                    <h3 className="text-sm font-extrabold text-white">
                      Global Kill Switches & Toggles
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      {[
                        { key: 'tradingEnabled', label: 'QX Trading' },
                        { key: 'crashEnabled', label: 'Aviator Crash' },
                        { key: 'withdrawalsEnabled', label: 'Withdrawals' },
                        { key: 'vipEnabled', label: 'VIP Upgrades' },
                        { key: 'maintenanceMode', label: 'Maintenance Mode' },
                      ].map((item) => {
                        const isEnabled = !!dashboardData?.config?.[item.key];
                        return (
                          <button
                            key={item.key}
                            onClick={async () => {
                              await apiFetch('/api/admin/config/update', {
                                method: 'POST',
                                body: JSON.stringify({
                                  newConfig: { [item.key]: !isEnabled },
                                }),
                              });
                              fetchDashboard();
                            }}
                            className={`p-2.5 rounded-xl border flex items-center justify-between font-bold text-xs transition-colors ${
                              isEnabled
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                                : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                            }`}
                          >
                            <span>{item.label}</span>
                            <span>{isEnabled ? 'ON' : 'OFF'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 8.5: WITHDRAWAL TASKS MANAGER */}
              {activeSection === 'tasks' && (
                <div className="flex flex-col gap-4">
                  {/* Create New Task Form */}
                  <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-amber-400" />
                        <span>Create Withdrawal Task / Requirement</span>
                      </h3>
                      <button
                        type="button"
                        onClick={fetchTasks}
                        className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 font-mono"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Configure prerequisite tasks that users must complete (e.g. 15 Invites, 50,000 XC trading volume) to unlock balance withdrawals.
                    </p>

                    <form onSubmit={handleCreateTask} className="flex flex-col gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">TASK TITLE</label>
                          <input
                            type="text"
                            required
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="e.g. Invite 15 Friends"
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">TASK TYPE</label>
                          <select
                            value={newTaskType}
                            onChange={(e) => {
                              const t = e.target.value;
                              setNewTaskType(t);
                              if (t === 'INVITES') {
                                setNewTaskUnit('Friends');
                                setNewTaskLabel('Invite Friends');
                                setNewTaskUrl('friends');
                              } else if (t === 'TRADING_VOLUME') {
                                setNewTaskUnit('XC Vol');
                                setNewTaskLabel('Trade Now');
                                setNewTaskUrl('trading');
                              } else if (t === 'TAP_COUNT') {
                                setNewTaskUnit('Mined');
                                setNewTaskLabel('Mine Now');
                                setNewTaskUrl('tap');
                              } else {
                                setNewTaskUnit('Action');
                                setNewTaskLabel('Visit Link');
                                setNewTaskUrl('');
                              }
                            }}
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-2 text-white text-xs"
                          >
                            <option value="INVITES">Friends Invited (INVITES)</option>
                            <option value="TRADING_VOLUME">Trading Volume XC (TRADING_VOLUME)</option>
                            <option value="TAP_COUNT">Coins Mined (TAP_COUNT)</option>
                            <option value="CUSTOM_ACTION">Custom Action / Link Visit</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">TARGET VALUE</label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={newTaskTarget}
                            onChange={(e) => setNewTaskTarget(Number(e.target.value))}
                            placeholder="e.g. 15 or 50000"
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">UNIT LABEL</label>
                          <input
                            type="text"
                            value={newTaskUnit}
                            onChange={(e) => setNewTaskUnit(e.target.value)}
                            placeholder="e.g. Friends, XC Vol"
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">ACTION BUTTON LABEL</label>
                          <input
                            type="text"
                            value={newTaskLabel}
                            onChange={(e) => setNewTaskLabel(e.target.value)}
                            placeholder="e.g. Complete Now"
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">ACTION LINK / TAB</label>
                          <input
                            type="text"
                            value={newTaskUrl}
                            onChange={(e) => setNewTaskUrl(e.target.value)}
                            placeholder="e.g. friends, trading, or https://t.me/..."
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">TASK DESCRIPTION</label>
                        <input
                          type="text"
                          value={newTaskDesc}
                          onChange={(e) => setNewTaskDesc(e.target.value)}
                          placeholder="e.g. Bring 15 real friends to qualify for fast instant withdrawals"
                          className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={newTaskRequired}
                            onChange={(e) => setNewTaskRequired(e.target.checked)}
                            className="rounded border-zinc-700 text-amber-500 focus:ring-0 w-4 h-4"
                          />
                          <span className="font-bold">Required for Withdrawal</span>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={isCreatingTask}
                        className="mt-2 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isCreatingTask ? 'Creating Task...' : 'Publish Withdrawal Task'}</span>
                      </button>
                    </form>
                  </div>

                  {/* List of Tasks */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase">
                      Active Tasks ({tasksList.length})
                    </h4>
                    {tasksList.length === 0 ? (
                      <div className="text-center py-6 text-xs text-zinc-500 font-mono">
                        No tasks created yet.
                      </div>
                    ) : (
                      tasksList.map((t) => (
                        <div
                          key={t.taskId}
                          className="bg-zinc-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-sm">{t.title}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Target: {t.targetValue.toLocaleString()} {t.unitLabel}
                              </span>
                              {t.isRequiredForWithdrawal && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  MANDATORY
                                </span>
                              )}
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                  t.enabled
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-zinc-700 text-zinc-400'
                                }`}
                              >
                                {t.enabled ? 'ACTIVE' : 'DISABLED'}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">{t.description}</p>
                            <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                              Type: {t.type} • Action: {t.actionLabel} ({t.actionUrl})
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleToggleTask(t)}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                                t.enabled
                                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                              }`}
                            >
                              {t.enabled ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => handleDeleteTask(t.taskId)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                              title="Delete Task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 8.6: STORE & INVESTMENT ASSET MANAGER */}
              {activeSection === 'store' && (
                <div className="flex flex-col gap-4">
                  {/* Create New Store Asset Form */}
                  <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-amber-400" />
                        <span>Publish New Store Investment Item</span>
                      </h3>
                      <button
                        type="button"
                        onClick={fetchStoreAssets}
                        className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 font-mono"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Add bikes, cars, Telegram Stars, TikTok gifts, or mining real estate that users can purchase with XC/XCOIN for passive daily dividends, rate, and trade in P2P marketplace.
                    </p>

                    <form onSubmit={handleCreateAsset} className="flex flex-col gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">ITEM NAME</label>
                          <input
                            type="text"
                            required
                            value={newAssetTitle}
                            onChange={(e) => setNewAssetTitle(e.target.value)}
                            placeholder="e.g. Bugatti Chiron Pur Sport"
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">CATEGORY</label>
                          <select
                            value={newAssetCategory}
                            onChange={(e) => setNewAssetCategory(e.target.value)}
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-2 text-white text-xs"
                          >
                            <option value="VEHICLES">Vehicles (Superbikes & Luxury Cars)</option>
                            <option value="STAR_GIFT">Stars & Social Gifts (TG Stars, TikTok)</option>
                            <option value="REAL_ESTATE">Real Estate & Luxury Properties</option>
                            <option value="MINER">Mining Rig & Tech Infrastructure</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">PRICE IN XC</label>
                          <input
                            type="number"
                            required
                            min={100}
                            value={newAssetPriceXC}
                            onChange={(e) => setNewAssetPriceXC(Number(e.target.value))}
                            placeholder="e.g. 50000"
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs font-mono"
                          />
                          <span className="text-[10px] text-amber-400/80 mt-0.5 block">
                            Equivalent: {(newAssetPriceXC * 5).toLocaleString()} XCOIN
                          </span>
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">DAILY PROFIT YIELD (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="50"
                            required
                            value={newAssetDailyProfit}
                            onChange={(e) => setNewAssetDailyProfit(Number(e.target.value))}
                            placeholder="e.g. 4.5"
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs font-mono"
                          />
                          <span className="text-[10px] text-emerald-400/80 mt-0.5 block">
                            Daily yield: ~{Math.round(newAssetPriceXC * (newAssetDailyProfit / 100)).toLocaleString()} XC/day
                          </span>
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">ICON EMOJI</label>
                          <input
                            type="text"
                            value={newAssetEmoji}
                            onChange={(e) => setNewAssetEmoji(e.target.value)}
                            placeholder="e.g. 🏍️, 🏎️, ⭐, 🦁"
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-1">IMAGE URL (OPTIONAL)</label>
                          <input
                            type="url"
                            value={newAssetImage}
                            onChange={(e) => setNewAssetImage(e.target.value)}
                            placeholder="https://..."
                            className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-1">DESCRIPTION</label>
                        <input
                          type="text"
                          value={newAssetDesc}
                          onChange={(e) => setNewAssetDesc(e.target.value)}
                          placeholder="e.g. Hypercar asset delivering elite daily mining yields and trading prestige"
                          className="w-full h-9 bg-black/60 border border-white/10 rounded-xl px-3 text-white text-xs"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isCreatingAsset}
                        className="mt-2 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isCreatingAsset ? 'Publishing Item...' : 'Publish to Store'}</span>
                      </button>
                    </form>
                  </div>

                  {/* List of Store Assets */}
                  <div className="flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase">
                      Current Store Inventory ({adminStoreAssets.length})
                    </h4>
                    {adminStoreAssets.length === 0 ? (
                      <div className="text-center py-6 text-xs text-zinc-500 font-mono">
                        No store assets found.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {adminStoreAssets.map((asset) => (
                          <div
                            key={asset.assetId}
                            className="bg-zinc-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-xl shrink-0">
                                {asset.iconEmoji || '💎'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-white text-xs truncate max-w-[150px]">
                                    {asset.title}
                                  </span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300">
                                    {asset.category}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400">
                                  <span className="font-mono text-amber-300 font-bold">
                                    {asset.priceXC.toLocaleString()} XC
                                  </span>
                                  <span className="font-mono text-emerald-400 font-bold">
                                    +{asset.dailyProfitPercent}%/day
                                  </span>
                                </div>
                                <div className="text-[9px] text-zinc-500 mt-0.5 font-mono">
                                  ⭐ {(asset.rating || 5.0).toFixed(1)} ({asset.ratingCount || 0} reviews)
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteAsset(asset.assetId)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 shrink-0"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 9: AUDIT LOGS */}
              {activeSection === 'audit' && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase">
                    Audit Trail (Last 100 Events)
                  </h4>
                  <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto no-scrollbar font-mono text-[11px]">
                    {(dashboardData?.auditLogs || []).map((log: any) => (
                      <div
                        key={log.auditLogId}
                        className="bg-zinc-900/60 border border-white/5 p-2 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold">{log.action}</span>
                          <span className="text-zinc-500 text-[10px]">by {log.adminId}</span>
                        </div>
                        <span className="text-zinc-500 text-[10px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
