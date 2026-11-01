'use client';

import React, { useState, useEffect } from 'react';
import {
  ListChecks,
  AlertOctagon,
  Play,
  CheckCircle2,
  FileEdit,
  XCircle,
  RefreshCw,
  Clock,
  ShieldAlert,
  Send,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

export default function ActionsPage() {
  const [actionsList, setActionsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [emergencyActive, setEmergencyActive] = useState<boolean>(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerResult, setWorkerResult] = useState<any>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramNotice, setTelegramNotice] = useState<string | null>(null);

  // Edit draft state
  const [editActionId, setEditActionId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const fetchActions = async () => {
    setLoading(true);
    try {
      let url = `/api/actions?workspaceId=ws_default`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.actions) {
        setActionsList(data.actions);
      }

      // Check emergency stop
      const emRes = await fetch(`/api/workspace/emergency-stop?workspaceId=ws_default`);
      const emData = await emRes.json();
      if (emData && typeof emData.emergencyStopActive === 'boolean') {
        setEmergencyActive(emData.emergencyStopActive);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, [statusFilter]);

  const toggleEmergencyStop = async () => {
    setEmergencyLoading(true);
    try {
      await fetch('/api/workspace/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_default',
          enabled: !emergencyActive,
          reason: !emergencyActive ? 'Manual emergency stop triggered from Actions Dashboard' : 'Resumed by operator',
        }),
      });
      await fetchActions();
    } catch (e) {
      console.error(e);
    } finally {
      setEmergencyLoading(false);
    }
  };

  const runWorkerCycle = async () => {
    setWorkerLoading(true);
    setWorkerResult(null);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_default',
          action: 'run_worker',
        }),
      });
      const data = await res.json();
      if (data.summary) {
        setWorkerResult(data.summary);
      }
      await fetchActions();
    } catch (e) {
      console.error(e);
    } finally {
      setWorkerLoading(false);
    }
  };

  const notifyTelegram = async () => {
    setTelegramLoading(true);
    setTelegramNotice(null);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_default',
          action: 'notify_telegram',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTelegramNotice(`✅ Sent ${data.sentCount} approval cards to Telegram!`);
      } else {
        setTelegramNotice(`⚠️ ${data.error || 'Failed to notify'}`);
      }
    } catch (e: any) {
      setTelegramNotice(`⚠️ ${e.message}`);
    } finally {
      setTelegramLoading(false);
      setTimeout(() => setTelegramNotice(null), 6000);
    }
  };

  const handleAction = async (actionId: string, actionType: 'approve' | 'reject' | 'edit', extra: any = {}) => {
    try {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_default',
          action: actionType,
          actionId,
          ...extra,
        }),
      });
      setEditActionId(null);
      await fetchActions();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b-2 border-slate-200 bg-white sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition">
            ← Home
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/contacts" className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition">
            Contacts
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/agents" className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition">
            Agents
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/inbox" className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition">
            Inbox
          </Link>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-indigo-600" />
            <h1 className="text-base font-black text-slate-900">Actions</h1>
          </div>
          <span className="text-slate-300">|</span>
          <Link href="/settings" className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition">
            Settings
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Emergency Stop Button */}
          <button
            onClick={toggleEmergencyStop}
            disabled={emergencyLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition border-2 shadow-sm ${
              emergencyActive
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 animate-pulse'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            {emergencyActive ? 'Resume Workspace Sends' : 'Emergency Stop'}
          </button>

          {/* Push to Telegram Button */}
          <button
            onClick={notifyTelegram}
            disabled={telegramLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold shadow-sm transition border-2 border-sky-700 disabled:opacity-50"
          >
            <Send className={`w-4 h-4 ${telegramLoading ? 'animate-spin' : ''}`} />
            {telegramLoading ? 'Sending...' : 'Send to Telegram'}
          </button>

          {/* Trigger Worker Button */}
          <button
            onClick={runWorkerCycle}
            disabled={workerLoading || emergencyActive}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition disabled:opacity-50 border-2 border-indigo-700"
          >
            <Play className={`w-4 h-4 ${workerLoading ? 'animate-spin' : ''}`} />
            Run Queue Worker
          </button>

          <button
            onClick={fetchActions}
            disabled={loading}
            className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 shadow-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {telegramNotice && (
          <div className="p-4 rounded-xl border-2 border-sky-400 bg-sky-50 text-sky-950 font-bold text-sm shadow-sm">
            {telegramNotice}
          </div>
        )}
        {/* Emergency Stop Alert Banner */}
        {emergencyActive && (
          <div className="p-4 rounded-xl border-2 border-rose-400 bg-rose-50 flex items-center justify-between text-sm text-rose-950 shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0" />
              <div>
                <div className="font-black text-rose-950 uppercase tracking-wide">
                  Emergency Stop Active — All Outbound Sends Blocked
                </div>
                <div className="text-rose-800 font-medium">
                  Worker execution and queued dispatches are paused across the entire workspace.
                </div>
              </div>
            </div>
            <button
              onClick={toggleEmergencyStop}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold shadow transition"
            >
              Resume Sending
            </button>
          </div>
        )}

        {/* Worker Execution Summary Result */}
        {workerResult && (
          <div className="p-4 rounded-xl border-2 border-indigo-300 bg-white shadow-sm flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-indigo-900 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Queue Worker Cycle Completed
            </div>
            <div className="flex items-center gap-5 text-slate-700 text-xs font-semibold">
              <span>Claimed: <strong className="text-slate-900">{workerResult.claimedCount}</strong></span>
              <span>Completed: <strong className="text-emerald-700">{workerResult.completedCount}</strong></span>
              <span>Retried: <strong className="text-amber-700">{workerResult.retriedCount}</strong></span>
              <span>Cancelled: <strong className="text-slate-700">{workerResult.cancelledCount}</strong></span>
              <span>Failed: <strong className="text-rose-700">{workerResult.failedCount}</strong></span>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border-2 border-slate-300 shadow-sm text-sm overflow-x-auto">
          {['all', 'AWAITING_APPROVAL', 'PENDING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-lg transition capitalize font-bold text-xs ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {st === 'AWAITING_APPROVAL' ? 'Awaiting Approval' : st.toLowerCase()}
            </button>
          ))}
        </div>

        {/* Actions Cards Stream */}
        <div className="space-y-4">
          {actionsList.length === 0 ? (
            <div className="p-12 text-center text-sm font-medium text-slate-500 bg-white rounded-xl border-2 border-slate-300 shadow-sm">
              No actions found in this view.
            </div>
          ) : (
            actionsList.map((action) => {
              const payload = action.payloadJson || {};
              const draft = payload.draft;
              const isAwaiting = action.status === 'AWAITING_APPROVAL';

              return (
                <div
                  key={action.id}
                  className="p-5 rounded-xl border-2 border-slate-300 bg-white shadow-sm space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-black text-slate-900 text-base">{action.type}</span>
                      <span className={`px-2.5 py-1 rounded text-xs font-black uppercase tracking-wide ${
                        action.status === 'AWAITING_APPROVAL' ? 'bg-amber-100 text-amber-900 border-2 border-amber-300 animate-pulse' :
                        action.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                        action.status === 'COMPLETED' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                        action.status === 'FAILED' ? 'bg-rose-100 text-rose-900 border border-rose-300' :
                        'bg-slate-200 text-slate-800'
                      }`}>
                        {action.status}
                      </span>
                      <span className="text-slate-600 text-xs font-semibold">
                        Attempts: {action.attemptCount} • Draft v{payload.draft_version || 1}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 font-semibold flex items-center gap-3">
                      {action.scheduledAt && (
                        <span className="flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          <Clock className="w-3.5 h-3.5" />
                          Due: {new Date(action.scheduledAt).toLocaleTimeString()}
                        </span>
                      )}
                      <span className="font-mono text-slate-500">ID: {action.id.substring(0, 8)}...</span>
                    </div>
                  </div>

                  {action.reason && (
                    <div className="text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-300 text-xs leading-relaxed">
                      <strong className="text-slate-900 font-bold">Reason:</strong> {action.reason}
                    </div>
                  )}

                  {action.lastError && (
                    <div className="text-rose-900 bg-rose-50 p-3 rounded-lg border-2 border-rose-300 font-bold text-xs">
                      Last Error: {action.lastError}
                    </div>
                  )}

                  {/* Proposed Draft */}
                  {draft && (
                    <div className="p-4 rounded-lg bg-slate-50 border-2 border-slate-300 space-y-2">
                      <div className="font-bold text-slate-900 text-sm">{draft.subject}</div>
                      <pre className="text-slate-800 whitespace-pre-wrap font-sans leading-relaxed text-xs">
                        {draft.body_text}
                      </pre>
                    </div>
                  )}

                  {/* Actions Bar */}
                  {isAwaiting && (
                    <div className="flex items-center gap-3 pt-3 border-t-2 border-slate-100">
                      <button
                        onClick={() => handleAction(action.id, 'approve', { expectedDraftVersion: payload.draft_version || 1 })}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow transition"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve & Enqueue
                      </button>
                      <button
                        onClick={() => {
                          setEditActionId(action.id);
                          setEditText(draft?.body_text || '');
                        }}
                        className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <FileEdit className="w-4 h-4" /> Edit Draft
                      </button>
                      <button
                        onClick={() => handleAction(action.id, 'reject', { reason: 'Operator rejected' })}
                        className="px-4 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-xs flex items-center gap-1.5 border border-rose-300 transition"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  )}

                  {/* Inline Editor */}
                  {editActionId === action.id && (
                    <div className="p-4 rounded-lg bg-white border-2 border-indigo-400 space-y-3 mt-2 shadow">
                      <div className="text-xs font-bold text-indigo-900">
                        Editing Draft (Resets to AWAITING_APPROVAL with incremented draft version)
                      </div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={4}
                        className="w-full p-3 text-xs bg-slate-50 border-2 border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditActionId(null)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAction(action.id, 'edit', { newBodyText: editText })}
                          className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow"
                        >
                          Save Draft
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
