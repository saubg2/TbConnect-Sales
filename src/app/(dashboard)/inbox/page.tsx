'use client';

import React, { useState, useEffect } from 'react';
import {
  Inbox,
  Send,
  User,
  Bot,
  CheckCircle2,
  AlertTriangle,
  FileEdit,
  XCircle,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
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

  // Manual compose state
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

        if (!selectedRelationshipId && data.relationships?.length > 0) {
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
  const relMessages = messages
    .filter((m) => m.relationshipId === selectedRelationshipId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const currentAction = actions.find(
    (a) => a.relationshipId === selectedRelationshipId && (a.status === 'AWAITING_APPROVAL' || a.status === 'PENDING')
  );

  const isTakeover = selectedRelationshipId ? !!manualTakeoverMap[selectedRelationshipId] : false;

  const toggleTakeover = (relId: string) => {
    setManualTakeoverMap((prev) => ({
      ...prev,
      [relId]: !prev[relId],
    }));
  };

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
          <Link href="/actions" className="text-xs text-slate-400 hover:text-slate-200 transition">
            Actions
          </Link>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-indigo-400" />
            <h1 className="text-base font-bold text-white">Inbox & Thread Takeover</h1>
          </div>
        </div>

        <button
          onClick={fetchInboxData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {/* Inbox Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Thread List */}
        <aside className="w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col">
          <div className="p-3 border-b border-slate-800">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Conversations ({relationships.length})
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
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
                        ? 'bg-slate-800/70 border-l-2 border-indigo-500'
                        : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-200 truncate">
                        {contact?.name || 'Contact'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                        rel.stage === 'ENGAGED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        rel.stage === 'OPTED_OUT' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {rel.stage}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 truncate">
                      {contact?.emailNormalized}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-0.5">
                      {hasTakeover && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800">
                          Takeover
                        </span>
                      )}
                      {relAction && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-950 text-blue-400 border border-blue-800 animate-pulse">
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
          <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
            {/* Thread Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">{selectedContact.name}</h2>
                  <span className="text-xs text-slate-400">({selectedContact.emailNormalized})</span>
                  {selectedContact.isSuppressed && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950 text-rose-400 border border-rose-800">
                      Suppressed
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {selectedContact.organisation || 'Independent'} • {selectedContact.country || 'Global'}
                </div>
              </div>

              {/* Takeover Toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleTakeover(selectedRel.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition border ${
                    isTakeover
                      ? 'bg-amber-950/80 text-amber-300 border-amber-700 hover:bg-amber-900/80'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {isTakeover ? (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                      Takeover Active (AI Paused)
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-3.5 h-3.5 text-indigo-400" />
                      Enable Manual Takeover
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Relationship Memory Summary Bar */}
            <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800 text-xs flex flex-wrap items-center gap-4">
              <div className="flex-1">
                <span className="text-slate-400 font-medium">Memory Summary:</span>{' '}
                <span className="text-slate-200">{selectedRel.summary || 'None recorded'}</span>
              </div>
              {selectedRel.factsJson && selectedRel.factsJson.length > 0 && (
                <div className="text-slate-400">
                  <span className="text-slate-300 font-medium">Verified Facts:</span>{' '}
                  {selectedRel.factsJson.join(' • ')}
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
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                        {isInbound ? (
                          <>
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{selectedContact.name}</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-3 h-3 text-indigo-400" />
                            <span>Relationship Agent</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>

                      <div
                        className={`max-w-xl p-3.5 rounded-xl text-xs whitespace-pre-wrap leading-relaxed shadow-sm ${
                          isInbound
                            ? 'bg-slate-900 text-slate-200 border border-slate-800'
                            : 'bg-indigo-950/80 text-indigo-100 border border-indigo-800/80'
                        }`}
                      >
                        {msg.subject && (
                          <div className="font-semibold pb-1.5 mb-1.5 border-b border-slate-800/80 text-slate-300">
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
            <div className="p-4 border-t border-slate-800 bg-slate-900/60 space-y-3">
              {currentAction && (
                <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-semibold text-white">
                        AI Proposed Next Action ({currentAction.type})
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        currentAction.status === 'AWAITING_APPROVAL' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        'bg-blue-950 text-blue-400'
                      }`}>
                        {currentAction.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Draft v{currentAction.payloadJson?.draft_version || 1}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    <span className="text-slate-300 font-medium">Reason:</span> {currentAction.reason}
                  </div>

                  {currentAction.payloadJson?.draft && (
                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-xs">
                      <div className="font-semibold text-slate-300 mb-1">
                        {currentAction.payloadJson.draft.subject}
                      </div>
                      <pre className="text-slate-200 whitespace-pre-wrap font-sans text-[11px]">
                        {currentAction.payloadJson.draft.body_text}
                      </pre>
                    </div>
                  )}

                  {/* Operator Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleAction(currentAction.id, 'approve')}
                      className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-xs flex items-center gap-1 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Enqueue Send
                    </button>
                    <button
                      onClick={() => {
                        setEditActionId(currentAction.id);
                        setEditText(currentAction.payloadJson?.draft?.body_text || '');
                      }}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1 transition"
                    >
                      <FileEdit className="w-3.5 h-3.5" /> Edit Proposed Draft
                    </button>
                    <button
                      onClick={() => handleAction(currentAction.id, 'reject', { reason: 'Operator rejected' })}
                      className="px-3 py-1.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 font-medium text-xs flex items-center gap-1 border border-rose-800 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>

                  {/* Inline Editor */}
                  {editActionId === currentAction.id && (
                    <div className="p-3 rounded bg-slate-900 border border-indigo-700 space-y-2 mt-2">
                      <div className="text-[11px] font-semibold text-indigo-300">
                        Editing Draft (Strictly increments draft version and resets approval)
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
                          onClick={() => handleAction(currentAction.id, 'edit', { newBodyText: editText })}
                          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                        >
                          Save Draft
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Operator Send Input (Always available if takeover is on, or when no action is pending) */}
              {isTakeover && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Operator Manual Reply (Takeover Mode)
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Type a manual response to send directly to the contact..."
                      className="flex-1 p-2 text-xs rounded-md bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleSendManual}
                      disabled={!manualText.trim()}
                      className="px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shrink-0 self-end transition disabled:opacity-50"
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
