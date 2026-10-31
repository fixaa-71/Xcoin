import React from 'react';
import { ShieldAlert, AlertTriangle, X } from 'lucide-react';

interface SecurityRestrictionModalProps {
  onClose: () => void;
}

export const SecurityRestrictionModal: React.FC<SecurityRestrictionModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-zinc-950 border border-rose-500/40 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-center items-center">
        <div className="p-3.5 bg-rose-500/10 rounded-2xl border border-rose-500/30">
          <ShieldAlert className="w-10 h-10 text-rose-400" />
        </div>

        <div>
          <h3 className="text-base font-extrabold text-white">SECURITY RESTRICTION</h3>
          <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest mt-0.5 block">
            Multi-Device Protection Active
          </span>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          This X COIN account is already linked to another trusted device. For your protection, financial operations have been temporarily restricted.
        </p>

        <div className="bg-zinc-900/80 border border-white/5 p-3 rounded-2xl text-[11px] text-zinc-400 text-left w-full flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>Only one trusted device per Telegram account is permitted for secure mining, trading, and withdrawals.</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs border border-white/10 transition-all"
        >
          Acknowledge & Continue
        </button>
      </div>
    </div>
  );
};
