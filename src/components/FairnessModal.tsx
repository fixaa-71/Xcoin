import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { apiFetch } from '../services/api';

interface FairnessModalProps {
  initialRoundId?: string;
  onClose: () => void;
}

export const FairnessModal: React.FC<FairnessModalProps> = ({ initialRoundId, onClose }) => {
  const [roundId, setRoundId] = useState<string>(initialRoundId || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!roundId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await apiFetch('/api/crash/verify', {
        method: 'POST',
        body: JSON.stringify({ roundId: roundId.trim() }),
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialRoundId) {
      handleVerify();
    }
  }, [initialRoundId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Provably Fair Verification</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          Every round's crash point is generated mathematically using HMAC-SHA256 before the round begins.
          Once settled, you can verify the SHA256 seed hash against the revealed server seed.
        </p>

        {/* Input Form */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
            placeholder="e.g. CRASH-000001"
            className="flex-1 h-10 bg-zinc-900 border border-white/10 rounded-xl px-3 font-mono text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
          <button
            disabled={loading || !roundId.trim()}
            onClick={handleVerify}
            className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Verify</span>}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-zinc-400">STATUS:</span>
              {result.verified ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  ✓ 100% VERIFIED
                </span>
              ) : (
                <span className="text-rose-400 font-bold">⚠ VERIFICATION FAILED</span>
              )}
            </div>

            <div>
              <span className="text-zinc-500 block text-[10px]">CRASH MULTIPLIER:</span>
              <span className="text-amber-300 font-bold text-base">{result.crashPoint}x</span>
            </div>

            <div className="break-all">
              <span className="text-zinc-500 block text-[10px]">REVEALED SERVER SEED:</span>
              <span className="text-zinc-300 text-[11px]">{result.serverSeed}</span>
            </div>

            <div className="break-all">
              <span className="text-zinc-500 block text-[10px]">PUBLISHED SEED HASH (SHA-256):</span>
              <span className="text-zinc-400 text-[11px]">{result.serverSeedHash}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[11px]">
              <div>
                <span className="text-zinc-500 block text-[10px]">NONCE:</span>
                <span className="text-zinc-300">{result.nonce}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[10px]">HASH MATCH:</span>
                <span className={result.validHash ? 'text-emerald-400' : 'text-rose-400'}>
                  {result.validHash ? 'TRUE' : 'FALSE'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
