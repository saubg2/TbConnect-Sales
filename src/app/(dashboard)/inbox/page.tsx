'use client';

import React, { useState, useEffect } from 'react';
import {
  Inbox,
  User,
  Bot,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileEdit,
  Clock,
  PlayCircle,
  PauseCircle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

export default function InboxPage() {
  const [relationships, setRelationships] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [manualTakeoverMap, setManualTakeoverMap] = useState<Record<string, boolean>>({});
  const [manualText, setManualText] = useState('');
  const [editActionId, setEditActionId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const fetchInboxData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dev/data');
      const data = await res.json();
      if (data && !data.error) {
        setRelationships(data.relationships || []);
        setContacts(data.contacts || []);
        setMessages(data.messages || []);
        setActions(data.actions || []);

        if (!selectedRelationshipId && data.relationships && data.relationships.length > 0) {
          setSelectedRelationshipId(data.relationships[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInboxData();
  }, []);

  const selectedRel = relationships.find((r) => r.id === selectedRelationshipId);
  const selectedContact = selectedRel ? contacts.find((c) => c.id === selectedRel.contactId) : null;
  const relMessages = selectedRelationshipId
    ? messages
        .filter((m) => m.relationshipId === selectedRelationshipId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

  const isTakeover = selectedRelationshipId ? !!manualTakeoverMap[selectedRelationshipId] : false;

  const toggleTakeover = (relId: string) => {
    setManualTakeoverMap((prev) => ({
      ...prev,
      [relId]: !prev[relId],
    }));
  };

  const currentAction = actions.find(
    (a) => a.relationshipId === selectedRelationshipId && (a.status === 'AWAITING_APPROVAL' || a.status === 'WAITING' || a.status === 'PENDING')
  );

  const handleAction = async (actionId: string, verb: 'approve' | 'reject' | 'edit', extraPayload?: any) => {
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
      await fetchInboxData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendManual = async () => {
    if (!manualText.trim() || !selectedRel) return;
    try {
      await fetch('/api/dev/simulate-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: selectedRel.workspaceId,
          fromEmail: selectedContact?.emailNormalized,
          fromName: selectedContact?.name,
          subject: 'Manual Operator Response',
          bodyText: manualText,
        }),
      });
      setManualText('');
      await fetchInboxData();
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
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-indigo-600" />
            <h1 className="text-base font-bold text-slate-900">Inbox</h1>
          </div>
          <span className="text-slate-300">|</span>
          <Link href="/actions" className="text-xs text-slate-500 hover:text-slate-900 transition">
            Actions
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/settings" className="text-xs text-slate-500 hover:text-slate-900 transition">
            Settings
          </Link>
        </div>

        <button
          onClick={fetchInboxData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 shadow-sm transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {/* Inbox Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Thread List */}
        <aside className="w-80 border-r border-slate-200 bg-white flex flex-col shadow-sm">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Conversations ({relationships.length})
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {relationships.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No active conversations yet.
              </div>
            ) : (
              relationships.map((rel) => {
                const contact = contacts.find((c) => c.id === rel.contactId);
                const isSelected = rel.id === selectedRelationshipId;
                const hasTakeover = !!manualTakeoverMap[rel.id];
                const relAction = actions.find(
                  (a) => a.relationshipId === rel.id && a.status === 'AWAITING_APPROVAL'
                );

                return (
                  <div
                    key={rel.id}
                    onClick={() => setSelectedRelationshipId(rel.id)}
                    className={`p-3.5 cursor-pointer transition flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-50/80 border-l-2 border-indigo-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-900 truncate">
                        {contact?.name || 'Contact'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${
                        rel.stage === 'ENGAGED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        rel.stage === 'OPTED_OUT' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {rel.stage}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 truncate">
                      {contact?.emailNormalized}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-0.5">
                      {hasTakeover && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                          Takeover
                        </span>
                      )}
                      {relAction && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold animate-pulse">
                          Approval Due
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Active Conversation Pane */}
        {selectedRel && selectedContact ? (
          <main className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
            {/* Thread Header */}
            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">{selectedContact.name}</h2>
                  <span className="text-xs text-slate-500">({selectedContact.emailNormalized})</span>
                  {selectedContact.isSuppressed && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      Suppressed
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {selectedContact.organisation || 'Independent'} • {selectedContact.country || 'Global'}
                </div>
              </div>

              {/* Takeover Toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleTakeover(selectedRel.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition border shadow-sm ${
                    isTakeover
                      ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {isTakeover ? (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                      Takeover Active (AI Paused)
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-3.5 h-3.5 text-indigo-600" />
                      Enable Manual Takeover
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Relationship Memory Summary Bar */}
            <div className="px-4 py-2.5 bg-white border-b border-slate-200 text-xs flex flex-wrap items-center gap-4 text-slate-600">
              <div className="flex-1">
                <span className="text-slate-400 font-medium">Memory Summary:</span>{' '}
                <span className="text-slate-800">{selectedRel.summary || 'None recorded'}</span>
              </div>
              {selectedRel.factsJson && selectedRel.factsJson.length > 0 && (
                <div>
                  <span className="text-slate-400 font-medium">Verified Facts:</span>{' '}
                  <span className="text-slate-800 font-medium">{selectedRel.factsJson.join(' • ')}</span>
                </div>
              )}
            </div>

            {/* Message Thread Stream */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {relMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No messages in this thread yet.
                </div>
              ) : (
                relMessages.map((msg) => {
                  const isInbound = msg.direction === 'INBOUND';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                        {isInbound ? (
                          <>
                            <User className="w-3 h-3 text-slate-500" />
                            <span>{selectedContact.name}</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-3 h-3 text-indigo-600" />
                            <span>Relationship Agent</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>

                      <div
                        className={`max-w-xl p-3.5 rounded-xl text-xs whitespace-pre-wrap leading-relaxed shadow-sm ${
                          isInbound
                            ? 'bg-white text-slate-800 border border-slate-200'
                            : 'bg-indigo-50 text-indigo-950 border border-indigo-200'
                        }`}
                      >
                        {msg.subject && (
                          <div className="font-semibold pb-1.5 mb-1.5 border-b border-slate-100 text-slate-900">
                            {msg.subject}
                          </div>
                        )}
                        {msg.bodyText}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Proposed Reply or Manual Compose Pane */}
            <div className="p-4 border-t border-slate-200 bg-white space-y-3 shadow-lg">
              {currentAction && (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-semibold text-slate-900">
                        AI Proposed Next Action ({currentAction.type})
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        currentAction.status === 'AWAITING_APPROVAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {currentAction.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Draft v{currentAction.payloadJson?.draft_version || 1}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600">
                    <span className="text-slate-400 font-medium">Reason:</span> {currentAction.reason}
                  </div>

                  {currentAction.payloadJson?.draft && (
                    <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs shadow-sm">
                      <div className="font-semibold text-slate-900 mb-1">
                        {currentAction.payloadJson.draft.subject}
                      </div>
                      <pre className="text-slate-700 whitespace-pre-wrap font-sans text-[11px] leading-relaxed">
                        {currentAction.payloadJson.draft.body_text}
                      </pre>
                    </div>
                  )}

                  {/* Operator Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleAction(currentAction.id, 'approve')}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1 shadow-sm transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Enqueue Send
                    </button>
                    <button
                      onClick={() => {
                        setEditActionId(currentAction.id);
                        setEditText(currentAction.payloadJson?.draft?.body_text || '');
                      }}
                      className="px-3 py-1.5 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs flex items-center gap-1 transition"
                    >
                      <FileEdit className="w-3.5 h-3.5" /> Edit Proposed Draft
                    </button>
                    <button
                      onClick={() => handleAction(currentAction.id, 'reject', { reason: 'Operator rejected' })}
                      className="px-3 py-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs flex items-center gap-1 border border-rose-200 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>

                  {/* Inline Editor */}
                  {editActionId === currentAction.id && (
                    <div className="p-3 rounded-lg bg-white border border-indigo-300 space-y-2 mt-2 shadow-sm">
                      <div className="text-[11px] font-semibold text-indigo-700">
                        Editing Draft (Strictly increments draft version and resets approval)
                      </div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditActionId(null)}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAction(currentAction.id, 'edit', { newBodyText: editText })}
                          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
                        >
                          Save Draft
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Operator Send Input */}
              {isTakeover && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Operator Manual Reply (Takeover Mode)
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Type a manual response to send directly to the contact..."
                      className="flex-1 p-2 text-xs rounded-md bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleSendManual}
                      disabled={!manualText.trim()}
                      className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 self-end transition disabled:opacity-50 shadow-sm"
                    >
                      Send Message
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
            Select a conversation on the left to view messages.
          </div>
        )}
      </div>
    </div>
  );
}
