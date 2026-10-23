import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck, 
  HelpCircle,
  Sparkles,
  Zap
} from 'lucide-react';
import { useBrokerage } from '../../context/BrokerageContext';

export interface LiveChatAdminConfig {
  active: boolean;
  provider: 'auto' | 'tidio' | 'smartsupp' | 'tawkto' | 'custom' | 'off';
  scriptUrl: string;
  tidioKey: string;
  smartsuppKey: string;
  tawktoPropertyId: string;
  tawktoWidgetId: string;
  customScriptUrl: string;
  isCustomized?: boolean;
}

export const AdminLiveChatTab: React.FC = () => {
  const { notify } = useBrokerage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [provider, setProvider] = useState<'auto' | 'tidio' | 'smartsupp' | 'tawkto' | 'custom' | 'off'>('auto');
  const [tidioKey, setTidioKey] = useState('');
  const [smartsuppKey, setSmartsuppKey] = useState('');
  const [tawktoPropertyId, setTawktoPropertyId] = useState('');
  const [tawktoWidgetId, setTawktoWidgetId] = useState('default');
  const [tawktoCombinedKey, setTawktoCombinedKey] = useState('');
  const [customScriptUrl, setCustomScriptUrl] = useState('');
  
  const [activeInfo, setActiveInfo] = useState<{ active: boolean; provider: string; scriptUrl: string; isCustomized?: boolean } | null>(null);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/livechat', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ts_admin_token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to load live chat config');
      const data = await res.json();
      const cfg: LiveChatAdminConfig = data.config;
      setProvider(cfg.provider || 'auto');
      setTidioKey(cfg.tidioKey || '');
      setSmartsuppKey(cfg.smartsuppKey || '');
      setTawktoPropertyId(cfg.tawktoPropertyId || '');
      setTawktoWidgetId(cfg.tawktoWidgetId || 'default');
      setCustomScriptUrl(cfg.customScriptUrl || '');
      if (cfg.tawktoPropertyId && cfg.tawktoWidgetId) {
        setTawktoCombinedKey(`${cfg.tawktoPropertyId}/${cfg.tawktoWidgetId}`);
      }
      setActiveInfo({
        active: cfg.active,
        provider: cfg.provider,
        scriptUrl: cfg.scriptUrl,
        isCustomized: cfg.isCustomized,
      });
    } catch (err: any) {
      notify(err.message || 'Error loading live chat configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        provider,
        tidioKey,
        smartsuppKey,
        tawktoPropertyId,
        tawktoWidgetId,
        tawktoKey: tawktoCombinedKey,
        customScriptUrl,
      };
      const res = await fetch('/api/admin/livechat', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ts_admin_token') || ''}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save configuration');
      }
      const data = await res.json();
      notify('Live chat settings saved & auto-deployed successfully!', 'success');
      setActiveInfo({
        active: data.config.active,
        provider: data.config.provider,
        scriptUrl: data.config.scriptUrl,
        isCustomized: data.config.isCustomized,
      });
    } catch (err: any) {
      notify(err.message || 'Could not save live chat settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset live chat settings to environment variable defaults?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/livechat/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ts_admin_token') || ''}`,
        },
      });
      if (!res.ok) throw new Error('Reset failed');
      notify('Live chat reset to environment variable defaults.', 'info');
      await loadConfig();
    } catch (err: any) {
      notify(err.message || 'Could not reset live chat', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-[#6dff8a] animate-spin mx-auto" />
        <p className="text-sm text-white/50 font-mono">Loading live chat integrations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#6dff8a]" />
              <span>Live Chat &amp; Help Desk Integrations</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#6dff8a]/20 text-[#6dff8a] border border-[#6dff8a]/30">
              Universal Auto-Deploy
            </span>
          </div>
          <p className="text-xs text-[#a3a89e] mt-1">
            Install and manage Tidio, Smartsupp, Tawk.to, or custom live chat widgets across your trading platform.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeInfo?.active ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#6dff8a]/10 border border-[#6dff8a]/30 text-xs font-semibold text-[#6dff8a]">
              <span className="w-2 h-2 rounded-full bg-[#6dff8a] animate-pulse" />
              <span>Active: {activeInfo.provider.toUpperCase()}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-xs font-semibold text-yellow-300">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              <span>No Active Chat Widget</span>
            </div>
          )}
          <button
            type="button"
            onClick={loadConfig}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Reload settings"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Step 1: Provider selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-white/90 uppercase tracking-wider block">
            1. Select Chat System Provider
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: 'auto', label: 'Auto Detect', sub: 'Picks any provided key', icon: <Zap className="w-4 h-4 text-[#6dff8a]" /> },
              { id: 'tidio', label: 'Tidio', sub: 'Live chat & AI bots', icon: <MessageSquare className="w-4 h-4 text-blue-400" /> },
              { id: 'smartsupp', label: 'Smartsupp', sub: 'Chat & visitor recording', icon: <MessageSquare className="w-4 h-4 text-orange-400" /> },
              { id: 'tawkto', label: 'Tawk.to', sub: '100% Free live chat', icon: <MessageSquare className="w-4 h-4 text-emerald-400" /> },
              { id: 'custom', label: 'Custom Script', sub: 'Crisp, Zendesk, etc.', icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
            ].map((p) => {
              const isSelected = provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id as any)}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    isSelected
                      ? 'bg-[#6dff8a]/10 border-[#6dff8a] shadow-[0_0_15px_rgba(109,255,138,0.15)]'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {p.icon}
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#6dff8a]" />}
                  </div>
                  <div className="font-bold text-xs text-white mt-2">{p.label}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{p.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Key Inputs */}
        <div className="bg-black/30 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#6dff8a]" />
              <span>Provider API Keys &amp; Credentials</span>
            </h4>
            <span className="text-[11px] text-white/40">You can paste either the raw public key OR the embed code/URL</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Tidio */}
            <div className={`p-4 rounded-xl border transition-all ${provider === 'tidio' || provider === 'auto' ? 'bg-white/[0.03] border-white/15' : 'bg-transparent border-white/5 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">Tidio Public Key</span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">TIDIO_KEY</span>
                </div>
                <a
                  href="https://www.tidio.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#6dff8a] hover:underline flex items-center gap-1"
                >
                  <span>tidio.com</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="text"
                placeholder="e.g. abcdef0123456789abcdef0123456789"
                value={tidioKey}
                onChange={(e) => setTidioKey(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#6dff8a]"
              />
              <p className="text-[11px] text-white/40 mt-1.5">
                Found in Tidio &rarr; <em>Settings &rarr; Live Chat &rarr; Installation</em> (or paste the <code className="text-[#6dff8a]">//code.tidio.co/xxxx.js</code> script URL).
              </p>
            </div>

            {/* Smartsupp */}
            <div className={`p-4 rounded-xl border transition-all ${provider === 'smartsupp' || provider === 'auto' ? 'bg-white/[0.03] border-white/15' : 'bg-transparent border-white/5 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">Smartsupp Key</span>
                  <span className="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-mono">SMARTSUPP_KEY</span>
                </div>
                <a
                  href="https://www.smartsupp.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#6dff8a] hover:underline flex items-center gap-1"
                >
                  <span>smartsupp.com</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="text"
                placeholder="e.g. 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b"
                value={smartsuppKey}
                onChange={(e) => setSmartsuppKey(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#6dff8a]"
              />
              <p className="text-[11px] text-white/40 mt-1.5">
                Found in Smartsupp &rarr; <em>Settings &rarr; Chat box &rarr; Chat code</em> (the 40-character key).
              </p>
            </div>

            {/* Tawk.to */}
            <div className={`p-4 rounded-xl border transition-all ${provider === 'tawkto' || provider === 'auto' ? 'bg-white/[0.03] border-white/15' : 'bg-transparent border-white/5 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">Tawk.to Embed / Property ID</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">TAWKTO_PROPERTY_ID</span>
                </div>
                <a
                  href="https://www.tawk.to"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#6dff8a] hover:underline flex items-center gap-1"
                >
                  <span>tawk.to</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="text"
                placeholder="e.g. 64a1b2c3d4e5f6a7b8c9d0e1/1h4abcd12 (or paste embed.tawk.to URL)"
                value={tawktoCombinedKey}
                onChange={(e) => {
                  setTawktoCombinedKey(e.target.value);
                  const clean = e.target.value.trim();
                  if (clean.includes('/')) {
                    const parts = clean.split('/').map(s => s.trim());
                    if (parts[0]) setTawktoPropertyId(parts[0]);
                    if (parts[1]) setTawktoWidgetId(parts[1]);
                  } else {
                    setTawktoPropertyId(clean);
                  }
                }}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#6dff8a]"
              />
              <p className="text-[11px] text-white/40 mt-1.5">
                Found in Tawk.to &rarr; <em>Administration &rarr; Channels &rarr; Chat Widget &rarr; Direct Chat Link</em>.
              </p>
            </div>

            {/* Custom Script */}
            <div className={`p-4 rounded-xl border transition-all ${provider === 'custom' || provider === 'auto' ? 'bg-white/[0.03] border-white/15' : 'bg-transparent border-white/5 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">Custom Live Chat Script URL</span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono">LIVE_CHAT_SCRIPT_URL</span>
                </div>
              </div>
              <input
                type="text"
                placeholder="https://client.crisp.chat/l.js or custom loader URL"
                value={customScriptUrl}
                onChange={(e) => setCustomScriptUrl(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#6dff8a]"
              />
              <p className="text-[11px] text-white/40 mt-1.5">
                Any other live chat widget (Crisp, Intercom, LiveChat, Zendesk, JivoChat, etc.).
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-[#6dff8a] hover:bg-[#5ce077] text-[#15170f] font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(109,255,138,0.25)] transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save &amp; Auto-Deploy Live Chat</span>
            </button>

            {activeInfo?.isCustomized && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-semibold text-xs transition-colors"
              >
                Reset to Env Defaults
              </button>
            )}
          </div>

          <p className="text-[11px] text-white/40 text-center sm:text-right">
            Settings take effect immediately for all visiting clients without needing to rebuild or restart the server.
          </p>
        </div>
      </form>

      {/* Environment Variables Reference Table */}
      <div className="border border-white/10 rounded-2xl bg-[#14170e] p-5 space-y-3">
        <div className="flex items-center gap-2 text-white font-bold text-xs">
          <HelpCircle className="w-4 h-4 text-[#6dff8a]" />
          <span>Environment Variables Reference (For Railway, Render, or Docker .env)</span>
        </div>
        <p className="text-[11px] text-white/50">
          You can also set these environment variables directly in your hosting platform. The system auto-detects them:
        </p>

        <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40 divide-y divide-white/5 text-xs font-mono">
          {[
            { env: 'TIDIO_KEY', desc: 'Tidio Project Public Key (or full tidio script URL)' },
            { env: 'SMARTSUPP_KEY', desc: 'Smartsupp Chat Box Key' },
            { env: 'TAWKTO_PROPERTY_ID', desc: 'Tawk.to Property ID' },
            { env: 'TAWKTO_WIDGET_ID', desc: 'Tawk.to Widget ID (defaults to "default")' },
            { env: 'TAWKTO_KEY', desc: 'Tawk.to combined "property_id/widget_id" or embed URL' },
            { env: 'LIVE_CHAT_SCRIPT_URL', desc: 'Custom live chat script URL (Crisp, Zendesk, etc.)' },
            { env: 'LIVE_CHAT_PROVIDER', desc: '"auto" | "tidio" | "smartsupp" | "tawkto" | "custom" | "off"' },
          ].map((row) => (
            <div key={row.env} className="p-3 flex items-center justify-between gap-4 hover:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="text-[#6dff8a] font-bold">{row.env}</span>
                <span className="text-white/40 text-[11px] font-sans">({row.desc})</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(row.env, row.env)}
                className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[11px] flex items-center gap-1 transition-colors"
              >
                {copiedKey === row.env ? <Check className="w-3 h-3 text-[#6dff8a]" /> : <Copy className="w-3 h-3" />}
                <span className="font-sans text-[10px]">{copiedKey === row.env ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
