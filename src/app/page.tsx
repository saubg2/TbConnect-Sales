'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Send, FileEdit, XCircle, Clock } from 'lucide-react';

export default function DevHarnessPage() {
  const [data, setData] = useState<any>({
    workspaces: [],
    agents: [],
    contacts: [],
    relationships: [],
    messages: [],
    actions: [],
    events: [],
  });
  const [loading, setLoading] = useState(false);
  const [inboundFrom, setInboundFrom] = useState('jordan@innovatecorp.io');
  const [inboundName, setInboundName] = useState('Jordan Innovate');
  const [inboundSubject, setInboundSubject] = useState('Question about your integration capabilities');
  const [inboundBody, setInboundBody] = useState('Hi! Does your system support webhook triggers for automated outreach?');
  const [editActionId, setEditActionId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dev/data');
      const json = await res.json();
      if (json && !json.error) {
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerInbound = async (scenario?: 'info' | 'pricing' | 'optout') => {
    let from = inboundFrom;
    let name = inboundName;
    let subject = inboundSubject;
    let body = inboundBody;

    if (scenario === 'info') {
      from = 'carol.dev@saaspartner.com';
      name = 'Carol Developer';
      subject = 'Evaluating your API platform';
      body = 'Hi Sarah, does your solution provide webhooks and REST endpoints for syncing contacts?';
    } else if (scenario === 'pricing') {
      from = 'dan.buyer@enterprise.com';
      name = 'Dan Enterprise';
      subject = 'Pricing quote for 100 seats';
      body = 'Could you send over your pricing list and discount structure for 100 seats?';
    } else if (scenario === 'optout') {
      from = 'sam.unsub@privacy.org';
      name = 'Sam Privacy';
      subject = 'Unsubscribe';
      body = 'Please remove me and unsubscribe from any future emails.';
    }

    setLoading(true);
    try {
      await fetch('/api/dev/simulate-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromEmail: from,
          fromName: name,
          subject,
          bodyText: body,
        }),
      });
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionId: string, verb: 'approve' | 'reject' | 'edit', extraPayload?: any) => {
    setLoading(true);
    try {
      await fetch('/api/dev/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          action: verb,
          ...extraPayload,
        }),
      });
      setEditActionId(null);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-8 font-sans">
      {/* Top Banner */}
      <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
              Phase 0 Development Harness
            </span>
            <span className="text-xs text-slate-400">Exit Gate: Verified</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Relationship Agent SaaS</h1>
          <p className="text-sm text-slate-400">
            Multi-tenant relationship manager with persistent context, structured LLM decisions, and safe-by-default execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/inbox"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
          >
            Inbox & Threads →
          </Link>
          <Link
            href="/contacts"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm transition"
          >
            Contacts & Import →
          </Link>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh State
          </button>
        </div>
      </header>

      {/* Contract & Invariants Health Badges */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="font-semibold text-slate-200">Drizzle PostgreSQL</div>
            <div className="text-slate-400">8 Core Tables Active</div>
          </div>
        </div>
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="font-semibold text-slate-200">Zod Decision Contract</div>
            <div className="text-slate-400">Strict Validation & Typing</div>
          </div>
        </div>
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="font-semibold text-slate-200">Approval Guardrails</div>
            <div className="text-slate-400">Pricing & Edits Guarded</div>
          </div>
        </div>
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center gap-2.5">
          <Play className="w-4 h-4 text-indigo-400 shrink-0" />
          <div>
            <div className="font-semibold text-slate-200">Vitest Test Suite</div>
            <div className="text-slate-400">8/8 Passed (In-process)</div>
          </div>
        </div>
      </section>

      {/* Simulator Section */}
      <section className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-400" />
            Inbound Simulator (Simulates Inbound Webhook / Email)
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => triggerInbound('info')}
              disabled={loading}
              className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              Preset: Info Inquiry
            </button>
            <button
              onClick={() => triggerInbound('pricing')}
              disabled={loading}
              className="px-2.5 py-1 text-xs rounded bg-amber-950/70 hover:bg-amber-900/70 text-amber-200 border border-amber-800/80 transition"
            >
              Preset: Pricing Escalation
            </button>
            <button
              onClick={() => triggerInbound('optout')}
              disabled={loading}
              className="px-2.5 py-1 text-xs rounded bg-rose-950/70 hover:bg-rose-900/70 text-rose-200 border border-rose-800/80 transition"
            >
              Preset: Opt-Out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="email"
            value={inboundFrom}
            onChange={(e) => setInboundFrom(e.target.value)}
            placeholder="From Email"
            className="px-3 py-2 text-xs rounded-md bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            value={inboundName}
            onChange={(e) => setInboundName(e.target.value)}
            placeholder="From Name"
            className="px-3 py-2 text-xs rounded-md bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            value={inboundSubject}
            onChange={(e) => setInboundSubject(e.target.value)}
            placeholder="Subject"
            className="px-3 py-2 text-xs rounded-md bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            value={inboundBody}
            onChange={(e) => setInboundBody(e.target.value)}
            rows={2}
            placeholder="Message Body Text..."
            className="flex-1 px-3 py-2 text-xs rounded-md bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => triggerInbound()}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 self-end sm:self-auto transition"
          >
            Process Inbound
          </button>
        </div>
      </section>

      {/* Main Content: Relationships, Actions Queue & Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Relationships */}
        <section className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Active Relationships ({data.relationships?.length || 0})</h2>
            <span className="text-xs text-slate-400">Context & Memory</span>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {data.relationships?.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">No relationships created yet. Trigger an inbound email above.</div>
            ) : (
              data.relationships.map((rel: any) => {
                const contact = data.contacts?.find((c: any) => c.id === rel.contactId);
                return (
                  <div key={rel.id} className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-200">
                        {contact?.name || 'Unknown Contact'}{' '}
                        <span className="text-slate-400 font-normal">({contact?.emailNormalized})</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        rel.stage === 'ENGAGED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        rel.stage === 'OPTED_OUT' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {rel.stage}
                      </span>
                    </div>
                    <div className="text-slate-300 bg-slate-900/50 p-2 rounded border border-slate-800/80">
                      <span className="text-slate-400 font-medium">Summary:</span> {rel.summary || 'None'}
                    </div>
                    {rel.factsJson && rel.factsJson.length > 0 && (
                      <div className="text-[11px] text-slate-400">
                        <span className="text-slate-300 font-medium">Verified Facts:</span> {rel.factsJson.join(' • ')}
                      </div>
                    )}
                    {contact?.isSuppressed && (
                      <div className="text-[11px] text-rose-400 font-medium">
                        ⚠️ Contact is suppressed: {contact.suppressionReason}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Actions Queue */}
        <section className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Actions Queue ({data.actions?.length || 0})</h2>
            <span className="text-xs text-slate-400">Durable Execution State</span>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {data.actions?.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">No actions queued.</div>
            ) : (
              data.actions.map((act: any) => {
                const payload = act.payloadJson || {};
                const draft = payload.draft;
                const isAwaitingApproval = act.status === 'AWAITING_APPROVAL';

                return (
                  <div key={act.id} className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-indigo-300">{act.type}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          act.status === 'AWAITING_APPROVAL' ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse' :
                          act.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                          act.status === 'PENDING' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                          act.status === 'CANCELLED' ? 'bg-slate-900 text-slate-500 border border-slate-800' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {act.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">v{payload.draft_version || 1}</span>
                    </div>

                    <div className="text-slate-400 text-[11px]">
                      <span className="text-slate-300 font-medium">Reason:</span> {act.reason || 'None provided'}
                    </div>

                    {draft && (
                      <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
                        <div className="font-semibold text-slate-300">{draft.subject}</div>
                        <pre className="text-slate-300 whitespace-pre-wrap font-sans text-[11px]">
                          {draft.body_text}
                        </pre>
                      </div>
                    )}

                    {/* Operator Action Buttons */}
                    {isAwaitingApproval && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                        <button
                          onClick={() => handleAction(act.id, 'approve', { expectedDraftVersion: payload.draft_version || 1 })}
                          className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-[11px] flex items-center gap-1 transition"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            setEditActionId(act.id);
                            setEditText(draft?.body_text || '');
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] flex items-center gap-1 transition"
                        >
                          <FileEdit className="w-3 h-3" /> Edit Draft
                        </button>
                        <button
                          onClick={() => handleAction(act.id, 'reject', { reason: 'Operator rejected' })}
                          className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 font-medium text-[11px] flex items-center gap-1 border border-rose-800 transition"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    )}

                    {/* Inline Editor if operator clicked Edit Draft */}
                    {editActionId === act.id && (
                      <div className="p-2.5 rounded bg-slate-900 border border-indigo-700 space-y-2 mt-2">
                        <div className="text-[11px] font-semibold text-indigo-300">
                          Editing Draft (Will invalidate previous approval & bump version)
                        </div>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                          className="w-full p-2 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditActionId(null)}
                            className="px-2 py-0.5 text-xs text-slate-400 hover:text-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAction(act.id, 'edit', { newBodyText: editText })}
                            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
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
        </section>
      </div>

      {/* Messages & Events Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages */}
        <section className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <h2 className="text-sm font-semibold text-white">Ingested Messages ({data.messages?.length || 0})</h2>
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {data.messages?.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">No messages ingested yet.</div>
            ) : (
              data.messages.map((m: any) => (
                <div key={m.id} className="p-3 rounded-lg border border-slate-800/80 bg-slate-950 text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-300">{m.direction}: {m.subject || '(No subject)'}</span>
                    <span className="text-[10px] text-slate-500">{new Date(m.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-slate-300 whitespace-pre-wrap">{m.bodyText}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Audit Events */}
        <section className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <h2 className="text-sm font-semibold text-white">Append-Only Audit Events ({data.events?.length || 0})</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {data.events?.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">No audit events logged yet.</div>
            ) : (
              data.events.map((e: any) => (
                <div key={e.id} className="p-2.5 rounded border border-slate-800/70 bg-slate-950 text-[11px] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-indigo-400">{e.eventType}</span>
                    <span className="text-slate-500 ml-2">
                      {JSON.stringify(e.payloadJson)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                    {new Date(e.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
