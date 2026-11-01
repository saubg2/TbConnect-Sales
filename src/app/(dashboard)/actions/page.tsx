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
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-900 transition">
            ← Home
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/contacts" className="text-xs text-slate-500 hover:text-slate-900 transition">
            Contacts
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/agents" className="text-xs text-slate-500 hover:text-slate-900 transition">
            Agents
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/inbox" className="text-xs text-slate-500 hover:text-slate-900 transition">
            Inbox
          </Link>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-indigo-600" />
            <h1 className="text-base font-bold text-slate-900">Actions</h1>
          </div>
          <span className="text-slate-300">|</span>
          <Link href="/settings" className="text-xs text-slate-500 hover:text-slate-900 transition">
            Settings
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Emergency Stop Button */}
          <button
            onClick={toggleEmergencyStop}
            disabled={emergencyLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition border shadow-sm ${
              emergencyActive
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 animate-pulse'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            {emergencyActive ? 'Resume Workspace Sends' : 'Emergency Stop'}
          </button>

          {/* Trigger Worker Button */}
          <button
            onClick={runWorkerCycle}
            disabled={workerLoading || emergencyActive}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${workerLoading ? 'animate-spin' : ''}`} />
            Run Queue Worker
          </button>

          <button
            onClick={fetchActions}
            disabled={loading}
            className="p-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Emergency Stop Alert Banner */}
        {emergencyActive && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-between text-xs text-rose-800 shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <div className="font-bold text-rose-900 uppercase tracking-wide">
                  Emergency Stop Active — All Outbound Sends Blocked
                </div>
                <div className="text-rose-700">
                  Worker execution and queued dispatches are paused across the entire workspace.
                </div>
              </div>
            </div>
            <button
              onClick={toggleEmergencyStop}
              className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm transition"
            >
              Resume Sending
            </button>
          </div>
        )}

        {/* Worker Execution Summary Result */}
        {workerResult && (
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-indigo-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Queue Worker Cycle Completed
            </div>
            <div className="flex items-center gap-4 text-slate-600 text-[11px]">
              <span>Claimed: <strong className="text-slate-900">{workerResult.claimedCount}</strong></span>
              <span>Completed: <strong className="text-emerald-700">{workerResult.completedCount}</strong></span>
              <span>Retried: <strong className="text-amber-700">{workerResult.retriedCount}</strong></span>
              <span>Cancelled: <strong className="text-slate-700">{workerResult.cancelledCount}</strong></span>
              <span>Failed: <strong className="text-rose-700">{workerResult.failedCount}</strong></span>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm text-xs overflow-x-auto">
          {['all', 'AWAITING_APPROVAL', 'PENDING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg transition capitalize font-medium ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {st === 'AWAITING_APPROVAL' ? 'Awaiting Approval' : st.toLowerCase()}
            </button>
          ))}
        </div>

        {/* Actions Cards Stream */}
        <div className="space-y-4">
          {actionsList.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
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
                  className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{action.type}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        action.status === 'AWAITING_APPROVAL' ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse' :
                        action.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        action.status === 'COMPLETED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        action.status === 'FAILED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {action.status}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        Attempts: {action.attemptCount} • Draft v{payload.draft_version || 1}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      {action.scheduledAt && (
                        <span className="flex items-center gap-1 font-medium text-indigo-600">
                          <Clock className="w-3 h-3" />
                          Due: {new Date(action.scheduledAt).toLocaleTimeString()}
                        </span>
                      )}
                      <span>ID: {action.id.substring(0, 8)}...</span>
                    </div>
                  </div>

                  {action.reason && (
                    <div className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-slate-400 font-medium">Reason:</span> {action.reason}
                    </div>
                  )}

                  {action.lastError && (
                    <div className="text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 font-medium">
                      Last Error: {action.lastError}
                    </div>
                  )}

                  {/* Proposed Draft */}
                  {draft && (
                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="font-semibold text-slate-900">{draft.subject}</div>
                      <pre className="text-slate-700 whitespace-pre-wrap font-sans leading-relaxed text-[11px]">
                        {draft.body_text}
                      </pre>
                    </div>
                  )}

                  {/* Actions Bar */}
                  {isAwaiting && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleAction(action.id, 'approve', { expectedDraftVersion: payload.draft_version || 1 })}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1 shadow-sm transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Enqueue
                      </button>
                      <button
                        onClick={() => {
                          setEditActionId(action.id);
                          setEditText(draft?.body_text || '');
                        }}
                        className="px-3 py-1.5 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs flex items-center gap-1 transition"
                      >
                        <FileEdit className="w-3.5 h-3.5" /> Edit Draft
                      </button>
                      <button
                        onClick={() => handleAction(action.id, 'reject', { reason: 'Operator rejected' })}
                        className="px-3 py-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs flex items-center gap-1 border border-rose-200 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}

                  {/* Inline Editor */}
                  {editActionId === action.id && (
                    <div className="p-3.5 rounded-lg bg-white border border-indigo-300 space-y-2 mt-2 shadow-sm">
                      <div className="text-[11px] font-semibold text-indigo-700">
                        Editing Draft (Resets to AWAITING_APPROVAL with incremented draft version)
                      </div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditActionId(null)}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAction(action.id, 'edit', { newBodyText: editText })}
                          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
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
