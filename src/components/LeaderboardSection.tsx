import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Users, Flame } from 'lucide-react';
import { apiFetch } from '../services/api';
import { CoinIcon } from './CoinIcon';

type LeaderboardTab = 'traders' | 'referrers' | 'earners';

export const LeaderboardSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('traders');
  const [data, setData] = useState<{
    topTraders: any[];
    topReferrers: any[];
    topEarners: any[];
  }>({
    topTraders: [],
    topReferrers: [],
    topEarners: [],
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await apiFetch('/api/leaderboard');
        setData({
          topTraders: res.topTraders || [],
          topReferrers: res.topReferrers || [],
          topEarners: res.topEarners || [],
        });
      } catch (err) {
        console.warn('Leaderboard fetch warning:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const getActiveList = () => {
    if (activeTab === 'traders') return data.topTraders;
    if (activeTab === 'referrers') return data.topReferrers;
    return data.topEarners;
  };

  const list = getActiveList();

  return (
    <div className="max-w-md mx-auto py-4 px-4 flex flex-col gap-4 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-zinc-900 to-black p-4 rounded-2xl border border-amber-500/20 shadow-lg text-center flex flex-col items-center">
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl mb-2">
          <Trophy className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-extrabold text-white">Top Hall of Fame</h2>
        <p className="text-xs text-zinc-400 mt-1">
          Real-time global rankings based exclusively on real verified on-chain and database activity.
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1.5 bg-zinc-950/80 p-1.5 rounded-2xl border border-white/10">
        <button
          onClick={() => setActiveTab('traders')}
          className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            activeTab === 'traders'
              ? 'bg-amber-500 text-black shadow-md font-extrabold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Traders</span>
        </button>

        <button
          onClick={() => setActiveTab('referrers')}
          className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            activeTab === 'referrers'
              ? 'bg-amber-500 text-black shadow-md font-extrabold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Referrers</span>
        </button>

        <button
          onClick={() => setActiveTab('earners')}
          className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            activeTab === 'earners'
              ? 'bg-amber-500 text-black shadow-md font-extrabold'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Earners</span>
        </button>
      </div>

      {/* Leaderboard Entries */}
      <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-3 flex flex-col gap-2">
        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-500 font-mono">Loading rankings...</div>
        ) : list.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <Trophy className="w-8 h-8 text-zinc-600 mb-2 opacity-40" />
            <span className="text-sm font-semibold text-zinc-400">No users yet</span>
            <span className="text-xs text-zinc-600 mt-1">
              Be the first user to rank in this category!
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((item, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;

              return (
                <div
                  key={item.telegramUserId || idx}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                    rank === 1
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(212,175,55,0.15)]'
                      : rank === 2
                      ? 'bg-zinc-800/60 border-zinc-500/30 text-zinc-200'
                      : rank === 3
                      ? 'bg-amber-900/20 border-amber-700/30 text-amber-400'
                      : 'bg-zinc-900/50 border-white/5 text-zinc-400'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-6 text-center font-mono font-black text-sm ${
                        isTop3 ? 'text-amber-300' : 'text-zinc-500'
                      }`}
                    >
                      #{rank}
                    </span>

                    {item.photoUrl ? (
                      <img
                        src={item.photoUrl}
                        alt={item.firstName}
                        className="w-8 h-8 rounded-full object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-bold text-white">
                        {item.firstName?.slice(0, 2).toUpperCase() || 'U'}
                      </div>
                    )}

                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate max-w-[120px]">
                        {item.firstName}
                      </span>
                      {item.username && (
                        <span className="text-[10px] text-zinc-500 truncate">
                          @{item.username}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category Details */}
                  <div className="text-right font-mono">
                    {activeTab === 'traders' && (
                      <div>
                        <span className="text-xs font-bold text-emerald-400 block">
                          {item.tradingVolume.toLocaleString()} XC
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {item.totalTrades} trades • {item.winRate}% win
                        </span>
                      </div>
                    )}

                    {activeTab === 'referrers' && (
                      <div>
                        <span className="text-xs font-bold text-amber-300 block">
                          {item.successfulReferrals} Invites
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          +{item.referralRewards.toLocaleString()} XCOIN
                        </span>
                      </div>
                    )}

                    {activeTab === 'earners' && (
                      <div>
                        <span className="text-xs font-bold text-amber-300 block">
                          {item.totalEarned.toLocaleString()} XCOIN
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Tier: {item.vipTier || 'FREE'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
