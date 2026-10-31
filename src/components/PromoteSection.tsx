import React, { useState, useEffect } from 'react';
import { UserProfile, UserWallet, PromotionItem } from '../types';
import { Share2, Plus, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../services/api';
import { CoinIcon } from './CoinIcon';

interface PromoteSectionProps {
  user: UserProfile;
  wallet: UserWallet;
  onUpdateWallet: (newBalance: number) => void;
  triggerHaptic: (type?: any) => void;
}

export const PromoteSection: React.FC<PromoteSectionProps> = ({
  user,
  wallet,
  onUpdateWallet,
  triggerHaptic,
}) => {
  const [promotions, setPromotions] = useState<PromotionItem[]>([]);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [link, setLink] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPromos = async () => {
    try {
      const data = await apiFetch('/api/promotions');
      setPromotions(data.promotions || []);
    } catch (err) {
      console.warn('Promotions fetch warning:', err);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const MIN_PRICE = 20000;

    if (wallet.xcoinBalance < MIN_PRICE) {
      setErrorMessage(`Insufficient balance. You need at least ${MIN_PRICE.toLocaleString()} XCOIN.`);
      triggerHaptic('error');
      return;
    }

    if (!title.trim() || !link.trim()) {
      setErrorMessage('Please provide a campaign title and Telegram channel/bot link.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const data = await apiFetch('/api/promotions/create', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          link: link.trim(),
          description: description.trim(),
          targetMembers: 1000,
        }),
      });

      triggerHaptic('success');
      onUpdateWallet(data.authoritativeBalance);
      setPromotions((prev) => [data.promotion, ...prev]);
      setSuccessMessage('Promotion campaign launched successfully!');
      setShowCreateModal(false);
      setTitle('');
      setLink('');
      setDescription('');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create promotion');
      triggerHaptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-4 px-4 flex flex-col gap-4 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-zinc-900 to-black p-4 rounded-2xl border border-amber-500/20 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-amber-400" />
            <span>Promotion Hub</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Feature your Telegram channel or group to all X COIN users.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-xs flex items-center gap-1 shadow-md hover:scale-105 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Launch Ad</span>
        </button>
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

      {/* Promotions List */}
      <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-3 flex flex-col gap-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase">Live Community Campaigns</h3>

        {promotions.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <Share2 className="w-8 h-8 text-zinc-600 mb-2 opacity-40" />
            <span className="text-sm font-semibold text-zinc-400">No active promotions</span>
            <span className="text-xs text-zinc-600 mt-1">
              Be the first sponsor to promote your channel to thousands of active traders!
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {promotions.map((promo) => (
              <div
                key={promo.promotionId}
                className="bg-zinc-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between gap-3 hover:border-amber-500/20 transition-all"
              >
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">{promo.title}</h4>
                  <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{promo.description}</p>
                  <span className="text-[10px] text-amber-400/80 font-mono mt-1 block">
                    Duration: {promo.durationDays} days • Verified Sponsor
                  </span>
                </div>

                <a
                  href={promo.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Promotion Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
            <h3 className="text-base font-bold text-white">Create Promotion Campaign</h3>
            <p className="text-xs text-zinc-400">
              Listing price: <span className="text-amber-300 font-bold font-mono">20,000 XCOIN</span> for 7 days active promotion.
            </p>

            <form onSubmit={handleCreatePromo} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Campaign Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Official Crypto Signals Channel"
                  className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Telegram Link (t.me/...)</label>
                <input
                  type="url"
                  required
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://t.me/your_channel"
                  className="w-full h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short tagline describing your group..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 text-xs font-semibold hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || wallet.xcoinBalance < 20000}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Launching...' : 'Pay 20,000 XCOIN & Launch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
