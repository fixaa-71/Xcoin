import React, { useState } from 'react';
import { UserProfile, UserWallet } from '../types';
import { Flame, BatteryCharging, Zap, Check, AlertCircle } from 'lucide-react';
import { getUpgradeInfo } from '../lib/tap-logic';
import { apiFetch } from '../services/api';

interface UpgradesSectionProps {
  user: UserProfile;
  wallet: UserWallet;
  onUpdateUser: (user: UserProfile, wallet: UserWallet) => void;
  triggerHaptic: (type?: any) => void;
}

export const UpgradesSection: React.FC<UpgradesSectionProps> = ({
  user,
  wallet,
  onUpdateUser,
  triggerHaptic,
}) => {
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Derive current levels
  const tapPowerLevel = Math.max(1, Math.floor(user.tapPower / 5));
  const rechargeLevel = Math.max(1, Math.floor((user.rechargePower - 1) / 2));
  const capacityLevel = Math.max(1, Math.floor((user.energyCapacity - 1000) / 500) + 1);

  const tapInfo = getUpgradeInfo('tapPower', tapPowerLevel);
  const rechargeInfo = getUpgradeInfo('rechargePower', rechargeLevel);
  const capacityInfo = getUpgradeInfo('energyCapacity', capacityLevel);

  const handleUpgrade = async (type: 'tapPower' | 'rechargePower' | 'energyCapacity', cost: number) => {
    if (wallet.xcoinBalance < cost) {
      setErrorMsg('Insufficient XCOIN balance for this upgrade');
      triggerHaptic('error');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    setLoadingType(type);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const data = await apiFetch('/api/upgrade', {
        method: 'POST',
        body: JSON.stringify({ upgradeType: type }),
      });

      triggerHaptic('success');
      setSuccessMsg(`Successfully upgraded ${type} to Level ${data.newLevel}!`);
      setTimeout(() => setSuccessMsg(null), 3000);

      onUpdateUser(data.user, {
        ...wallet,
        xcoinBalance: data.authoritativeBalance,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Upgrade failed');
      triggerHaptic('error');
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setLoadingType(null);
    }
  };

  const upgrades = [
    {
      type: 'tapPower' as const,
      name: 'Tap Power',
      description: 'Increases XCOIN mined per physical tap',
      icon: <Flame className="w-5 h-5 text-amber-400" />,
      level: tapPowerLevel,
      info: tapInfo,
      currentText: `+${tapInfo.currentVal} XCOIN`,
      nextText: `+${tapInfo.nextVal} XCOIN`,
    },
    {
      type: 'rechargePower' as const,
      name: 'Recharge Power',
      description: 'Accelerates passive energy recovery rate',
      icon: <BatteryCharging className="w-5 h-5 text-emerald-400" />,
      level: rechargeLevel,
      info: rechargeInfo,
      currentText: `+${rechargeInfo.currentVal} /s`,
      nextText: `+${rechargeInfo.nextVal} /s`,
    },
    {
      type: 'energyCapacity' as const,
      name: 'Energy Capacity',
      description: 'Expands your maximum energy storage pool',
      icon: <Zap className="w-5 h-5 text-cyan-400" />,
      level: capacityLevel,
      info: capacityInfo,
      currentText: `${capacityInfo.currentVal} max`,
      nextText: `${capacityInfo.nextVal} max`,
    },
  ];

  return (
    <div className="max-w-md mx-auto py-5 px-4 flex flex-col gap-4 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-zinc-900 to-black p-4 rounded-2xl border border-amber-500/20 shadow-lg">
        <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <span>Mining Upgrades</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Boost your tap efficiency, speed up energy replenishment, and expand capacity.
        </p>

        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Upgrades List */}
      <div className="flex flex-col gap-3">
        {upgrades.map((item) => {
          const isMax = item.level >= item.info.maxLevel;
          const canAfford = wallet.xcoinBalance >= item.info.cost;
          const isLoading = loadingType === item.type;

          return (
            <div
              key={item.type}
              className="bg-zinc-950/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 hover:border-amber-500/30 transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-zinc-900 border border-white/10">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{item.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-amber-300 font-mono font-semibold">
                        Lvl {item.level}
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{item.description}</p>
                  </div>
                </div>
              </div>

              {/* Progress & Values */}
              <div className="grid grid-cols-2 gap-2 bg-zinc-900/60 p-2.5 rounded-xl text-xs font-mono">
                <div>
                  <span className="text-zinc-500 block text-[10px]">CURRENT</span>
                  <span className="text-zinc-200 font-bold">{item.currentText}</span>
                </div>
                <div>
                  <span className="text-amber-500/80 block text-[10px]">NEXT LEVEL</span>
                  <span className="text-amber-300 font-bold">
                    {isMax ? 'MAX REACHED' : item.nextText}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                disabled={isMax || !canAfford || isLoading}
                onClick={() => handleUpgrade(item.type, item.info.cost)}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  isMax
                    ? 'bg-zinc-900 text-zinc-500 cursor-not-allowed border border-white/5'
                    : canAfford
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold shadow-[0_4px_16px_rgba(212,175,55,0.25)] active:scale-[0.98]'
                    : 'bg-zinc-900/80 text-zinc-500 border border-white/5 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <span>Processing...</span>
                ) : isMax ? (
                  <span>Max Level Achieved</span>
                ) : (
                  <>
                    <span>Upgrade for</span>
                    <span className="font-mono text-sm">{item.info.cost.toLocaleString()}</span>
                    <span>XCOIN</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
