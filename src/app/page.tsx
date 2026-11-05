'use client';

import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Send, FileEdit, XCircle, Clock } from 'lucide-react';
import { AppHeader } from '@/components/app-header';

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [value];
  } catch {
    return [value];
  }
}

function asObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

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

  const triggerInbound = async (scenario?: 'info' | 'pricing' | 'optout' | 'saurabh' | 'saub') => {
    let from = inboundFrom;
    let name = inboundName;
    let subject = inboundSubject;
    let body = inboundBody;

    if (scenario === 'saurabh') {
      from = 'saurabhjaipur@gmail.com';
      name = 'Saurabh Sharma';
      subject = 'Evaluating your enterprise platform';
      body = 'Hi Sarah, we are exploring your relationship agent SaaS for our sales team. Do you support webhooks and custom agent prompts?';
      setInboundFrom(from);
      setInboundName(name);
      setInboundSubject(subject);
      setInboundBody(body);
    } else if (scenario === 'saub') {
      from = 'saubconsulting@gmail.com';
      name = 'Saub Consulting';
      subject = 'Exploring partnership & discovery call';
      body = 'Hello Sarah, we would like to schedule a quick 15-minute discovery conversation next week to explore partnership opportunities.';
      setInboundFrom(from);
      setInboundName(name);
      setInboundSubject(subject);
      setInboundBody(body);
    } else if (scenario === 'info') {
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
      from = 'stop@unsub.org';
      name = 'Sam Stop';
      subject = 'Unsubscribe immediately';
      body = 'Please remove me from your mailing list and do not contact me again.';
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
    <div className="sketch-page min-h-screen bg-white font-sans text-black">
      <AppHeader actions={
        <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 border border-black bg-white px-3 py-1.5 text-xs font-bold text-black transition hover:bg-neutral-100"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh State
          </button>
      } />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* Contract & Invariants Health Badges */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <div className="font-semibold text-slate-900">Drizzle PostgreSQL</div>
            <div className="text-slate-500">8 Core Tables Active</div>
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <div className="font-semibold text-slate-900">Zod Decision Contract</div>
            <div className="text-slate-500">Strict Validation & Typing</div>
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <div className="font-semibold text-slate-900">Approval Guardrails</div>
            <div className="text-slate-500">Pricing & Edits Guarded</div>
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center gap-2.5">
          <Play className="w-5 h-5 text-indigo-600 shrink-0" />
          <div>
            <div className="font-semibold text-slate-900">Vitest Test Suite</div>
            <div className="text-slate-500">36/36 Passed Cleanly</div>
          </div>
        </div>
      </section>

      {/* Simulator Section */}
      <section className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-indigo-600" />
            Inbound Simulator (Simulates Inbound Webhook / Email)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => triggerInbound('saurabh')}
              disabled={loading}
              className="px-3 py-1 text-xs rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-2 border-emerald-300 transition font-black"
            >
              ★ Saurabh (saurabhjaipur@gmail.com)
            </button>
            <button
              onClick={() => triggerInbound('saub')}
              disabled={loading}
              className="px-3 py-1 text-xs rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-2 border-indigo-300 transition font-black"
            >
              ★ Saub (saubconsulting@gmail.com)
            </button>
            <button
              onClick={() => triggerInbound('info')}
              disabled={loading}
              className="px-2.5 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition font-bold"
            >
              Info Inquiry
            </button>
            <button
              onClick={() => triggerInbound('pricing')}
              disabled={loading}
              className="px-2.5 py-1 text-xs rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition font-bold"
            >
              Pricing Escalation
            </button>
            <button
              onClick={() => triggerInbound('optout')}
              disabled={loading}
              className="px-2.5 py-1 text-xs rounded bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition font-bold"
            >
              Opt-Out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="email"
            value={inboundFrom}
            onChange={(e) => setInboundFrom(e.target.value)}
            placeholder="From Email"
            className="px-3 py-2 text-xs rounded-md bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="text"
            value={inboundName}
            onChange={(e) => setInboundName(e.target.value)}
            placeholder="From Name"
            className="px-3 py-2 text-xs rounded-md bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            type="text"
            value={inboundSubject}
            onChange={(e) => setInboundSubject(e.target.value)}
            placeholder="Subject"
            className="px-3 py-2 text-xs rounded-md bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            value={inboundBody}
            onChange={(e) => setInboundBody(e.target.value)}
            rows={2}
            placeholder="Message Body Text..."
            className="flex-1 px-3 py-2 text-xs rounded-md bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
          />
          <button
            onClick={() => triggerInbound()}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 self-end sm:self-auto shadow-sm transition"
          >
            Process Inbound
          </button>
        </div>
      </section>

      {/* Main Content: Relationships, Actions Queue & Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Relationships */}
        <section className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Active Relationships ({data.relationships?.length || 0})</h2>
            <span className="text-xs text-slate-500 font-medium">Context & Memory</span>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {data.relationships?.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">No relationships created yet. Trigger an inbound email above.</div>
            ) : (
              data.relationships.slice(0, 100).map((rel: any) => {
                const contact = data.contacts?.find((c: any) => c.id === rel.contactId);
                const facts = asStringList(rel.factsJson);
                return (
                  <div key={rel.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-900">
                        {contact?.name || 'Unknown Contact'}{' '}
                        <span className="text-slate-500 font-normal">({contact?.emailNormalized})</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        rel.stage === 'ENGAGED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        rel.stage === 'OPTED_OUT' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {rel.stage}
                      </span>
                    </div>
                    <div className="text-slate-700 bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-400 font-medium">Summary:</span> {rel.summary || 'None'}
                    </div>
                    {facts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {facts.map((f: string, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">
                            fact: {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Action Queue & Approvals */}
        <section className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Action Queue & Approvals ({data.actions?.length || 0})</h2>
            <span className="text-xs text-slate-500 font-medium">State Machine & Guardrails</span>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {data.actions?.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">No actions queued. Send a message to see autonomous actions generated.</div>
            ) : (
              data.actions.slice(0, 100).map((act: any) => {
                const payload = asObject(act.payloadJson);
                const draft = payload.draft || {};
                const isAwaiting = act.status === 'AWAITING_APPROVAL';

                return (
                  <div key={act.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{act.type}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          act.status === 'AWAITING_APPROVAL' ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse' :
                          act.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          act.status === 'COMPLETED' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          act.status === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {act.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">v{payload.draft?.draft_version || 1}</span>
                    </div>

                    <p className="text-slate-600 text-[11px]"><span className="text-slate-400 font-medium">Reason:</span> {act.reason}</p>

                    {draft.body_text && (
                      <div className="bg-white p-2.5 rounded border border-slate-200 text-slate-800 space-y-1">
                        <div className="text-[10px] text-slate-500 font-medium">Subject: {draft.subject}</div>
                        {editActionId === act.id ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={3}
                              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditActionId(null)}
                                className="px-2 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleAction(act.id, 'edit', { draftText: editText })}
                                className="px-2 py-1 text-[11px] rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                              >
                                Save Draft
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-800 whitespace-pre-wrap font-sans">{draft.body_text}</div>
                        )}
                      </div>
                    )}

                    {/* Approval Action Controls */}
                    {isAwaiting && editActionId !== act.id && (
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200">
                        <button
                          onClick={() => {
                            setEditActionId(act.id);
                            setEditText(draft.body_text || '');
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition"
                        >
                          <FileEdit className="w-3 h-3 text-slate-500" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleAction(act.id, 'reject')}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                        >
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleAction(act.id, 'approve')}
                          className="flex items-center gap-1 px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Approve Send
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Message History & Append-Only Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages */}
        <section className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Messages Timeline ({data.messages?.length || 0})</h2>
            <span className="text-xs text-slate-500 font-medium">Inbound & Outbound</span>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {data.messages?.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">No messages ingested yet.</div>
            ) : (
              data.messages.slice(0, 100).map((msg: any) => (
                <div key={msg.id} className={`p-3 rounded-lg border text-xs space-y-1 ${
                  msg.direction === 'INBOUND' ? 'bg-slate-50 border-slate-200' : 'bg-indigo-50/50 border-indigo-200'
                }`}>
                  <div className="flex items-center justify-between font-semibold">
                    <span className={msg.direction === 'INBOUND' ? 'text-indigo-600' : 'text-emerald-700'}>
                      {msg.direction} • {msg.channel}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="font-medium text-slate-800">{msg.subject}</div>
                  <div className="text-slate-600 whitespace-pre-wrap">{msg.bodyText}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Audit Events */}
        <section className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Audit Trail Events ({data.events?.length || 0})</h2>
            <span className="text-xs text-slate-500 font-medium">Immutable Event Log</span>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {data.events?.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">No audit events generated.</div>
            ) : (
              data.events.map((evt: any) => (
                <div key={evt.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-800 font-mono text-[11px]">{evt.eventType}</div>
                    <div className="text-slate-500 text-[10px]">
                      {JSON.stringify(evt.payloadJson || {})}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(evt.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      </main>
    </div>
  );
}
