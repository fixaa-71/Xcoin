import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  UserWallet,
  StoreAsset,
  UserInvestment,
  MarketplaceListing,
  AssetReview,
  StoreAssetCategory,
} from '../types';
import {
  Gem,
  TrendingUp,
  Sparkles,
  ShoppingBag,
  DollarSign,
  Tag,
  Star,
  MessageSquare,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  ArrowUpRight,
  Coins,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { CoinIcon } from './CoinIcon';

interface InvestStoreProps {
  user: UserProfile;
  wallet: UserWallet;
  onUpdateWallet: (newWallet: UserWallet) => void;
  triggerHaptic: (type?: any) => void;
  onNavigate?: (tab: string) => void;
}

export const InvestStore: React.FC<InvestStoreProps> = ({
  user,
  wallet,
  onUpdateWallet,
  triggerHaptic,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'store' | 'portfolio' | 'p2p'>('store');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | StoreAssetCategory>('ALL');

  // Server data
  const [storeAssets, setStoreAssets] = useState<StoreAsset[]>([]);
  const [myInvestments, setMyInvestments] = useState<any[]>([]);
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([]);
  const [totalUnclaimedProfit, setTotalUnclaimedProfit] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals & Action States
  const [selectedAssetForBuy, setSelectedAssetForBuy] = useState<StoreAsset | null>(null);
  const [buyCurrency, setBuyCurrency] = useState<'XC' | 'XCOIN'>('XC');
  const [isBuying, setIsBuying] = useState<boolean>(false);

  const [selectedInvestmentForSell, setSelectedInvestmentForSell] = useState<UserInvestment | null>(null);
  const [askingPriceXC, setAskingPriceXC] = useState<number>(0);
  const [askingPriceXcoin, setAskingPriceXcoin] = useState<number>(0);
  const [isListing, setIsListing] = useState<boolean>(false);

  const [reviewAsset, setReviewAsset] = useState<StoreAsset | null>(null);
  const [reviewsList, setReviewsList] = useState<AssetReview[]>([]);
  const [userRating, setUserRating] = useState<number>(5);
  const [userComment, setUserComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [isClaimingProfit, setIsClaimingProfit] = useState<boolean>(false);

  // Alerts
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/invest/store');
      setStoreAssets(data.storeAssets || []);
      setMyInvestments(data.myInvestments || []);
      setMarketplaceListings(data.marketplaceListings || []);
      setTotalUnclaimedProfit(data.totalUnclaimedProfit || 0);
    } catch (err) {
      console.warn('Failed to load store data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Handle Buy / Invest
  const handleConfirmBuy = async () => {
    if (!selectedAssetForBuy) return;
    setIsBuying(true);
    setAlertError(null);

    try {
      const data = await apiFetch('/api/invest/buy', {
        method: 'POST',
        body: JSON.stringify({
          assetId: selectedAssetForBuy.assetId,
          currency: buyCurrency,
        }),
      });

      triggerHaptic('success');
      setAlertSuccess(data.message || 'Investment successful!');
      if (data.wallet) onUpdateWallet(data.wallet);
      setSelectedAssetForBuy(null);
      setTimeout(() => setAlertSuccess(null), 3500);
      fetchData();
    } catch (err: any) {
      setAlertError(err.message || 'Purchase failed');
      triggerHaptic('error');
    } finally {
      setIsBuying(false);
    }
  };

  // Handle Claim Profits
  const handleClaimProfit = async () => {
    setIsClaimingProfit(true);
    setAlertError(null);

    try {
      const data = await apiFetch('/api/invest/claim-profit', {
        method: 'POST',
      });

      triggerHaptic('success');
      setAlertSuccess(data.message || 'Profits claimed!');
      if (data.wallet) onUpdateWallet(data.wallet);
      setTimeout(() => setAlertSuccess(null), 3500);
      fetchData();
    } catch (err: any) {
      setAlertError(err.message || 'Failed to claim profit');
      triggerHaptic('error');
    } finally {
      setIsClaimingProfit(false);
    }
  };

  // Handle Marketplace Listing
  const handleConfirmListForSale = async () => {
    if (!selectedInvestmentForSell) return;
    setIsListing(true);
    setAlertError(null);

    try {
      const data = await apiFetch('/api/invest/marketplace/list', {
        method: 'POST',
        body: JSON.stringify({
          investmentId: selectedInvestmentForSell.investmentId,
          askingPriceXC,
          askingPriceXcoin,
        }),
      });

      triggerHaptic('success');
      setAlertSuccess(data.message || 'Asset listed for sale!');
      setSelectedInvestmentForSell(null);
      setTimeout(() => setAlertSuccess(null), 3500);
      fetchData();
    } catch (err: any) {
      setAlertError(err.message || 'Failed to list asset');
      triggerHaptic('error');
    } finally {
      setIsListing(false);
    }
  };

  // Handle Marketplace Buy
  const handleBuyMarketplaceListing = async (listing: MarketplaceListing, currency: 'XC' | 'XCOIN') => {
    setAlertError(null);
    try {
      const data = await apiFetch('/api/invest/marketplace/buy', {
        method: 'POST',
        body: JSON.stringify({
          listingId: listing.listingId,
          currency,
        }),
      });

      triggerHaptic('success');
      setAlertSuccess(data.message || 'Asset purchased from user!');
      if (data.wallet) onUpdateWallet(data.wallet);
      setTimeout(() => setAlertSuccess(null), 3500);
      fetchData();
    } catch (err: any) {
      setAlertError(err.message || 'Failed to purchase from marketplace');
      triggerHaptic('error');
    }
  };

  // Handle Cancel Marketplace Listing
  const handleCancelMarketplaceListing = async (listingId: string) => {
    try {
      const data = await apiFetch('/api/invest/marketplace/cancel', {
        method: 'POST',
        body: JSON.stringify({ listingId }),
      });
      triggerHaptic('medium');
      setAlertSuccess(data.message || 'Listing cancelled');
      setTimeout(() => setAlertSuccess(null), 3000);
      fetchData();
    } catch (err: any) {
      setAlertError(err.message || 'Failed to cancel listing');
    }
  };

  // Open Reviews Modal
  const handleOpenReviews = async (asset: StoreAsset) => {
    setReviewAsset(asset);
    setUserRating(5);
    setUserComment('');
    try {
      const data = await apiFetch(`/api/invest/reviews/${asset.assetId}`);
      setReviewsList(data.reviews || []);
    } catch (err) {
      console.warn('Failed to load reviews:', err);
    }
  };

  // Submit Rating & Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewAsset) return;
    setIsSubmittingReview(true);

    try {
      const data = await apiFetch('/api/invest/rate', {
        method: 'POST',
        body: JSON.stringify({
          assetId: reviewAsset.assetId,
          rating: userRating,
          comment: userComment,
        }),
      });

      triggerHaptic('success');
      setReviewsList((prev) => [data.review, ...prev]);
      setUserComment('');
      setAlertSuccess('Review submitted successfully!');
      setTimeout(() => setAlertSuccess(null), 3000);
      fetchData();
    } catch (err: any) {
      setAlertError(err.message || 'Failed to submit rating');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const filteredAssets = categoryFilter === 'ALL'
    ? storeAssets
    : storeAssets.filter((a) => a.category === categoryFilter);

  return (
    <div className="max-w-md mx-auto py-3 px-3 flex flex-col gap-3 pb-24 text-white">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950/40 via-zinc-950 to-black border border-amber-500/30 p-4 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-tr from-amber-500/20 to-yellow-400/30 border border-amber-500/40 rounded-2xl shadow-inner">
              <Gem className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                <span>X INVESTMENT STORE</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full font-mono font-extrabold bg-gradient-to-r from-amber-500 to-yellow-400 text-black">
                  HIGH YIELD
                </span>
              </h2>
              <span className="text-[10px] text-zinc-400 font-mono">
                Invest in Luxury Assets • Collect Daily Passive Dividends
              </span>
            </div>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-1.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Live Unclaimed Yield Widget */}
        <div className="bg-gradient-to-r from-emerald-950/30 via-zinc-900/60 to-zinc-950 p-3 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-semibold block">
                Accumulated Investment Yield
              </span>
              <span className="text-base font-mono font-black text-emerald-400">
                +{totalUnclaimedProfit.toLocaleString()} XCOIN
              </span>
            </div>
          </div>

          <button
            onClick={handleClaimProfit}
            disabled={totalUnclaimedProfit <= 0 || isClaimingProfit}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 shadow-md ${
              totalUnclaimedProfit > 0
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isClaimingProfit ? 'Claiming...' : 'Claim Yield'}</span>
          </button>
        </div>

        {/* Sub-navigation tabs */}
        <div className="grid grid-cols-3 gap-1.5 bg-zinc-900/80 p-1 rounded-2xl border border-white/5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('store')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'store'
                ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Store ({storeAssets.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('portfolio')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'portfolio'
                ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Gem className="w-3.5 h-3.5" />
            <span>Portfolio ({myInvestments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('p2p')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'p2p'
                ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>P2P Market ({marketplaceListings.length})</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {alertError && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 shadow-md">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{alertError}</span>
        </div>
      )}
      {alertSuccess && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{alertSuccess}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: LUXURY STORE */}
      {/* ========================================================= */}
      {activeTab === 'store' && (
        <div className="flex flex-col gap-3">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'ALL', label: 'All Items' },
              { id: 'VEHICLES', label: '🏍️ Superbikes & Cars' },
              { id: 'SOCIAL_GIFTS', label: '⭐ Telegram & TikTok Gifts' },
              { id: 'REAL_ESTATE_MINING', label: '🏙️ Real Estate & Mining' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                  categoryFilter === cat.id
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                    : 'bg-zinc-900/60 text-zinc-400 border-white/5 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Asset Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredAssets.map((asset) => (
              <div
                key={asset.assetId}
                className="group relative bg-zinc-900/70 hover:bg-zinc-900 border border-white/10 hover:border-amber-500/40 rounded-3xl overflow-hidden transition-all duration-300 flex flex-col shadow-xl"
              >
                {/* Image Banner */}
                <div className="relative h-36 w-full overflow-hidden bg-black/60">
                  <img
                    src={asset.imageUrl}
                    alt={asset.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />

                  {/* Daily Profit Badge */}
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-emerald-500/90 text-black text-[10px] font-black font-mono shadow-lg flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>+{asset.dailyProfitPercent}% DAILY</span>
                  </div>

                  {/* Rating Badge */}
                  <button
                    onClick={() => handleOpenReviews(asset)}
                    className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-amber-300 text-[10px] font-bold flex items-center gap-1 hover:border-amber-500/40 transition-colors"
                  >
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{asset.rating.toFixed(1)}</span>
                    <span className="text-zinc-400">({asset.ratingCount})</span>
                  </button>

                  <div className="absolute bottom-2 left-3 right-3 flex items-center gap-1.5">
                    <span className="text-xl">{asset.iconEmoji}</span>
                    <h3 className="text-sm font-black text-white truncate drop-shadow-md">
                      {asset.title}
                    </h3>
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-3.5 flex flex-col gap-2.5 flex-1 justify-between">
                  <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                    {asset.description}
                  </p>

                  <div className="bg-black/50 p-2 rounded-xl border border-white/5 flex items-center justify-between text-xs font-mono">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-zinc-500 uppercase">Dual Price</span>
                      <span className="font-extrabold text-emerald-400">
                        {asset.priceXC.toLocaleString()} XC
                      </span>
                    </div>
                    <div className="text-right flex flex-col">
                      <span className="text-[9px] text-zinc-500 uppercase">Vault Alt</span>
                      <span className="font-extrabold text-amber-300">
                        {asset.priceXcoin.toLocaleString()} XCOIN
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleOpenReviews(asset)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors flex items-center justify-center"
                      title="Read & Write Reviews"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setSelectedAssetForBuy(asset);
                        setBuyCurrency('XC');
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                    >
                      <span>Invest & Own</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: MY PORTFOLIO */}
      {/* ========================================================= */}
      {activeTab === 'portfolio' && (
        <div className="flex flex-col gap-3">
          {myInvestments.length === 0 ? (
            <div className="bg-zinc-950/80 border border-white/10 rounded-3xl p-8 text-center flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <ShoppingBag className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">No Assets Owned Yet</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                  Invest in supercars, bikes, Telegram Stars, or TikTok gifts from the Store to start earning daily dividend yields!
                </p>
              </div>
              <button
                onClick={() => setActiveTab('store')}
                className="mt-2 px-5 py-2 rounded-xl bg-amber-500 text-black font-extrabold text-xs"
              >
                Browse Store Assets
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {myInvestments.map((inv: any) => (
                <div
                  key={inv.investmentId}
                  className="bg-zinc-950/80 border border-white/10 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-black shrink-0 border border-white/10">
                        <img src={inv.imageUrl} alt={inv.assetTitle} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-white text-xs">{inv.assetTitle}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/20 text-emerald-400">
                            +{inv.dailyProfitPercent}%/day
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                          Cost: {inv.investedAmountXC.toLocaleString()} XC ({inv.currency})
                        </span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      inv.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}>
                      {inv.status === 'ACTIVE' ? 'YIELDING' : 'ON MARKET'}
                    </span>
                  </div>

                  <div className="bg-zinc-900/60 p-2 rounded-xl flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-400">Live Unclaimed Yield:</span>
                    <span className="font-black text-emerald-400">
                      +{(inv.unclaimedProfit || 0).toLocaleString()} XCOIN
                    </span>
                  </div>

                  {inv.status === 'ACTIVE' && (
                    <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                      <button
                        onClick={() => {
                          setSelectedInvestmentForSell(inv);
                          setAskingPriceXC(inv.investedAmountXC);
                          setAskingPriceXcoin(inv.investedAmountXcoin);
                        }}
                        className="flex-1 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        <span>List on P2P Marketplace</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: P2P MARKETPLACE */}
      {/* ========================================================= */}
      {activeTab === 'p2p' && (
        <div className="flex flex-col gap-3">
          <div className="bg-zinc-900/60 border border-white/10 p-3 rounded-2xl text-xs text-zinc-400 leading-relaxed">
            <span className="font-bold text-white block mb-0.5">Peer-to-Peer Collector Marketplace</span>
            Buy luxury assets directly from other community traders. When you purchase an asset, you immediately start earning its daily passive profit dividends!
          </div>

          {marketplaceListings.length === 0 ? (
            <div className="py-10 text-center text-xs text-zinc-500 font-mono">
              No active P2P listings right now. Be the first to list an item from your portfolio!
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {marketplaceListings.map((listing) => {
                const isMine = listing.sellerUserId === user.telegramUserId;

                return (
                  <div
                    key={listing.listingId}
                    className="bg-zinc-950/80 border border-white/10 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-black shrink-0 border border-white/10">
                          <img src={listing.imageUrl} alt={listing.assetTitle} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-white text-xs">{listing.assetTitle}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/20 text-emerald-400">
                              +{listing.dailyProfitPercent}%/day
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                            Seller: {isMine ? 'You' : listing.sellerFirstName}
                          </span>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <span className="text-xs font-black text-amber-300 block">
                          {listing.askingPriceXC.toLocaleString()} XC
                        </span>
                        <span className="text-[10px] text-zinc-400 block">
                          or {listing.askingPriceXcoin.toLocaleString()} XCOIN
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                      {isMine ? (
                        <button
                          onClick={() => handleCancelMarketplaceListing(listing.listingId)}
                          className="w-full py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs border border-rose-500/30"
                        >
                          Cancel My Listing
                        </button>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <button
                            onClick={() => handleBuyMarketplaceListing(listing, 'XC')}
                            className="py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors"
                          >
                            Buy with XC
                          </button>
                          <button
                            onClick={() => handleBuyMarketplaceListing(listing, 'XCOIN')}
                            className="py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors"
                          >
                            Buy with XCOIN
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: PURCHASE ASSET CONFIRMATION */}
      {/* ========================================================= */}
      {selectedAssetForBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-sm bg-zinc-950 border border-amber-500/40 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <span>Invest in {selectedAssetForBuy.title}</span>
              </h3>
              <button
                onClick={() => setSelectedAssetForBuy(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-32 rounded-2xl overflow-hidden relative">
              <img src={selectedAssetForBuy.imageUrl} alt={selectedAssetForBuy.title} className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-black font-mono font-black text-[10px]">
                +{selectedAssetForBuy.dailyProfitPercent}% / DAY PROFIT
              </div>
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 uppercase font-semibold block mb-1.5">
                Select Payment Asset
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBuyCurrency('XC')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                    buyCurrency === 'XC'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-zinc-900 border-white/5 text-zinc-400'
                  }`}
                >
                  <span className="block">{selectedAssetForBuy.priceXC.toLocaleString()} XC</span>
                  <span className="text-[9px] text-zinc-500 font-normal">Bal: {wallet.xcBalance.toLocaleString()}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBuyCurrency('XCOIN')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                    buyCurrency === 'XCOIN'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-zinc-900 border-white/5 text-zinc-400'
                  }`}
                >
                  <span className="block">{selectedAssetForBuy.priceXcoin.toLocaleString()} XCOIN</span>
                  <span className="text-[9px] text-zinc-500 font-normal">Bal: {wallet.xcoinBalance.toLocaleString()}</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleConfirmBuy}
              disabled={
                isBuying ||
                (buyCurrency === 'XC' && wallet.xcBalance < selectedAssetForBuy.priceXC) ||
                (buyCurrency === 'XCOIN' && wallet.xcoinBalance < selectedAssetForBuy.priceXcoin)
              }
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs shadow-md transition-all disabled:opacity-50"
            >
              {isBuying
                ? 'Processing Investment...'
                : (buyCurrency === 'XC' && wallet.xcBalance < selectedAssetForBuy.priceXC) ||
                  (buyCurrency === 'XCOIN' && wallet.xcoinBalance < selectedAssetForBuy.priceXcoin)
                ? 'INSUFFICIENT BALANCE'
                : 'CONFIRM INVESTMENT'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: LIST FOR SALE ON MARKETPLACE */}
      {/* ========================================================= */}
      {selectedInvestmentForSell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-sm bg-zinc-950 border border-amber-500/40 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-sm font-extrabold text-white">
                List {selectedInvestmentForSell.assetTitle}
              </h3>
              <button
                onClick={() => setSelectedInvestmentForSell(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">
                  ASKING PRICE (XC)
                </label>
                <input
                  type="number"
                  value={askingPriceXC}
                  onChange={(e) => setAskingPriceXC(parseInt(e.target.value) || 0)}
                  className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">
                  ASKING PRICE (XCOIN)
                </label>
                <input
                  type="number"
                  value={askingPriceXcoin}
                  onChange={(e) => setAskingPriceXcoin(parseInt(e.target.value) || 0)}
                  className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-white text-xs"
                />
              </div>
            </div>

            <button
              onClick={handleConfirmListForSale}
              disabled={isListing || askingPriceXC <= 0 || askingPriceXcoin <= 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-xs transition-all disabled:opacity-50"
            >
              {isListing ? 'Listing Asset...' : 'POST ON P2P MARKETPLACE'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: REVIEWS & RATINGS */}
      {/* ========================================================= */}
      {reviewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-sm bg-zinc-950 border border-white/20 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{reviewAsset.iconEmoji}</span>
                <h3 className="text-sm font-extrabold text-white truncate max-w-[200px]">
                  {reviewAsset.title}
                </h3>
              </div>
              <button
                onClick={() => setReviewAsset(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Write Review Form */}
            <form onSubmit={handleSubmitReview} className="bg-zinc-900/60 p-3 rounded-2xl flex flex-col gap-2.5 border border-white/5">
              <span className="text-xs font-bold text-white">Rate this Asset:</span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setUserRating(star)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        userRating >= star ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={userComment}
                onChange={(e) => setUserComment(e.target.value)}
                placeholder="Share your experience or profit rate review..."
                rows={2}
                className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
              />

              <button
                type="submit"
                disabled={isSubmittingReview}
                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors"
              >
                {isSubmittingReview ? 'Submitting...' : 'Post Rating & Review'}
              </button>
            </form>

            {/* Reviews List */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-zinc-400 uppercase">
                Community Feedback ({reviewsList.length})
              </span>
              {reviewsList.length === 0 ? (
                <div className="py-4 text-center text-xs text-zinc-500">
                  No written reviews yet. Be the first to leave feedback!
                </div>
              ) : (
                reviewsList.map((r) => (
                  <div key={r.reviewId} className="bg-zinc-900/40 p-2.5 rounded-xl border border-white/5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{r.firstName}</span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-zinc-300 text-[11px] mt-1">{r.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
