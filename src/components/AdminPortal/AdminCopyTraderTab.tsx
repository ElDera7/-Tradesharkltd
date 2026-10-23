import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  Plus, 
  Save, 
  Trash2, 
  Eye, 
  EyeOff, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  StopCircle, 
  Pencil, 
  X, 
  RotateCcw, 
  UserCheck, 
  DollarSign, 
  Activity, 
  History,
  CheckCircle2,
  AlertCircle,
  Upload,
  ImageIcon
} from 'lucide-react';
import { api, errMsg } from '../../lib/api';
import { useBrokerage } from '../../context/BrokerageContext';

interface AdminInvestor {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  role: string;
  bio: string;
  return24M: number;
  copiers: number;
  baseCopiers: number;
  riskScore: number;
  topHoldings: string[];
  dailyTarget: number | null;
  active: boolean;
  activeCopies: number;
  liveChangePercent: number;
  sortOrder: number;
}

interface ClosedCopy {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  investorId: string;
  name: string;
  handle: string;
  allocated: number;
  currentValue: number;
  profit: number;
  profitPercent: number;
  startedDate: string;
  stoppedDate?: string;
  stopReason?: string;
}

const EMPTY: Partial<AdminInvestor> = {
  name: '', handle: '', avatarUrl: '', role: 'Popular Investor', bio: '', return24M: 30, baseCopiers: 0, riskScore: 4,
  topHoldings: [], dailyTarget: null, active: true,
};

const money = (n: number) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const AdminCopyTraderTab: React.FC<{ onNotify: (msg: string) => void }> = ({ onNotify }) => {
  const { copies, users, refresh } = useBrokerage();
  const [subTab, setSubTab] = useState<'investors' | 'active' | 'assign' | 'history'>('investors');
  const [investors, setInvestors] = useState<AdminInvestor[]>([]);
  const [closedCopies, setClosedCopies] = useState<ClosedCopy[]>([]);
  const [editing, setEditing] = useState<Partial<AdminInvestor> | null>(null);
  const [busy, setBusy] = useState(false);
  const [adjust, setAdjust] = useState<Record<string, string>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      onNotify('Photo must be under 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setEditing(ed => ({ ...ed, avatarUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  // Reset performance modal/state
  const [resetTarget, setResetTarget] = useState<AdminInvestor | null>(null);
  const [resetPercent, setResetPercent] = useState('0');

  // Assign Copy Form State
  const [assignUserId, setAssignUserId] = useState('');
  const [assignInvestorId, setAssignInvestorId] = useState('');
  const [assignAmount, setAssignAmount] = useState('500');
  const [assignStopLoss, setAssignStopLoss] = useState('60');
  const [assignAutoCredit, setAssignAutoCredit] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    try {
      const invRes = await api.get('/api/admin/investors');
      if (invRes?.investors) setInvestors(invRes.investors);

      const copiesRes = await api.get('/api/admin/copies');
      if (copiesRes?.closed) setClosedCopies(copiesRes.closed);
    } catch (e) {
      onNotify(errMsg(e));
    }
  }, [onNotify]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const saveInvestor = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const body = { ...editing, topHoldings: Array.isArray(editing.topHoldings) ? editing.topHoldings : String(editing.topHoldings || '') };
      const r = editing.id
        ? await api.put(`/api/admin/investors/${editing.id}`, body)
        : await api.post('/api/admin/investors', body);
      setInvestors(r.investors);
      setEditing(null);
      onNotify(editing.id ? 'Investor profile updated.' : 'New investor listed.');
      refresh();
    } catch (e) {
      onNotify(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (inv: AdminInvestor) => {
    try {
      const r = await api.put(`/api/admin/investors/${inv.id}`, { active: !inv.active });
      setInvestors(r.investors);
      onNotify(inv.active ? `${inv.name} hidden from website listings.` : `${inv.name} is now visible on website.`);
      refresh();
    } catch (e) {
      onNotify(errMsg(e));
    }
  };

  const removeInvestor = async (inv: AdminInvestor) => {
    if (!window.confirm(`Delete ${inv.name}? If there are active client copies, the investor will be hidden instead of deleted.`)) return;
    try {
      const r = await api.del(`/api/admin/investors/${inv.id}`);
      setInvestors(r.investors);
      onNotify(r.hidden ? `${inv.name} has active copiers, so it was hidden instead of deleted.` : `${inv.name} deleted.`);
      refresh();
    } catch (e) {
      onNotify(errMsg(e));
    }
  };

  const handleResetIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      await api.post(`/api/admin/investors/${resetTarget.id}/reset-index`, { targetPercent: Number(resetPercent) || 0 });
      onNotify(`Performance for ${resetTarget.name} re-aligned to ${resetPercent}%.`);
      setResetTarget(null);
      load();
      refresh();
    } catch (err: any) {
      onNotify(errMsg(err));
    }
  };

  const applyAdjust = async (copyId: string, mode: 'percent' | 'amount', overrideVal?: number) => {
    const v = overrideVal !== undefined ? overrideVal : adjust[copyId];
    if (v === undefined || v === '') return onNotify('Enter a value first.');
    try {
      await api.post(`/api/admin/copies/${copyId}/adjust`, mode === 'percent' ? { profitPercent: Number(v) } : { amount: Number(v) });
      setAdjust(a => ({ ...a, [copyId]: '' }));
      onNotify('Copy P&L updated successfully.');
      refresh();
      load();
    } catch (e) {
      onNotify(errMsg(e));
    }
  };

  const forceStop = async (copyId: string, name: string) => {
    if (!window.confirm(`Close this copy of ${name} and return the liquidated funds to the client's balance?`)) return;
    try {
      await api.post(`/api/admin/copies/${copyId}/stop`, { reason: 'Closed by portfolio desk management' });
      onNotify('Copy portfolio closed and balance returned.');
      refresh();
      load();
    } catch (e) {
      onNotify(errMsg(e));
    }
  };

  const handleAssignCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId || !assignInvestorId || !assignAmount) {
      onNotify('Please select a client, investor, and allocation amount');
      return;
    }
    setAssigning(true);
    try {
      await api.post('/api/admin/copies', {
        userId: assignUserId,
        investorId: assignInvestorId,
        amount: Number(assignAmount),
        stopLossPercent: Number(assignStopLoss) || 60,
        autoCredit: assignAutoCredit,
      });
      onNotify('Copy trade successfully opened for client!');
      setAssignUserId('');
      setAssignInvestorId('');
      setAssignAmount('500');
      setSubTab('active');
      refresh();
      load();
    } catch (err: any) {
      onNotify(errMsg(err));
    } finally {
      setAssigning(false);
    }
  };

  const userName = (id: string) => users.find(u => u.id === id)?.name || id;

  const totalAllocated = copies.reduce((sum, c) => sum + (Number(c.allocated) || 0), 0);
  const totalValue = copies.reduce((sum, c) => sum + (Number(c.currentValue) || 0), 0);
  const totalNetProfit = totalValue - totalAllocated;

  const field = (k: keyof AdminInvestor, label: string, type: 'text' | 'number' = 'text', placeholder = '') => (
    <label className="block text-[11px] text-white/60 space-y-1">
      <span>{label}</span>
      <input
        type={type}
        step="any"
        value={k === 'topHoldings' ? (Array.isArray(editing?.topHoldings) ? editing!.topHoldings.join(', ') : (editing?.topHoldings as any) || '') : (editing?.[k] as any) ?? ''}
        placeholder={placeholder}
        onChange={e => setEditing(ed => ({ ...ed, [k]: k === 'topHoldings' ? e.target.value : type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }))}
        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-[#6dff8a]"
      />
    </label>
  );

  return (
    <div className="space-y-6">
      {/* OVERVIEW STATS BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
          <div className="text-[11px] text-white/50 font-medium">Active Copied Capital</div>
          <div className="text-base sm:text-lg font-bold font-mono text-white mt-1">{money(totalAllocated)}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
          <div className="text-[11px] text-white/50 font-medium">Active Copy Positions</div>
          <div className="text-base sm:text-lg font-bold font-mono text-[#6dff8a] mt-1">{copies.length}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
          <div className="text-[11px] text-white/50 font-medium">Total Unrealized P&amp;L</div>
          <div className={`text-base sm:text-lg font-bold font-mono mt-1 ${totalNetProfit >= 0 ? 'text-[#6dff8a]' : 'text-red-400'}`}>
            {totalNetProfit >= 0 ? '+' : ''}{money(totalNetProfit)}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
          <div className="text-[11px] text-white/50 font-medium">Popular Investors Listed</div>
          <div className="text-base sm:text-lg font-bold font-mono text-white mt-1">{investors.length}</div>
        </div>
      </div>

      {/* TOP SUBTABS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#6dff8a]" /> CopyTrader Control Desk
          </h3>
          <p className="text-xs text-white/50">Manage popular investor algorithms, active copy allocations, and P&amp;L adjustments.</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
          <button
            onClick={() => setSubTab('investors')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              subTab === 'investors' ? 'bg-[#6dff8a] text-[#15170f]' : 'text-white/70 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Popular Investors ({investors.length})</span>
          </button>

          <button
            onClick={() => setSubTab('active')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              subTab === 'active' ? 'bg-[#6dff8a] text-[#15170f]' : 'text-white/70 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Active Client Copies ({copies.length})</span>
          </button>

          <button
            onClick={() => setSubTab('assign')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              subTab === 'assign' ? 'bg-[#6dff8a] text-[#15170f]' : 'text-white/70 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Assign Copy for Client</span>
          </button>

          <button
            onClick={() => setSubTab('history')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              subTab === 'history' ? 'bg-[#6dff8a] text-[#15170f]' : 'text-white/70 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Copy History ({closedCopies.length})</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: POPULAR INVESTORS */}
      {subTab === 'investors' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setEditing({ ...EMPTY })}
              className="px-4 py-2 rounded-lg bg-[#6dff8a] text-[#15170f] text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Popular Investor
            </button>
          </div>

          {editing && (
            <div className="p-4 rounded-2xl border border-[#6dff8a]/30 bg-white/[0.03] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">{editing.id ? `Edit Investor: ${editing.name}` : 'Create New Popular Investor'}</h4>
                <button onClick={() => setEditing(null)} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {field('name', 'Name')}
                {field('handle', 'Handle', 'text', '@handle')}
                {field('role', 'Badge / Role', 'text', 'Elite Pro Investor')}
                {/* Photo Upload — replaces URL text field */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                  <label className="block text-[11px] text-white/60 mb-2 font-medium">Trader Photo</label>
                  <div className="flex items-center gap-4">
                    {/* Preview */}
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/15 bg-white/5 flex items-center justify-center shrink-0">
                      {editing?.avatarUrl ? (
                        <img
                          src={editing.avatarUrl}
                          alt="Preview"
                          className="w-full h-full object-cover object-center"
                        />
                      ) : (
                        <ImageIcon className="w-7 h-7 text-white/20" />
                      )}
                    </div>
                    {/* Upload controls */}
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6dff8a]/10 hover:bg-[#6dff8a]/20 border border-[#6dff8a]/30 text-[#6dff8a] text-xs font-bold transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {editing?.avatarUrl ? 'Change Photo' : 'Upload Photo'}
                      </button>
                      {editing?.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setEditing(ed => ({ ...ed, avatarUrl: '' }))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[11px] font-semibold transition-all"
                        >
                          <X className="w-3 h-3" /> Remove Photo
                        </button>
                      )}
                      <p className="text-[10px] text-white/30">JPG, PNG, WebP · max 5 MB</p>
                    </div>
                    {/* Hidden file input */}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>
                </div>
                {field('return24M', '24-Month Return %', 'number')}
                {field('riskScore', 'Risk Score (1-10)', 'number')}
                {field('baseCopiers', 'Base Copiers (Shown + Real copies)', 'number')}
                {field('dailyTarget', 'Daily Performance Target % (blank = auto)', 'number', 'e.g. 0.5')}
                {field('topHoldings', 'Top Holdings (comma separated)', 'text', 'AAPL, MSFT, BTC')}
              </div>
              <label className="block text-[11px] text-white/60 space-y-1">
                <span>Bio / Trading Philosophy</span>
                <textarea
                  value={editing.bio || ''}
                  onChange={e => setEditing(ed => ({ ...ed, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-[#6dff8a]"
                />
              </label>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={editing.active !== false}
                    onChange={e => setEditing(ed => ({ ...ed, active: e.target.checked }))}
                  />
                  <span>Listed publicly on website</span>
                </label>
                <button onClick={saveInvestor} disabled={busy} className="px-4 py-2 rounded-lg bg-[#6dff8a] text-[#15170f] text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  <Save className="w-4 h-4" /> {busy ? 'Saving…' : 'Save Investor Profile'}
                </button>
              </div>
            </div>
          )}

          {/* Reset Performance Modal */}
          {resetTarget && (
            <div className="p-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-yellow-400" />
                  <span>Re-align Performance Index: {resetTarget.name}</span>
                </h4>
                <button onClick={() => setResetTarget(null)} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-white/70">
                Reset or set the live return baseline for this investor. Live return is currently at{' '}
                <strong className={resetTarget.liveChangePercent >= 0 ? 'text-[#6dff8a]' : 'text-red-400'}>
                  {resetTarget.liveChangePercent}%
                </strong>.
              </p>
              <form onSubmit={handleResetIndex} className="flex flex-wrap items-center gap-3">
                <label className="text-xs text-white/70">Set target return %:</label>
                <input
                  type="number"
                  step="any"
                  value={resetPercent}
                  onChange={e => setResetPercent(e.target.value)}
                  placeholder="0"
                  className="w-24 px-3 py-1.5 rounded-lg bg-black/50 border border-white/15 text-white text-xs"
                />
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-yellow-400 text-black font-bold text-xs">
                  Apply Reset
                </button>
                <button type="button" onClick={() => setResetPercent('0')} className="px-2 py-1 rounded bg-white/10 text-white text-xs">
                  Reset to 0%
                </button>
              </form>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/5 text-white/50 text-left">
                <tr>
                  <th className="p-3">Investor</th>
                  <th className="p-3">24M Return</th>
                  <th className="p-3">Live Return</th>
                  <th className="p-3">Risk</th>
                  <th className="p-3">Daily Drift</th>
                  <th className="p-3">Copiers</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {investors.map(inv => (
                  <tr key={inv.id} className="border-t border-white/5 text-white/80 hover:bg-white/[0.01]">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center border border-white/10">
                          {inv.avatarUrl ? (
                            <img src={inv.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-white/30" />
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-white">{inv.name}</div>
                          <div className="text-white/40">{inv.handle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-[#6dff8a] font-mono">+{inv.return24M}%</td>
                    <td className={`p-3 font-mono ${inv.liveChangePercent >= 0 ? 'text-[#6dff8a]' : 'text-red-400'}`}>
                      {inv.liveChangePercent >= 0 ? <TrendingUp className="inline w-3 h-3" /> : <TrendingDown className="inline w-3 h-3" />} {inv.liveChangePercent}%
                    </td>
                    <td className="p-3">{inv.riskScore}/10</td>
                    <td className="p-3 font-mono text-white/60">
                      {inv.dailyTarget !== null && inv.dailyTarget !== undefined ? `${inv.dailyTarget}%/day` : 'auto'}
                    </td>
                    <td className="p-3 font-mono">{inv.copiers.toLocaleString()}</td>
                    <td className="p-3">
                      {inv.active ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#6dff8a]/20 text-[#6dff8a] text-[10px] font-semibold">Listed</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 text-[10px] font-semibold">Hidden</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          title="Re-align / Reset performance index"
                          onClick={() => { setResetTarget(inv); setResetPercent('0'); }}
                          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-yellow-300"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Edit Profile"
                          onClick={() => setEditing({ ...inv })}
                          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title={inv.active ? 'Hide from website' : 'Make visible'}
                          onClick={() => toggleActive(inv)}
                          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/70"
                        >
                          {inv.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          title="Delete Investor"
                          onClick={() => removeInvestor(inv)}
                          className="p-1.5 rounded bg-white/5 hover:bg-red-500/20 text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: ACTIVE CLIENT COPIES */}
      {subTab === 'active' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">Active Client Portfolio Allocations ({copies.length})</h4>
            <button
              onClick={() => setSubTab('assign')}
              className="px-3 py-1.5 rounded-lg bg-[#6dff8a] text-[#15170f] font-bold text-xs flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" /> Start Copy for Client
            </button>
          </div>

          {copies.length === 0 ? (
            <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02] text-center space-y-2">
              <p className="text-sm text-white/60">No active client copy trades at this time.</p>
              <button
                onClick={() => setSubTab('assign')}
                className="px-4 py-2 rounded-lg bg-[#6dff8a] text-[#15170f] text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Allocate Copy Portfolio Now
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-white/5 text-white/50 text-left">
                  <tr>
                    <th className="p-3">Client Trader</th>
                    <th className="p-3">Following Investor</th>
                    <th className="p-3">Allocated</th>
                    <th className="p-3">Live Value</th>
                    <th className="p-3">Live P&amp;L</th>
                    <th className="p-3">P&amp;L Control</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {copies.map(c => (
                    <tr key={c.id} className="border-t border-white/5 text-white/80 hover:bg-white/[0.01]">
                      <td className="p-3">
                        <div className="font-semibold text-white">{userName(c.userId)}</div>
                        <div className="text-white/40 text-[10px] font-mono">{c.userId}</div>
                      </td>
                      <td className="p-3 font-semibold text-white">
                        {c.name}
                        <div className="text-white/40 text-[10px]">{c.handle}</div>
                      </td>
                      <td className="p-3 font-mono">{money(c.allocated)}</td>
                      <td className="p-3 font-mono font-bold text-white">{money(c.currentValue)}</td>
                      <td className={`p-3 font-mono font-bold ${c.profit >= 0 ? 'text-[#6dff8a]' : 'text-red-400'}`}>
                        {c.profit >= 0 ? '+' : ''}{money(c.profit)} ({c.profitPercent}%)
                      </td>
                      <td className="p-3">
                        <div className="space-y-1.5">
                          <div className="flex gap-1 items-center">
                            <input
                              value={adjust[c.id] || ''}
                              onChange={e => setAdjust(a => ({ ...a, [c.id]: e.target.value }))}
                              placeholder="e.g. 15 or 250"
                              className="w-24 px-2 py-1 rounded bg-black/40 border border-white/10 text-white text-xs"
                            />
                            <button
                              onClick={() => applyAdjust(c.id, 'percent')}
                              className="px-2 py-1 rounded bg-[#6dff8a]/20 hover:bg-[#6dff8a]/30 text-[#6dff8a] font-semibold text-[11px]"
                              title="Set total P&L to exact %"
                            >
                              Set %
                            </button>
                            <button
                              onClick={() => applyAdjust(c.id, 'amount')}
                              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px]"
                              title="Add or subtract cash amount"
                            >
                              ± $
                            </button>
                          </div>
                          {/* Quick presets */}
                          <div className="flex gap-1 text-[10px]">
                            <button onClick={() => applyAdjust(c.id, 'percent', 10)} className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[#6dff8a]">+10%</button>
                            <button onClick={() => applyAdjust(c.id, 'percent', 25)} className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[#6dff8a]">+25%</button>
                            <button onClick={() => applyAdjust(c.id, 'percent', -10)} className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-red-400">-10%</button>
                            <button onClick={() => applyAdjust(c.id, 'percent', 0)} className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/50">0%</button>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => forceStop(c.id, c.name)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold inline-flex items-center gap-1"
                          title="Liquidate copy and credit funds"
                        >
                          <StopCircle className="w-3.5 h-3.5" />
                          <span>Close Copy</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: ASSIGN COPY TRADE FOR CLIENT */}
      {subTab === 'assign' && (
        <div className="max-w-2xl bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#6dff8a]" />
            <span>Assign Portfolio Copy to Client</span>
          </h4>
          <p className="text-xs text-white/60">
            Open an active copy portfolio directly on behalf of a registered trader.
          </p>

          <form onSubmit={handleAssignCopy} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-1">Select Client Account *</label>
              <select
                required
                value={assignUserId}
                onChange={e => setAssignUserId(e.target.value)}
                className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6dff8a]"
              >
                <option value="">-- Choose trader account --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) — Balance: ${u.realBalance.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/70 block mb-1">Select Popular Investor to Copy *</label>
              <select
                required
                value={assignInvestorId}
                onChange={e => setAssignInvestorId(e.target.value)}
                className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6dff8a]"
              >
                <option value="">-- Choose popular investor --</option>
                {investors.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} ({inv.handle}) — 24M: +{inv.return24M}% • Risk: {inv.riskScore}/10
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">Allocation Capital ($) *</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={assignAmount}
                  onChange={e => setAssignAmount(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6dff8a]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">Stop-Loss Threshold (%)</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={assignStopLoss}
                  onChange={e => setAssignStopLoss(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#6dff8a]"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
              <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignAutoCredit}
                  onChange={e => setAssignAutoCredit(e.target.checked)}
                  className="rounded text-[#6dff8a] focus:ring-0"
                />
                <span>Auto-credit client balance if balance is insufficient</span>
              </label>
              <p className="text-[11px] text-white/40 pl-5">
                If the client doesn't have enough available funds, this will automatically credit the difference via Admin Credit and allocate the copy.
              </p>
            </div>

            <button
              type="submit"
              disabled={assigning}
              className="px-5 py-2.5 rounded-xl bg-[#6dff8a] text-[#15170f] font-bold text-xs flex items-center gap-2 disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>{assigning ? 'Allocating Copy Trade...' : 'Start Copy Trade for Client'}</span>
            </button>
          </form>
        </div>
      )}

      {/* SUBTAB 4: CLOSED COPIES HISTORY */}
      {subTab === 'history' && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-white">Closed Copy Positions History ({closedCopies.length})</h4>

          {closedCopies.length === 0 ? (
            <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02] text-center text-white/50 text-xs">
              No closed copy positions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-white/5 text-white/50 text-left">
                  <tr>
                    <th className="p-3">Client Trader</th>
                    <th className="p-3">Investor</th>
                    <th className="p-3">Allocated</th>
                    <th className="p-3">Final Value</th>
                    <th className="p-3">Realized P&amp;L</th>
                    <th className="p-3">Date Closed</th>
                    <th className="p-3">Status / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {closedCopies.map(c => (
                    <tr key={c.id} className="border-t border-white/5 text-white/80 hover:bg-white/[0.01]">
                      <td className="p-3">
                        <div className="font-semibold text-white">{c.userName || c.userId}</div>
                        <div className="text-white/40 text-[10px]">{c.userEmail || c.userId}</div>
                      </td>
                      <td className="p-3 font-semibold text-white">
                        {c.name}
                        <div className="text-white/40 text-[10px]">{c.handle}</div>
                      </td>
                      <td className="p-3 font-mono">{money(c.allocated)}</td>
                      <td className="p-3 font-mono font-bold text-white">{money(c.currentValue)}</td>
                      <td className={`p-3 font-mono font-bold ${c.profit >= 0 ? 'text-[#6dff8a]' : 'text-red-400'}`}>
                        {c.profit >= 0 ? '+' : ''}{money(c.profit)} ({c.profitPercent}%)
                      </td>
                      <td className="p-3 text-white/50 font-mono text-[11px]">
                        {c.stoppedDate || c.startedDate}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-white/10 text-white/70 text-[10px]">
                          {c.stopReason || 'Closed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
