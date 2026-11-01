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
      setEmergencyActive(!!emData.emergencyStopActive);
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

  const handleAction = async (actionId: string, verb: 'approve' | 'reject' | 'edit', extraPayload?: any) => {
    try {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_default',
          actionId,
          action: verb,
          ...extraPayload,
        }),
      });
      setEditActionId(null);
      await fetchActions();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-200 transition">
            ← Dev Harness
          </Link>
          <span className="text-slate-700">|</span>
          <Link href="/contacts" className="text-xs text-slate-400 hover:text-slate-200 transition">
            Contacts
          </Link>
          <span className="text-slate-700">|</span>
          <Link href="/inbox" className="text-xs text-slate-400 hover:text-slate-200 transition">
            Inbox
          </Link>
          <span className="text-slate-700">|</span>
          <Link href="/settings" className="text-xs text-slate-400 hover:text-slate-200 transition">
            Settings
          </Link>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-indigo-400" />
            <h1 className="text-base font-bold text-white">Durable Actions & Approvals</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Emergency Stop Button */}
          <button
            onClick={toggleEmergencyStop}
            disabled={emergencyLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition border ${
              emergencyActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 animate-pulse'
                : 'bg-rose-950/70 hover:bg-rose-900/70 text-rose-300 border-rose-800'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            {emergencyActive ? 'Resume Workspace Sends' : 'Emergency Stop'}
          </button>

          {/* Trigger Worker Button */}
          <button
            onClick={runWorkerCycle}
            disabled={workerLoading || emergencyActive}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${workerLoading ? 'animate-spin' : ''}`} />
            Run Queue Worker
          </button>

          <button
            onClick={fetchActions}
            disabled={loading}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Emergency Stop Alert Banner */}
        {emergencyActive && (
          <div className="p-4 rounded-xl border border-rose-800 bg-rose-950/70 flex items-center justify-between text-xs text-rose-200 shadow-lg animate-pulse">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <div className="font-bold text-rose-100 uppercase tracking-wide">
                  Emergency Stop Active — All Outbound Sends Blocked
                </div>
                <div className="text-rose-300">
                  Worker execution and queued dispatches are paused across the entire workspace.
                </div>
              </div>
            </div>
            <button
              onClick={toggleEmergencyStop}
              className="px-3 py-1.5 rounded bg-rose-800 hover:bg-rose-700 text-white font-semibold transition"
            >
              Resume Sending
            </button>
          </div>
        )}

        {/* Worker Execution Summary Result */}
        {workerResult && (
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Queue Worker Cycle Completed
            </div>
            <div className="flex items-center gap-4 text-slate-300 text-[11px]">
              <span>Claimed: <strong className="text-white">{workerResult.claimedCount}</strong></span>
              <span>Completed: <strong className="text-emerald-400">{workerResult.completedCount}</strong></span>
              <span>Retried (Backoff): <strong className="text-amber-400">{workerResult.retriedCount}</strong></span>
              <span>Cancelled/Suppressed: <strong className="text-slate-400">{workerResult.cancelledCount}</strong></span>
              <span>Failed: <strong className="text-rose-400">{workerResult.failedCount}</strong></span>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
          {['all', 'AWAITING_APPROVAL', 'PENDING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded transition capitalize font-medium ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st === 'AWAITING_APPROVAL' ? 'Awaiting Approval' : st.toLowerCase()}
            </button>
          ))}
        </div>

        {/* Actions Cards Stream */}
        <div className="space-y-4">
          {actionsList.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800">
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
                  className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{action.type}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        action.status === 'AWAITING_APPROVAL' ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse' :
                        action.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        action.status === 'COMPLETED' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                        action.status === 'FAILED' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {action.status}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        Attempts: {action.attemptCount} • Draft v{payload.draft_version || 1}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      {action.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-400" />
                          Due: {new Date(action.scheduledAt).toLocaleTimeString()}
                        </span>
                      )}
                      <span>ID: {action.id.substring(0, 8)}...</span>
                    </div>
                  </div>

                  {action.reason && (
                    <div className="text-slate-300 bg-slate-950/60 p-2.5 rounded border border-slate-800/80">
                      <span className="text-slate-400 font-medium">Reason:</span> {action.reason}
                    </div>
                  )}

                  {action.lastError && (
                    <div className="text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-900/50">
                      Last Error: {action.lastError}
                    </div>
                  )}

                  {/* Proposed Draft */}
                  {draft && (
                    <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                      <div className="font-semibold text-slate-300">{draft.subject}</div>
                      <pre className="text-slate-300 whitespace-pre-wrap font-sans leading-relaxed text-[11px]">
                        {draft.body_text}
                      </pre>
                    </div>
                  )}

                  {/* Actions Bar */}
                  {isAwaiting && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => handleAction(action.id, 'approve', { expectedDraftVersion: payload.draft_version || 1 })}
                        className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs flex items-center gap-1 transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Enqueue
                      </button>
                      <button
                        onClick={() => {
                          setEditActionId(action.id);
                          setEditText(draft?.body_text || '');
                        }}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1 transition"
                      >
                        <FileEdit className="w-3.5 h-3.5" /> Edit Draft
                      </button>
                      <button
                        onClick={() => handleAction(action.id, 'reject', { reason: 'Operator rejected' })}
                        className="px-3 py-1.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 font-medium text-xs flex items-center gap-1 border border-rose-800 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}

                  {/* Inline Editor */}
                  {editActionId === action.id && (
                    <div className="p-3.5 rounded-lg bg-slate-900 border border-indigo-700 space-y-2 mt-2">
                      <div className="text-[11px] font-semibold text-indigo-300">
                        Editing Draft (Resets to AWAITING_APPROVAL with incremented draft version)
                      </div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="w-full p-2.5 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditActionId(null)}
                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAction(action.id, 'edit', { newBodyText: editText })}
                          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
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
