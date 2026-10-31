import React, { useState, useEffect, useCallback } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { getDeviceId, apiFetch } from './services/api';
import { UserProfile, UserWallet } from './types';
import { Navbar } from './components/Navbar';
import { BottomNav, TabKey } from './components/BottomNav';
import { TapSection } from './components/TapSection';
import { UpgradesSection } from './components/UpgradesSection';
import { CrashGame } from './components/CrashGame';
import { TradingArena } from './components/TradingArena';
import { BonusSection } from './components/BonusSection';
import { PromoteSection } from './components/PromoteSection';
import { FriendsSection } from './components/FriendsSection';
import { LeaderboardSection } from './components/LeaderboardSection';
import { WalletSection } from './components/WalletSection';
import { InvestStore } from './components/InvestStore';
import { VipSection } from './components/VipSection';
import { AdminDashboard } from './components/AdminDashboard';
import { FairnessModal } from './components/FairnessModal';
import { SecurityRestrictionModal } from './components/SecurityRestrictionModal';
import { CoinIcon } from './components/CoinIcon';

export default function App() {
  const { isReady, initData, triggerHaptic } = useTelegram();
  const [activeTab, setActiveTab] = useState<TabKey>('tap');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<UserWallet | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showAdmin, setShowAdmin] = useState<boolean>(false);
  const [fairnessRoundId, setFairnessRoundId] = useState<string | null>(null);
  const [showDeviceRestriction, setShowDeviceRestriction] = useState<boolean>(false);
  const [systemAnnouncement, setSystemAnnouncement] = useState<string>('');

  // Authenticate user with server-authoritative Telegram validation
  const authenticate = useCallback(async () => {
    if (!initData) return;
    setIsLoading(true);
    setError(null);

    try {
      const deviceId = getDeviceId();
      const data = await apiFetch('/api/telegram/validate', {
        method: 'POST',
        body: JSON.stringify({
          initData,
          deviceId,
        }),
      });

      if (data.user) {
        setUser(data.user);
        localStorage.setItem('xcoin_auth_user_id', data.user.telegramUserId);
      }
      if (data.wallet) {
        setWallet(data.wallet);
      }
      if (data.systemAnnouncement) {
        setSystemAnnouncement(data.systemAnnouncement);
      }
      if (data.isDeviceMismatch) {
        setShowDeviceRestriction(true);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setError(err.message || 'Failed to authenticate Telegram session');
    } finally {
      setIsLoading(false);
    }
  }, [initData]);

  useEffect(() => {
    if (isReady && initData) {
      authenticate();
    }
  }, [isReady, initData, authenticate]);

  // Wallet update callbacks
  const handleUpdateWalletXcoin = (newBalance: number) => {
    setWallet((prev) => (prev ? { ...prev, xcoinBalance: newBalance } : null));
  };

  const handleUpdateWalletXC = (newBalanceXC: number) => {
    setWallet((prev) => (prev ? { ...prev, xcBalance: newBalanceXC } : null));
  };

  const handleUpdateUserAndWallet = (updatedUser: UserProfile, updatedWallet: UserWallet) => {
    setUser(updatedUser);
    setWallet(updatedWallet);
  };

  // Loading skeleton screen
  if (isLoading || !user || !wallet) {
    return (
      <div className="min-h-screen bg-[#06080c] text-white flex flex-col items-center justify-center p-6">
        <div className="relative flex flex-col items-center gap-4">
          <div className="relative">
            <CoinIcon className="w-20 h-20 animate-pulse shadow-[0_0_30px_rgba(212,175,55,0.4)]" />
            <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl animate-ping" />
          </div>

          <div className="flex flex-col items-center text-center">
            <h1 className="text-2xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-400">
              X COIN
            </h1>
            <span className="text-xs text-zinc-400 font-mono mt-1">
              Connecting to secure fintech network...
            </span>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs max-w-xs text-center">
              <span>{error}</span>
              <button
                onClick={authenticate}
                className="mt-2 block mx-auto px-4 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 font-bold text-xs"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080c] text-white flex flex-col selection:bg-amber-500 selection:text-black">
      {/* Top Navbar */}
      <Navbar
        user={user}
        wallet={wallet}
        onOpenAdmin={() => setShowAdmin(true)}
        onOpenVip={() => setActiveTab('vip')}
        onOpenNotifications={() => setActiveTab('bonus')}
      />

      {/* Real-time System Broadcast Announcement Banner */}
      {systemAnnouncement && (
        <div className="w-full bg-gradient-to-r from-amber-500/20 via-yellow-400/25 to-amber-500/20 border-b border-amber-500/40 px-3 py-1.5 text-center text-xs font-mono font-bold text-amber-200 flex items-center justify-center gap-1.5 shadow-md">
          <span>📢</span>
          <span>{systemAnnouncement}</span>
        </div>
      )}

      {/* Main Active Tab Screen */}
      <main className="flex-1 w-full max-w-md mx-auto">
        {activeTab === 'tap' && (
          <TapSection
            user={user}
            wallet={wallet}
            onUpdateWallet={handleUpdateWalletXcoin}
            triggerHaptic={triggerHaptic}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'upgrades' && (
          <UpgradesSection
            user={user}
            wallet={wallet}
            onUpdateUser={handleUpdateUserAndWallet}
            triggerHaptic={triggerHaptic}
          />
        )}

        {activeTab === 'crash' && (
          <CrashGame
            user={user}
            wallet={wallet}
            onUpdateWalletXC={handleUpdateWalletXC}
            triggerHaptic={triggerHaptic}
            onOpenFairness={(id) => setFairnessRoundId(id || 'CRASH-000001')}
          />
        )}

        {activeTab === 'trade' && (
          <TradingArena
            user={user}
            wallet={wallet}
            onUpdateWalletXC={handleUpdateWalletXC}
            triggerHaptic={triggerHaptic}
            onOpenVip={() => setActiveTab('vip')}
          />
        )}

        {activeTab === 'invest' && (
          <InvestStore
            user={user}
            wallet={wallet}
            onUpdateWallet={(w) => setWallet(w)}
            triggerHaptic={triggerHaptic}
            onNavigate={(tab) => setActiveTab(tab as any)}
          />
        )}

        {activeTab === 'bonus' && (
          <BonusSection
            user={user}
            wallet={wallet}
            onUpdateWallet={handleUpdateWalletXcoin}
            triggerHaptic={triggerHaptic}
          />
        )}

        {activeTab === 'friends' && (
          <FriendsSection
            user={user}
            wallet={wallet}
            triggerHaptic={triggerHaptic}
          />
        )}

        {activeTab === 'top' && <LeaderboardSection />}

        {activeTab === 'promote' && (
          <PromoteSection
            user={user}
            wallet={wallet}
            onUpdateWallet={handleUpdateWalletXcoin}
            triggerHaptic={triggerHaptic}
          />
        )}

        {activeTab === 'wallet' && (
          <WalletSection
            user={user}
            wallet={wallet}
            onUpdateWallet={(w) => setWallet(w)}
            triggerHaptic={triggerHaptic}
            onNavigate={(tab) => setActiveTab(tab as any)}
          />
        )}

        {activeTab === 'vip' && (
          <VipSection
            user={user}
            triggerHaptic={triggerHaptic}
            onRefreshUser={authenticate}
          />
        )}
      </main>

      {/* Bottom Sticky Navigation */}
      <BottomNav activeTab={activeTab} onChangeTab={(tab) => setActiveTab(tab)} />

      {/* Admin Dashboard Modal */}
      {showAdmin && (
        <AdminDashboard
          onClose={() => setShowAdmin(false)}
          triggerHaptic={triggerHaptic}
          onRefreshUserData={authenticate}
        />
      )}

      {/* Fairness Modal */}
      {fairnessRoundId && (
        <FairnessModal
          initialRoundId={fairnessRoundId}
          onClose={() => setFairnessRoundId(null)}
        />
      )}

      {/* Device Restriction Alert */}
      {showDeviceRestriction && (
        <SecurityRestrictionModal onClose={() => setShowDeviceRestriction(false)} />
      )}
    </div>
  );
}
