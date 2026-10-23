import React, { useEffect, useRef, useState } from 'react';
import {
  X, CheckCircle2, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle,
  Eye, EyeOff, RefreshCw, BadgeCheck, ClipboardList, Fingerprint,
} from 'lucide-react';
import { TradeSharkLogo } from './TradeSharkLogo';
import { useBrokerage, isLoginChallenge, LoginChallenge } from '../context/BrokerageContext';
import { OtpStep } from './OtpStep';
import { errMsg } from '../lib/api';
import { navigate } from '../lib/router';

interface AuthModalProps {
  isOpen: boolean;
  mode: 'login' | 'signup';
  onClose: () => void;
  onSuccess: (user: { name: string; email: string }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = (props) => (props.isOpen ? <AuthModalInner {...props} /> : null);

type Step = 'form' | 'loginOtp' | 'emailVerify' | 'kycPrompt';

interface SignupChallenge {
  challengeId: string;
  email: string;
  expiresInMinutes: number;
}

const AuthModalInner: React.FC<AuthModalProps> = ({
  mode: initialMode,
  onClose,
  onSuccess,
}) => {
  const { loginUser, registerUser, config, sendSignupVerifyCode, verifySignupCode } = useBrokerage();

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // login OTP
  const [loginOtp, setLoginOtp] = useState<LoginChallenge | null>(null);
  // signup email verify OTP
  const [signupChallenge, setSignupChallenge] = useState<SignupChallenge | null>(null);
  const [verifyDigits, setVerifyDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyCooldown, setVerifyCooldown] = useState(60);
  const [verifyInfo, setVerifyInfo] = useState<string | null>(null);
  const verifyInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [verifiedUserName, setVerifiedUserName] = useState('');

  useEffect(() => {
    if (step !== 'emailVerify' || verifyCooldown <= 0) return;
    const t = setTimeout(() => setVerifyCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [step, verifyCooldown]);

  useEffect(() => {
    if (step === 'emailVerify') setTimeout(() => verifyInputs.current[0]?.focus(), 100);
  }, [step]);

  const finishLogin = (user: { name: string; email: string }) => {
    setLoginOtp(null);
    onSuccess(user);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      if (mode === 'login') {
        const r = await loginUser(email.trim(), password, rememberMe);
        if (isLoginChallenge(r)) { setLoginOtp(r); setStep('loginOtp'); return; }
        finishLogin(r);
      } else {
        const user = await registerUser({ name: fullName.trim(), email: email.trim(), password });
        setVerifiedUserName(user.name);
        const ch = await sendSignupVerifyCode();
        setSignupChallenge(ch);
        setVerifyCooldown(60);
        setStep('emailVerify');
      }
    } catch (err) {
      setErrorMessage(errMsg(err));
    } finally {
      setIsLoading(false);
    }
  };

  const setVerifyAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = clean.slice(0, 6).split('');
      while (next.length < 6) next.push('');
      setVerifyDigits(next);
      verifyInputs.current[Math.min(clean.length, 5)]?.focus();
      if (clean.length >= 6) submitVerifyCode(clean.slice(0, 6));
      return;
    }
    const next = [...verifyDigits];
    next[i] = clean;
    setVerifyDigits(next);
    if (clean && i < 5) verifyInputs.current[i + 1]?.focus();
    const code = next.join('');
    if (code.length === 6) submitVerifyCode(code);
  };

  const onVerifyKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verifyDigits[i] && i > 0) verifyInputs.current[i - 1]?.focus();
  };

  const submitVerifyCode = async (code: string) => {
    if (!signupChallenge || verifyLoading) return;
    setVerifyLoading(true);
    setVerifyError(null);
    try {
      await verifySignupCode(signupChallenge.challengeId, code);
      setStep('kycPrompt');
    } catch (e) {
      setVerifyError(errMsg(e));
      setVerifyDigits(['', '', '', '', '', '']);
      setTimeout(() => verifyInputs.current[0]?.focus(), 50);
    } finally {
      setVerifyLoading(false);
    }
  };

  const resendVerifyCode = async () => {
    setVerifyError(null);
    setVerifyInfo(null);
    try {
      const ch = await sendSignupVerifyCode();
      setSignupChallenge(ch);
      setVerifyCooldown(60);
      setVerifyDigits(['', '', '', '', '', '']);
      setVerifyInfo('A new code has been sent to your email.');
    } catch (e) {
      setVerifyError(errMsg(e));
    }
  };

  const goToKyc = () => {
    onSuccess({ name: verifiedUserName, email: email.trim() });
    onClose();
    setTimeout(() => navigate('/dashboard?tab=kyc'), 50);
  };

  const skipKyc = () => {
    onSuccess({ name: verifiedUserName, email: email.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-4xl bg-[#14170e] border border-[#6dff8a]/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative text-left max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white/70 hover:text-white transition-colors border border-white/10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left visual panel */}
        <div className="relative md:w-5/12 hidden sm:flex flex-col justify-between p-7 bg-[#0d1008] border-b md:border-b-0 md:border-r border-white/10 overflow-hidden shrink-0">
          <img
            src="/images/user-login.jpg"
            alt="TradeShark Financial Markets"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-45 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10130a] via-[#10130a]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#14170e]" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 border border-[#6dff8a]/40 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#6dff8a] animate-pulse" />
              <span className="text-[11px] font-semibold text-white tracking-wide">Next-Gen Multi-Asset Broker</span>
            </div>
          </div>
          <div className="relative z-10 space-y-3 pt-24">
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Execution Speed</span>
                <span className="text-[#6dff8a] font-mono font-bold">&lt; 1.2ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Markets Available</span>
                <span className="text-white font-mono font-bold">Stocks • Crypto • FX</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Account Security</span>
                <span className="text-yellow-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>KYC Verified</span>
                </span>
              </div>
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Trade over 5,000 global stocks, forex pairs, indices, and crypto from one account.
            </p>
          </div>
        </div>

        {/* Right: dynamic content */}
        <div className="flex-1 p-6 sm:p-8 md:p-9 flex flex-col justify-center bg-[#14170e]">

          {/* LOGIN OTP */}
          {step === 'loginOtp' && loginOtp ? (
            <OtpStep
              challenge={loginOtp}
              onVerified={finishLogin}
              onCancel={() => { setLoginOtp(null); setStep('form'); setPassword(''); }}
            />

          /* EMAIL VERIFY */
          ) : step === 'emailVerify' ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center gap-4 pb-2">
                <div className="w-16 h-16 rounded-2xl bg-[#6dff8a]/15 border border-[#6dff8a]/30 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-[#6dff8a]" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">Verify your email</h3>
                  <p className="text-sm text-white/55 mt-1 max-w-xs mx-auto leading-relaxed">
                    We sent a 6-digit code to{' '}
                    <span className="text-white font-semibold break-all">{signupChallenge?.email}</span>.
                    {' '}Expires in {signupChallenge?.expiresInMinutes ?? 10} min.
                  </p>
                </div>
              </div>

              {verifyError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{verifyError}</span>
                </div>
              )}
              {verifyInfo && !verifyError && (
                <div className="p-3 rounded-xl bg-[#6dff8a]/10 border border-[#6dff8a]/20 text-[#6dff8a] text-xs">
                  {verifyInfo}
                </div>
              )}

              <form onSubmit={e => { e.preventDefault(); submitVerifyCode(verifyDigits.join('')); }} className="space-y-5">
                <div className="flex gap-1.5 sm:gap-3 justify-center">
                  {verifyDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => { verifyInputs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={d}
                      onChange={e => setVerifyAt(i, e.target.value)}
                      onKeyDown={e => onVerifyKey(i, e)}
                      disabled={verifyLoading}
                      className="w-9 h-12 sm:w-12 sm:h-14 text-center text-base sm:text-xl font-bold font-mono bg-black/60 border border-white/20 rounded-xl text-white focus:outline-none focus:border-[#6dff8a] focus:bg-[#6dff8a]/10 transition-all disabled:opacity-40"
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={verifyLoading || verifyDigits.join('').length < 6}
                  className="w-full py-3 rounded-xl bg-[#6dff8a] hover:bg-[#5ce077] text-[#15170f] font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {verifyLoading ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /><span>Confirm Email</span></>
                  )}
                </button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={resendVerifyCode}
                  disabled={verifyCooldown > 0}
                  className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white disabled:opacity-40 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {verifyCooldown > 0 ? `Resend in ${verifyCooldown}s` : 'Resend code'}
                </button>
              </div>
            </div>

          /* KYC PROMPT */
          ) : step === 'kycPrompt' ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-[#6dff8a]/10 border-2 border-[#6dff8a]/30 flex items-center justify-center">
                    <Fingerprint className="w-10 h-10 text-[#6dff8a]" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#6dff8a] flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="w-4 h-4 text-[#0a0d05]" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white">Email Verified! 🎉</h3>
                <p className="text-sm text-white/55 mt-2 max-w-xs mx-auto">
                  Your account is active. Complete identity verification to unlock full trading and withdrawals.
                </p>
              </div>

              <div className="bg-black/30 border border-white/10 rounded-2xl p-4 space-y-3 text-left">
                {[
                  { icon: <BadgeCheck className="w-4 h-4 text-[#6dff8a]" />, label: 'Upload a valid government ID', sub: "Passport, National ID, or Driver's License" },
                  { icon: <ClipboardList className="w-4 h-4 text-yellow-400" />, label: 'Submit proof of address', sub: 'Bank statement or utility bill (last 3 months)' },
                  { icon: <ShieldCheck className="w-4 h-4 text-blue-400" />, label: 'Quick selfie verification', sub: 'Hold your ID next to your face' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{item.label}</div>
                      <div className="text-[11px] text-white/40">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <button
                  onClick={goToKyc}
                  className="w-full py-3 rounded-xl bg-[#6dff8a] hover:bg-[#5ce077] text-[#15170f] font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(109,255,138,0.2)] transition-all cursor-pointer"
                >
                  <Fingerprint className="w-4 h-4" />
                  Complete KYC Now
                </button>
                <button
                  onClick={skipKyc}
                  className="w-full py-2.5 text-white/40 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  I'll do this later
                </button>
              </div>
            </div>

          /* MAIN FORM */
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <TradeSharkLogo size="sm" showLtd={true} className="mb-2" />
                <h3 className="text-xl sm:text-2xl font-bold text-white">
                  {mode === 'signup' ? 'Create your TradeShark account' : 'Log in to TradeShark'}
                </h3>
                <p className="text-xs text-[#a3a89e]">
                  {mode === 'signup'
                    ? 'Start trading stocks, crypto, and ETFs today.'
                    : 'Access your portfolio, live watchlists, and CopyTrader™.'}
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {mode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-xs text-white/70">Full Legal Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#6dff8a]"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-white/70">
                    {mode === 'signup' ? 'Email Address' : 'Email Address or Client ID'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#6dff8a]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-white/70">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      minLength={mode === 'signup' ? 8 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-xs text-white focus:outline-none focus:border-[#6dff8a]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {mode === 'login' && (
                  <label className="flex items-center gap-2 text-xs text-white/60 hover:text-white/80 cursor-pointer pt-0.5 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 text-[#6dff8a] focus:ring-0 cursor-pointer"
                    />
                    <span>Keep me signed in</span>
                  </label>
                )}
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { onClose(); navigate('/forgot-password'); }}
                    className="text-xs text-[#6dff8a] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}

                {mode === 'signup' && (
                  <label className="flex items-start gap-2 text-[11px] text-[#a3a89e] cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      required
                      className="accent-[#6dff8a] w-3.5 h-3.5 mt-0.5"
                    />
                    <span>
                      I confirm I have read and agree to the{' '}
                      <a href="/terms" target="_blank" className="text-[#6dff8a] underline">{config.legalName} Terms</a>,{' '}
                      <a href="/privacy" target="_blank" className="text-[#6dff8a] underline">Privacy Policy</a> and{' '}
                      <a href="/risk-disclosure" target="_blank" className="text-[#6dff8a] underline">Risk Disclosures</a>.
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-[#6dff8a] hover:bg-[#5ce077] text-[#15170f] font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(109,255,138,0.2)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{mode === 'signup' ? 'Create Account' : 'Log In to Account'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center text-xs text-[#a3a89e] pt-1">
                {mode === 'signup' ? (
                  <span>
                    Already have an account?{' '}
                    <button type="button" onClick={() => setMode('login')} className="text-[#6dff8a] font-semibold hover:underline">
                      Log in
                    </button>
                  </span>
                ) : (
                  <span>
                    Don't have an account yet?{' '}
                    <button type="button" onClick={() => setMode('signup')} className="text-[#6dff8a] font-semibold hover:underline">
                      Start Investing
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

