import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useBrokerage, LoginChallenge } from '../context/BrokerageContext';
import { UserAccount } from '../types';
import { ApiError, errMsg } from '../lib/api';

interface OtpStepProps {
  challenge: LoginChallenge;
  onVerified: (user: UserAccount) => void;
  onCancel: () => void;
}

/** Second sign-in step: 6-digit code emailed to the client. */
export const OtpStep: React.FC<OtpStepProps> = ({ challenge, onVerified, onCancel }) => {
  const { verifyLoginOtp, resendLoginOtp } = useBrokerage();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (code: string) => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const user = await verifyLoginOtp(challenge.challengeId, code);
      onVerified(user);
    } catch (e) {
      const msg = errMsg(e);
      setError(msg);
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      if (e instanceof ApiError && /sign in again|expired/i.test(msg)) setTimeout(onCancel, 2500);
    } finally {
      setLoading(false);
    }
  };

  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) {
      // pasted full code
      const next = clean.slice(0, 6).split('');
      while (next.length < 6) next.push('');
      setDigits(next);
      inputs.current[Math.min(clean.length, 5)]?.focus();
      if (clean.length >= 6) submit(clean.slice(0, 6));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) inputs.current[i + 1]?.focus();
    const code = next.join('');
    if (code.length === 6) submit(code);
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      setInfo(await resendLoginOtp(challenge.challengeId));
      setCooldown(60);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  return (
    <div className="space-y-5 text-left">
      <div className="w-14 h-14 rounded-2xl bg-[#6dff8a]/15 text-[#6dff8a] flex items-center justify-center">
        <ShieldCheck className="w-7 h-7" />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-white">Check your email</h3>
        <p className="text-sm text-white/60 mt-1">
          We sent a 6-digit sign-in code to <span className="text-white font-semibold">{challenge.email}</span>.
          It expires in {challenge.expiresInMinutes || 10} minutes.
        </p>
      </div>

      <form onSubmit={e => { e.preventDefault(); submit(digits.join('')); }} className="space-y-4">
        <div className="flex gap-2 justify-between max-w-xs">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              value={d}
              onChange={e => setAt(i, e.target.value)}
              onKeyDown={e => onKey(i, e)}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={6}
              aria-label={`Digit ${i + 1}`}
              className="w-11 h-13 py-3 text-center text-xl font-mono font-bold rounded-xl bg-black/40 border border-white/15 text-white focus:border-[#6dff8a] focus:outline-none"
            />
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}
        {info && !error && <div className="p-3 rounded-xl bg-[#6dff8a]/10 border border-[#6dff8a]/30 text-[#b9ffc6] text-sm">{info}</div>}

        <button
          type="submit"
          disabled={loading || digits.join('').length !== 6}
          className="w-full py-3 rounded-full bg-[#6dff8a] text-[#15170f] font-bold text-sm disabled:opacity-50"
        >
          {loading ? 'Verifying…' : 'Verify and sign in'}
        </button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onCancel} className="flex items-center gap-1 text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="flex items-center gap-1 text-[#6dff8a] hover:underline disabled:text-white/40 disabled:no-underline"
        >
          <RefreshCw className="w-4 h-4" /> {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
      <p className="text-[11px] text-white/40">Can't find it? Check your spam or promotions folder.</p>
    </div>
  );
};
