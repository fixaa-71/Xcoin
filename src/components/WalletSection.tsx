import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  UserWallet,
  WalletTransaction,
  WithdrawalRequest,
  WithdrawalEligibilityResult,
} from '../types';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  History,
  Lock,
  Unlock,
  Users,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  Pickaxe,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { CoinIcon } from './CoinIcon';

interface WalletSectionProps {
  user: UserProfile;
  wallet: UserWallet;
  onUpdateWallet: (wallet: UserWallet) => void;
  triggerHaptic: (type?: any) => void;
  onNavigate?: (tab: string) => void;
}

export const WalletSection: React.FC<WalletSectionProps> = ({
  user,
  wallet,
  onUpdateWallet,
  triggerHaptic,
  onNavigate,
}) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'convert' | 'withdraw' | 'history'>('convert');
  const [eligibility, setEligibility] = useState<WithdrawalEligibilityResult | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  // Conversion Form State
  const [convDirection, setConvDirection] = useState<'XC_TO_XCOIN' | 'XCOIN_TO_XC'>('XCOIN_TO_XC');
  const [convAmount, setConvAmount] = useState<number>(5000);
  const [isConverting, setIsConverting] = useState<boolean>(false);

  // Withdrawal Form State
  const [withdrawAmount, setWithdrawAmount] = useState<number>(50000);
  const [destType, setDestType] = useState<'USDT' | 'TON'>('USDT');
  const [destNetwork, setDestNetwork] = useState<string>('TRC20');
  const [destAddress, setDestAddress] = useState<string>('');
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);

  // Alerts
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    try {
      const data = await apiFetch('/api/withdrawal/tasks');
      setEligibility(data);
    } catch (err) {
      console.warn('Failed to fetch withdrawal tasks:', err);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const fetchWalletData = async () => {
    try {
      const data = await apiFetch('/api/wallet/history');
      setTransactions(data.transactions || []);
      setWithdrawals(data.withdrawals || []);
      if (data.wallet) onUpdateWallet(data.wallet);
    } catch (err) {
      console.warn('Wallet history fetch warning:', err);
    }
  };

  useEffect(() => {
    fetchWalletData();
    fetchTasks();
  }, []);

  const handleCompleteCustomTask = async (taskId: string, actionUrl?: string) => {
    if (actionUrl?.startsWith('http')) {
      window.open(actionUrl, '_blank');
    }
    setCompletingTaskId(taskId);
    try {
      const data = await apiFetch('/api/withdrawal/tasks/complete-custom', {
        method: 'POST',
        body: JSON.stringify({ taskId }),
      });
      triggerHaptic('success');
      setEligibility(data.eligibility);
      setSuccessMessage(data.message || 'Task completed!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete task');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConverting(true);
    setErrorMessage(null);

    try {
      const data = await apiFetch('/api/conversion', {
        method: 'POST',
        body: JSON.stringify({
          direction: convDirection,
          amount: convAmount,
        }),
      });

      triggerHaptic('success');
      onUpdateWallet(data.wallet);
      setSuccessMessage('Conversion successful!');
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchWalletData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Conversion failed');
      triggerHaptic('error');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsConverting(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destAddress.trim()) {
      setErrorMessage('Please provide a valid destination wallet address');
      return;
    }

    setIsWithdrawing(true);
    setErrorMessage(null);

    try {
      const data = await apiFetch('/api/withdrawal', {
        method: 'POST',
        body: JSON.stringify({
          amountXcoin: withdrawAmount,
          destinationType: destType,
          destinationAddress: destAddress.trim(),
          network: destNetwork,
        }),
      });

      triggerHaptic('success');
      setSuccessMessage('Withdrawal request submitted for review!');
      setDestAddress('');
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchWalletData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Withdrawal request failed');
      triggerHaptic('error');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-4 px-4 flex flex-col gap-4 pb-24">
      {/* Wallet Balance Overview Card */}
      <div className="bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 rounded-3xl border border-amber-500/30 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              X COIN Master Vault
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold">
            SECURE
          </span>
        </div>

        {/* Dual Balances */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-zinc-900/80 p-3 rounded-2xl border border-white/5 flex flex-col">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">XCOIN Balance</span>
            <div className="flex items-center gap-1.5 mt-1">
              <CoinIcon className="w-5 h-5" />
              <span className="text-xl font-mono font-extrabold text-amber-300">
                {wallet.xcoinBalance.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-1">
              Pending w/d: {wallet.pendingWithdrawalXcoin.toLocaleString()}
            </span>
          </div>

          <div className="bg-zinc-900/80 p-3 rounded-2xl border border-white/5 flex flex-col">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">XC Trading Asset</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xl font-mono font-extrabold text-emerald-400">
                {wallet.xcBalance.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-emerald-300">XC</span>
            </div>
            <span className="text-[10px] text-zinc-500 mt-1">For Arena & X Crash</span>
          </div>
        </div>

        {/* Total Earned Badge */}
        <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-white/5 text-zinc-400">
          <span>Total Platform Earned:</span>
          <span className="text-amber-200 font-bold">{wallet.totalEarnedXcoin.toLocaleString()} XCOIN</span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1.5 bg-zinc-950/80 p-1.5 rounded-2xl border border-white/10">
        <button
          onClick={() => setActiveTab('convert')}
          className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            activeTab === 'convert'
              ? 'bg-amber-500 text-black shadow-md font-extrabold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Convert</span>
        </button>

        <button
          onClick={() => setActiveTab('withdraw')}
          className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            activeTab === 'withdraw'
              ? 'bg-amber-500 text-black shadow-md font-extrabold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <ArrowDownRight className="w-3.5 h-3.5" />
          <span>Withdraw</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            activeTab === 'history'
              ? 'bg-amber-500 text-black shadow-md font-extrabold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Ledger</span>
        </button>
      </div>

      {/* Convert Screen */}
      {activeTab === 'convert' && (
        <form onSubmit={handleConvert} className="bg-zinc-950/80 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase">Instant Exchange</span>
            <span className="text-[10px] text-amber-300 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Rate: 1 XC = 5 XCOIN
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConvDirection('XCOIN_TO_XC')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                convDirection === 'XCOIN_TO_XC'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-zinc-900 border-white/5 text-zinc-400'
              }`}
            >
              XCOIN → XC (Play)
            </button>
            <button
              type="button"
              onClick={() => setConvDirection('XC_TO_XCOIN')}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                convDirection === 'XC_TO_XCOIN'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-zinc-900 border-white/5 text-zinc-400'
              }`}
            >
              XC → XCOIN (Vault)
            </button>
          </div>

          <div>
            <label className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1">
              Amount to Convert
            </label>
            <input
              type="number"
              required
              value={convAmount}
              onChange={(e) => setConvAmount(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono font-bold text-white text-base focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="bg-zinc-900/60 p-2.5 rounded-xl text-xs font-mono flex items-center justify-between text-zinc-300">
            <span>YOU WILL RECEIVE:</span>
            <span className="font-bold text-amber-300 text-sm">
              {convDirection === 'XCOIN_TO_XC'
                ? `${Math.floor(convAmount / 5).toLocaleString()} XC`
                : `${(convAmount * 5).toLocaleString()} XCOIN`}
            </span>
          </div>

          <button
            type="submit"
            disabled={isConverting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-xs shadow-md transition-all active:scale-[0.98]"
          >
            {isConverting ? 'Processing Conversion...' : 'CONFIRM CONVERSION'}
          </button>
        </form>
      )}

      {/* Withdraw Screen */}
      {activeTab === 'withdraw' && (
        <div className="flex flex-col gap-4">
          {/* Withdrawal Eligibility Checklist Card */}
          <div className="bg-zinc-950/90 border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-xl border ${
                  eligibility?.isEligible
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                }`}>
                  {eligibility?.isEligible ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    Withdrawal Tasks & Requirements
                  </h3>
                  <span className="text-[10px] text-zinc-400">
                    Complete all mandatory criteria to unlock payouts
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                  eligibility?.isEligible
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {eligibility?.isEligible
                    ? 'UNLOCKED'
                    : `${eligibility?.totalCompleted || 0}/${eligibility?.totalRequired || 0} COMPLETED`}
                </span>
                <button
                  onClick={fetchTasks}
                  disabled={isLoadingTasks}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white"
                  title="Refresh tasks"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTasks ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* List of Tasks */}
            <div className="flex flex-col gap-2.5">
              {(eligibility?.tasks || []).map((tp) => {
                const isComplete = tp.isCompleted;
                const task = tp.task;

                return (
                  <div
                    key={tp.taskId}
                    className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                      isComplete
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-zinc-200'
                        : 'bg-zinc-900/60 border-white/5 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          isComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-amber-400'
                        }`}>
                          {task.type === 'INVITES' && <Users className="w-3.5 h-3.5" />}
                          {task.type === 'TRADING_VOLUME' && <TrendingUp className="w-3.5 h-3.5" />}
                          {task.type === 'TAP_COUNT' && <Pickaxe className="w-3.5 h-3.5" />}
                          {task.type === 'CUSTOM_LINK' && <ExternalLink className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white">{task.title}</span>
                            {task.isRequiredForWithdrawal && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                REQUIRED
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">
                            {task.description}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        {isComplete ? (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Done</span>
                          </div>
                        ) : (
                          <>
                            {task.actionUrl === 'friends' && onNavigate && (
                              <button
                                onClick={() => onNavigate('friends')}
                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] flex items-center gap-1 transition-all"
                              >
                                <span>Invite</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}

                            {task.actionUrl === 'trade' && onNavigate && (
                              <button
                                onClick={() => onNavigate('trade')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[10px] flex items-center gap-1 transition-all"
                              >
                                <span>Trade</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}

                            {task.actionUrl === 'tap' && onNavigate && (
                              <button
                                onClick={() => onNavigate('tap')}
                                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] flex items-center gap-1 transition-all"
                              >
                                <span>Tap</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}

                            {task.type === 'CUSTOM_LINK' && (
                              <button
                                onClick={() => handleCompleteCustomTask(task.taskId, task.actionUrl)}
                                disabled={completingTaskId === task.taskId}
                                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-[10px] flex items-center gap-1 transition-all"
                              >
                                <span>{completingTaskId === task.taskId ? 'Verifying...' : (task.actionLabel || 'Complete')}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Numeric Tracker */}
                    <div className="flex flex-col gap-1 pt-1">
                      <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                        <span>Progress:</span>
                        <span className={isComplete ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                          {tp.currentValue.toLocaleString()} / {tp.targetValue.toLocaleString()} {task.unitLabel} ({tp.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                          }`}
                          style={{ width: `${tp.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actual Withdrawal Request Form */}
          <form onSubmit={handleWithdraw} className="bg-zinc-950/80 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase">Withdraw XCOIN</span>
              <span className="text-[10px] text-zinc-400 font-mono">Min: 25,000 XCOIN</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">Asset</label>
                <select
                  value={destType}
                  onChange={(e) => setDestType(e.target.value as any)}
                  className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-2 text-xs font-bold text-white"
                >
                  <option value="USDT">USDT</option>
                  <option value="TON">TON</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">Network</label>
                <select
                  value={destNetwork}
                  onChange={(e) => setDestNetwork(e.target.value)}
                  className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-2 text-xs font-bold text-white"
                >
                  {destType === 'USDT' ? (
                    <>
                      <option value="TRC20">TRC20 (Tron)</option>
                      <option value="BEP20">BEP20 (BSC)</option>
                      <option value="TON">TON Network</option>
                    </>
                  ) : (
                    <option value="TON-MAINNET">TON Mainnet</option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1">
                Amount (XCOIN)
              </label>
              <input
                type="number"
                required
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono font-bold text-white text-sm"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1">
                Destination Wallet Address
              </label>
              <input
                type="text"
                required
                value={destAddress}
                onChange={(e) => setDestAddress(e.target.value)}
                placeholder="Enter your USDT or TON receiving address"
                className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-xs text-white"
              />
            </div>

            <div className="bg-zinc-900/60 p-2.5 rounded-xl text-[11px] font-mono flex flex-col gap-1 text-zinc-400">
              <div className="flex justify-between">
                <span>Platform Fee (2%):</span>
                <span>{Math.floor(withdrawAmount * 0.02).toLocaleString()} XCOIN</span>
              </div>
              <div className="flex justify-between">
                <span>Gas Network Fee:</span>
                <span>1,000 XCOIN</span>
              </div>
              <div className="flex justify-between font-bold text-white pt-1 border-t border-white/5">
                <span>Net Payout:</span>
                <span className="text-emerald-400">
                  {Math.max(0, withdrawAmount - Math.floor(withdrawAmount * 0.02) - 1000).toLocaleString()} XCOIN
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                isWithdrawing ||
                !eligibility?.isEligible ||
                wallet.xcoinBalance < withdrawAmount ||
                withdrawAmount < 25000
              }
              className={`w-full py-3 rounded-xl font-extrabold text-xs shadow-md transition-all active:scale-[0.98] ${
                eligibility?.isEligible && wallet.xcoinBalance >= withdrawAmount && withdrawAmount >= 25000
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
              }`}
            >
              {isWithdrawing
                ? 'Submitting Request...'
                : !eligibility?.isEligible
                ? `LOCKED: COMPLETE REQUIRED TASKS ABOVE (${eligibility?.totalCompleted || 0}/${eligibility?.totalRequired || 0})`
                : wallet.xcoinBalance < withdrawAmount
                ? 'INSUFFICIENT XCOIN BALANCE'
                : 'SUBMIT WITHDRAWAL REQUEST'}
            </button>
          </form>
        </div>
      )}

      {/* Ledger History Screen */}
      {activeTab === 'history' && (
        <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
          <h3 className="text-xs font-bold text-zinc-400 uppercase">Authoritative Ledger History</h3>

          {transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">No transactions yet</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {transactions.map((tx) => (
                <div
                  key={tx.transactionId}
                  className="bg-zinc-900/60 border border-white/5 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        tx.direction === 'IN'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {tx.direction === 'IN' ? (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <span className="text-white font-bold block">{tx.type}</span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(tx.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-bold block ${
                        tx.direction === 'IN' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {tx.direction === 'IN' ? '+' : '-'}
                      {tx.amount.toLocaleString()} {tx.asset}
                    </span>
                    <span className="text-[10px] text-zinc-500">{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
