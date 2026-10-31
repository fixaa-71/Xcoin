import React, { useState, useEffect } from 'react';
import { UserProfile, VipPlan, PaymentOrder } from '../types';
import { Crown, Check, ShieldCheck, QrCode, Copy, AlertCircle, CheckCircle2, History, Clock } from 'lucide-react';
import { apiFetch } from '../services/api';

interface VipSectionProps {
  user: UserProfile;
  triggerHaptic: (type?: any) => void;
  onRefreshUser: () => void;
}

export const VipSection: React.FC<VipSectionProps> = ({ user, triggerHaptic, onRefreshUser }) => {
  const [plans, setPlans] = useState<VipPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<VipPlan | null>(null);
  const [currentOrder, setCurrentOrder] = useState<PaymentOrder | null>(null);
  const [userOrders, setUserOrders] = useState<PaymentOrder[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<'USDT' | 'TON'>('USDT');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('TRC20');
  const [txidInput, setTxidInput] = useState<string>('');
  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(false);
  const [isSubmittingTxid, setIsSubmittingTxid] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'orders'>('plans');

  const fetchVipPlans = async () => {
    try {
      const data = await apiFetch('/api/vip/plans');
      setPlans(data.plans || []);
    } catch (err) {
      console.warn('VIP plans fetch warning:', err);
    }
  };

  const fetchMyOrders = async () => {
    try {
      const data = await apiFetch('/api/vip/my-orders');
      setUserOrders(data.orders || []);
    } catch (err) {
      console.warn('VIP orders fetch warning:', err);
    }
  };

  useEffect(() => {
    fetchVipPlans();
    fetchMyOrders();
  }, []);

  const handleSelectPlan = async (plan: VipPlan) => {
    setSelectedPlan(plan);
    setIsCreatingOrder(true);
    setErrorMessage(null);

    try {
      const data = await apiFetch('/api/vip/payment-order', {
        method: 'POST',
        body: JSON.stringify({
          planId: plan.planId,
          asset: selectedAsset,
          network: selectedNetwork,
        }),
      });

      setCurrentOrder(data.order);
      triggerHaptic('medium');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create payment order');
      triggerHaptic('error');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleSubmitTxid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrder || !txidInput.trim()) return;

    setIsSubmittingTxid(true);
    setErrorMessage(null);

    try {
      const data = await apiFetch('/api/vip/submit-txid', {
        method: 'POST',
        body: JSON.stringify({
          orderId: currentOrder.orderId,
          txid: txidInput.trim(),
        }),
      });

      triggerHaptic('success');
      setSuccessMessage('Payment submitted for Admin review. Your VIP will activate once verified.');
      setCurrentOrder(data.order);
      setTxidInput('');
      fetchMyOrders();
      onRefreshUser();
    } catch (err: any) {
      setErrorMessage(err.message || 'TXID submission failed');
      triggerHaptic('error');
    } finally {
      setIsSubmittingTxid(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    triggerHaptic('light');
    setTimeout(() => setCopied(false), 2000);
  };

  // QR Code URL via public SVG QR generator API for crisp display
  const qrUrl = currentOrder
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
        currentOrder.paymentAddress
      )}`
    : '';

  return (
    <div className="max-w-md mx-auto py-4 px-4 flex flex-col gap-4 pb-24">
      {/* Top Banner & Active Status */}
      <div className="bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 rounded-3xl border border-amber-500/30 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/30">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">VIP Elite Club</h2>
              <span className="text-xs text-zinc-400">Unlock AI Market Predictions & Advanced Signals</span>
            </div>
          </div>

          <span
            className={`text-xs px-2.5 py-1 rounded-full font-bold font-mono uppercase ${
              user.vipStatus === 'ACTIVE'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(212,175,55,0.2)]'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {user.vipTier || 'FREE'}
          </span>
        </div>

        {/* Remaining Days Countdown */}
        {user.vipStatus === 'ACTIVE' && user.vipExpiresAt && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono">
            <span className="text-amber-300 flex items-center gap-1.5 font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>ACTIVE MEMBERSHIP</span>
            </span>
            <span className="text-white font-extrabold">
              {Math.max(1, Math.ceil((user.vipExpiresAt - Date.now()) / (1000 * 60 * 60 * 24)))} Days Remaining
            </span>
          </div>
        )}
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
      <div className="grid grid-cols-2 gap-1.5 bg-zinc-950/80 p-1.5 rounded-2xl border border-white/10">
        <button
          onClick={() => {
            setActiveTab('plans');
            setCurrentOrder(null);
          }}
          className={`py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'plans'
              ? 'bg-amber-500 text-black font-extrabold shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          VIP Plans
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'orders'
              ? 'bg-amber-500 text-black font-extrabold shadow-md'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>My Orders</span>
        </button>
      </div>

      {/* Checkout Screen with Destination Address, QR, and TXID Input */}
      {currentOrder && activeTab === 'plans' ? (
        <div className="bg-zinc-950/90 border border-amber-500/40 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-white">Complete VIP Payment</h3>
              <span className="text-xs text-amber-300 font-mono">
                Order: {currentOrder.orderId}
              </span>
            </div>
            <button
              onClick={() => setCurrentOrder(null)}
              className="text-xs text-zinc-400 hover:text-white underline"
            >
              Change Plan
            </button>
          </div>

          <div className="flex flex-col items-center gap-3">
            {/* Amount to Pay */}
            <div className="text-center">
              <span className="text-xs text-zinc-400 uppercase font-semibold">AMOUNT TO SEND:</span>
              <div className="text-3xl font-mono font-extrabold text-amber-300">
                {currentOrder.expectedAmount} {currentOrder.asset}
              </div>
              <span className="text-xs font-mono text-zinc-500">
                Network: {currentOrder.network}
              </span>
            </div>

            {/* QR Code */}
            <div className="p-2.5 bg-white rounded-2xl shadow-xl">
              <img src={qrUrl} alt="Payment QR" className="w-36 h-36 object-contain" />
            </div>

            {/* Wallet Address Box */}
            <div className="w-full">
              <span className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">
                Deposit Wallet Address ({currentOrder.network}):
              </span>
              <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-xl p-2.5">
                <span className="flex-1 font-mono text-xs text-white truncate">
                  {currentOrder.paymentAddress}
                </span>
                <button
                  onClick={() => handleCopy(currentOrder.paymentAddress)}
                  className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* TXID Input Form */}
          <form onSubmit={handleSubmitTxid} className="flex flex-col gap-3 pt-2 border-t border-white/5">
            <div>
              <label className="text-xs font-bold text-white block mb-1">
                Transaction Hash / TXID
              </label>
              <input
                type="text"
                required
                value={txidInput}
                onChange={(e) => setTxidInput(e.target.value)}
                placeholder="Paste the blockchain transaction hash here"
                className="w-full h-11 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <p className="text-[11px] text-zinc-400">
              After transferring {currentOrder.expectedAmount} {currentOrder.asset} externally, submit the TXID above. Admin verifies the hash on the blockchain explorer before VIP activates.
            </p>

            <button
              type="submit"
              disabled={isSubmittingTxid || !txidInput.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-xs shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmittingTxid ? 'Verifying & Submitting...' : 'SUBMIT PAYMENT FOR REVIEW'}
            </button>
          </form>
        </div>
      ) : activeTab === 'plans' ? (
        /* VIP Plans List */
        <div className="flex flex-col gap-3">
          {plans.map((plan) => (
            <div
              key={plan.planId}
              className={`bg-zinc-950/80 backdrop-blur-md p-4 rounded-3xl border transition-all flex flex-col gap-3 ${
                user.vipTier === plan.name
                  ? 'border-amber-500/60 shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                  : 'border-white/10 hover:border-amber-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <span>{plan.name}</span>
                    {user.vipTier === plan.name && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                        CURRENT
                      </span>
                    )}
                  </h3>
                  <span className="text-xs text-zinc-400 font-mono">
                    Duration: {plan.durationDays} Days
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-mono font-black text-amber-300">
                    ${plan.priceUSD}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">USD</span>
                </div>
              </div>

              {/* Benefits */}
              <div className="flex flex-col gap-1.5 py-1">
                {plan.benefits.map((benefit, bIdx) => (
                  <div key={bIdx} className="flex items-center gap-2 text-xs text-zinc-300">
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>

              <button
                disabled={isCreatingOrder}
                onClick={() => handleSelectPlan(plan)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold text-xs shadow-md transition-all active:scale-[0.98]"
              >
                SELECT {plan.name.toUpperCase()} (${plan.priceUSD})
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Orders History */
        <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-zinc-400 uppercase">My VIP Orders</h3>
          {userOrders.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">No payment orders yet</div>
          ) : (
            <div className="flex flex-col gap-2">
              {userOrders.map((order) => (
                <div
                  key={order.orderId}
                  className="bg-zinc-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <span className="text-white font-bold block">{order.planName} (${order.priceUSD})</span>
                    <span className="text-[10px] text-zinc-500">{order.orderId}</span>
                    {order.txid && (
                      <span className="text-[10px] text-zinc-400 block truncate max-w-[150px]">
                        TXID: {order.txid}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        order.status === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : order.status === 'UNDER_REVIEW'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {order.status}
                    </span>
                    <span className="text-[10px] text-zinc-500 block mt-1">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
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
