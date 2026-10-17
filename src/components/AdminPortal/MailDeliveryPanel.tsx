import React, { useEffect, useState } from 'react';
import { Send, ServerCog, AlertTriangle, CheckCircle2, Sliders, RotateCcw, Save, ShieldCheck, Mail } from 'lucide-react';
import { api, errMsg } from '../../lib/api';

interface MailConfigData {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromAddress: string;
  fromName: string;
  replyTo: string;
  resendApiKey: string;
  brevoApiKey: string;
  loginOtp: boolean;
  isCustomized: boolean;
}

export const MailDeliveryPanel: React.FC = () => {
  const [status, setStatus] = useState<{ providers: string[]; status: string; resend?: string; fromAddress: string; fromName?: string; loginOtp: boolean; isCustomized?: boolean } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [mailConfig, setMailConfig] = useState<MailConfigData>({
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    fromAddress: '',
    fromName: '',
    replyTo: '',
    resendApiKey: '',
    brevoApiKey: '',
    loginOtp: true,
    isCustomized: false,
  });

  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [configMessage, setConfigMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const s = await api.get('/api/admin/mail/status');
      setStatus(s);
    } catch (e) {
      setResult({ ok: false, text: errMsg(e) });
    }
  };

  const loadConfig = async () => {
    try {
      const res = await api.get('/api/admin/mail/config');
      if (res?.config) setMailConfig(res.config);
    } catch (e) {
      console.error('Failed to load mail config', e);
    }
  };

  useEffect(() => {
    loadStatus();
    loadConfig();
  }, []);

  const test = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.post('/api/admin/mail/test', { to });
      setResult({ ok: true, text: r.message });
      loadStatus();
    } catch (e) {
      setResult({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setConfigMessage(null);
    try {
      const r = await api.put('/api/admin/mail/config', mailConfig);
      setConfigMessage(r.message || 'Mail settings updated successfully!');
      loadStatus();
      loadConfig();
    } catch (err: any) {
      setConfigMessage(`Error: ${errMsg(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    if (!window.confirm('Reset mail settings to environment variables defaults?')) return;
    setSaving(true);
    try {
      const r = await api.post('/api/admin/mail/reset');
      setConfigMessage(r.message || 'Reset to environment defaults.');
      loadStatus();
      loadConfig();
    } catch (err: any) {
      setConfigMessage(`Error: ${errMsg(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const noProvider = status && status.providers.length === 0;

  return (
    <div className={`p-4 rounded-2xl border text-xs space-y-3 ${noProvider ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-white font-semibold">
          <ServerCog className="w-4 h-4 text-[#6dff8a]" />
          <span>Email Delivery System</span>
          {status?.isCustomized && (
            <span className="px-2 py-0.5 rounded-full bg-[#6dff8a]/20 text-[#6dff8a] text-[10px] font-bold">
              Custom Admin Config
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {status && (
            <span className="text-white/60">
              Provider: <span className="text-white font-mono">{status.providers.length ? status.providers.join(' → ') : 'log only'}</span>
              {' · '}From: <span className="text-white font-mono">{status.fromAddress || 'not set'}</span>
              {' · '}Login OTP: <span className={status.loginOtp ? 'text-[#6dff8a]' : 'text-yellow-400'}>{status.loginOtp ? 'on' : 'off'}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white flex items-center gap-1.5 text-xs font-medium transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-[#6dff8a]" />
            <span>{showConfig ? 'Hide SMTP Settings' : 'Configure SMTP / Mail'}</span>
          </button>
        </div>
      </div>

      {status?.resend && (
        <div className={`flex items-start gap-2 ${status.resend.startsWith('ready') ? 'text-[#6dff8a]' : 'text-yellow-300'}`}>
          {status.resend.startsWith('ready') ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>Resend: {status.resend}</span>
        </div>
      )}

      {noProvider && (
        <div className="flex items-start gap-2 text-yellow-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            No active email provider detected. Outgoing emails and login OTP codes are logged to server console.
            Click <b>Configure SMTP / Mail</b> to set up your SMTP server (Gmail, Titan, PrivateEmail, etc.) or Resend API key directly.
          </span>
        </div>
      )}

      {/* EXPANDABLE SMTP & EMAIL CONFIGURATION FORM */}
      {showConfig && (
        <form onSubmit={saveSettings} className="p-4 rounded-xl border border-white/15 bg-black/40 space-y-4 my-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-[#6dff8a]" />
              <span>Mail Server &amp; Provider Settings</span>
            </h5>
            <span className="text-[11px] text-white/50">Changes apply immediately without server restart</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-white/70 block mb-1">SMTP Host</label>
              <input
                type="text"
                placeholder="e.g. smtp.titan.email or mail.domain.com"
                value={mailConfig.smtpHost}
                onChange={e => setMailConfig({ ...mailConfig, smtpHost: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-[#6dff8a]"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/70 block mb-1">SMTP Port</label>
              <input
                type="number"
                placeholder="465 or 587"
                value={mailConfig.smtpPort || ''}
                onChange={e => setMailConfig({ ...mailConfig, smtpPort: Number(e.target.value) || 587 })}
                className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-[#6dff8a]"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/70 block mb-1">Encryption (SSL/TLS)</label>
              <label className="flex items-center gap-2 mt-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={mailConfig.smtpSecure}
                  onChange={e => setMailConfig({ ...mailConfig, smtpSecure: e.target.checked })}
                  className="rounded text-[#6dff8a] focus:ring-0"
                />
                <span>SSL/TLS (Port 465)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/70 block mb-1">SMTP Username / Email</label>
              <input
                type="text"
                placeholder="user@domain.com"
                value={mailConfig.smtpUser}
                onChange={e => setMailConfig({ ...mailConfig, smtpUser: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-[#6dff8a]"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/70 block mb-1">SMTP Password</label>
              <input
                type="password"
                placeholder="Password or App Password"
                value={mailConfig.smtpPass}
                onChange={e => setMailConfig({ ...mailConfig, smtpPass: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-[#6dff8a]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-white/70 block mb-1">Sender Email (From)</label>
              <input
                type="email"
                placeholder="no-reply@domain.com"
                value={mailConfig.fromAddress}
                onChange={e => setMailConfig({ ...mailConfig, fromAddress: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-[#6dff8a]"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/70 block mb-1">Sender Name (Brand)</label>
              <input
                type="text"
                placeholder="TradeShark Support"
                value={mailConfig.fromName}
                onChange={e => setMailConfig({ ...mailConfig, fromName: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-[#6dff8a]"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/70 block mb-1">Reply-To Address</label>
              <input
                type="email"
                placeholder="support@domain.com"
                value={mailConfig.replyTo}
                onChange={e => setMailConfig({ ...mailConfig, replyTo: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-[#6dff8a]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/5">
            <div>
              <label className="text-[11px] text-white/70 block mb-1">Resend API Key (Optional)</label>
              <input
                type="password"
                placeholder="re_xxxxxxxxxxxxxx"
                value={mailConfig.resendApiKey}
                onChange={e => setMailConfig({ ...mailConfig, resendApiKey: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-[#6dff8a]"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/70 block mb-1">Brevo API Key (Optional)</label>
              <input
                type="password"
                placeholder="xkeysib-xxxxxxxxxxxxxx"
                value={mailConfig.brevoApiKey}
                onChange={e => setMailConfig({ ...mailConfig, brevoApiKey: e.target.value })}
                className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs focus:outline-none focus:border-[#6dff8a]"
              />
            </div>
          </div>

          {configMessage && (
            <div className={`p-2.5 rounded-lg text-xs ${configMessage.startsWith('Error') ? 'bg-red-500/10 text-red-300 border border-red-500/20' : 'bg-[#6dff8a]/10 text-[#6dff8a] border border-[#6dff8a]/20'}`}>
              {configMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={resetSettings}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-[#6dff8a] text-[#15170f] font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save & Apply Mailer'}</span>
            </button>
          </div>
        </form>
      )}

      {/* LIVE TEST DISPATCH BAR */}
      <div className="flex flex-wrap gap-2">
        <input
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="Enter recipient email address to test delivery..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/30"
        />
        <button
          onClick={test}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-[#6dff8a] text-[#15170f] font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{busy ? 'Sending...' : 'Send Test Email'}</span>
        </button>
      </div>

      {result && (
        <div className={`p-2.5 rounded-xl border flex items-start gap-2 break-all ${result.ok ? 'bg-[#6dff8a]/10 border-[#6dff8a]/30 text-[#6dff8a]' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{result.text}</span>
        </div>
      )}
    </div>
  );
};
