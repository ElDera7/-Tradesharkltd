import React, { useEffect, useState } from 'react';
import { Database, Download, Upload, GitBranch, RefreshCw, CheckCircle2, AlertTriangle, HardDrive, FileJson } from 'lucide-react';
import { api, errMsg } from '../../lib/api';

export const AdminDatabaseBackupPanel: React.FC<{ onNotify: (msg: string) => void }> = ({ onNotify }) => {
  const [stats, setStats] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadStats = async () => {
    try {
      const data = await api.get('/api/admin/database/status');
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 15000);
    return () => clearInterval(t);
  }, []);

  const handleSyncGit = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/api/admin/database/sync-git', {});
      onNotify(res.message || 'Database snapshot written to db-backup.json in Git repo!');
      loadStats();
    } catch (e) {
      onNotify(errMsg(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadBackup = () => {
    window.open('/api/admin/database/backup', '_blank');
  };

  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(`Restore database from "${file.name}"? This will update collections in the active database.`)) {
      e.target.value = '';
      return;
    }
    setRestoring(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await api.post('/api/admin/database/restore', json);
      onNotify(`Database successfully restored! Loaded ${res.count} documents.`);
      loadStats();
    } catch (err: any) {
      onNotify(`Restore failed: ${errMsg(err)}`);
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-[#6dff8a]" />
          <div>
            <h4 className="text-sm font-bold text-white">Database Storage &amp; Git Repository Backup</h4>
            <p className="text-xs text-white/50">Auto-deployment synchronization for Railway MySQL, Postgres, and Git repository files</p>
          </div>
        </div>

        {stats && (
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold font-mono uppercase bg-[#6dff8a]/20 text-[#6dff8a] border border-[#6dff8a]/30">
              Engine: {stats.mode === 'mysql' ? 'Railway MySQL' : stats.mode === 'postgres' ? 'Railway Postgres' : 'Persistent File'}
            </span>
          </div>
        )}
      </div>

      {/* STORAGE & GIT SYNC METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
          <div className="text-[10px] text-white/50 font-medium flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[#6dff8a]" />
            <span>Active Database Engine</span>
          </div>
          <div className="text-sm font-bold text-white capitalize">
            {stats ? (stats.mode === 'mysql' ? 'MySQL (Railway Cloud)' : stats.mode === 'postgres' ? 'PostgreSQL' : 'JSON Document Store') : 'Detecting...'}
          </div>
          <div className="text-[10px] text-white/40">
            {stats?.totalDocuments ?? 0} total records active in memory
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
          <div className="text-[10px] text-white/50 font-medium flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            <span>Git Backup File Status</span>
          </div>
          <div className="text-sm font-bold text-white flex items-center gap-1.5">
            {stats?.gitBackup?.exists ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#6dff8a]" />
                <span>db-backup.json Synced</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span>Pending initial sync</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-white/40">
            {stats?.gitBackup?.size ? `${(stats.gitBackup.size / 1024).toFixed(1)} KB` : '0 KB'}
            {stats?.gitBackup?.updatedAt && ` · ${new Date(stats.gitBackup.updatedAt).toLocaleTimeString()}`}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
          <div className="text-[10px] text-white/50 font-medium flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            <span>Auto-Deployment Persistence</span>
          </div>
          <div className="text-xs text-white/80">
            Committing <b>db-backup.json</b> to your Git repo ensures your complete database automatically restores on fresh Railway deployments.
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={handleSyncGit}
          disabled={syncing}
          className="px-3.5 py-2 rounded-xl bg-[#6dff8a] text-[#15170f] font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 hover:bg-[#5ce077] transition-colors"
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>{syncing ? 'Saving to Git File...' : 'Sync Database to Git File (db-backup.json)'}</span>
        </button>

        <button
          onClick={handleDownloadBackup}
          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export &amp; Download Backup (.json)</span>
        </button>

        <label className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors">
          <Upload className="w-3.5 h-3.5" />
          <span>{restoring ? 'Restoring Snapshot...' : 'Restore from JSON File'}</span>
          <input
            type="file"
            accept=".json"
            disabled={restoring}
            onChange={handleFileRestore}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
};
