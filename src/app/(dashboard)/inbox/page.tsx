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
import { AppHeader } from '@/components/app-header';

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
      const res = await fetch('/api/inbox?workspaceId=ws_default');
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
    <div className="sketch-page min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      <AppHeader actions={<button
          onClick={fetchInboxData}
          disabled={loading}
          className="flex items-center gap-2 border border-black bg-white px-3 py-1.5 text-xs font-bold"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Inbox
        </button>} />

      {/* Inbox Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Thread List */}
        <aside className="w-72 border-r border-slate-300 bg-white flex flex-col shadow-sm">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Conversations ({relationships.length})
            </div>
            <span className="text-xs text-slate-500 font-bold">Select to inspect</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
            {relationships.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-500 font-medium">
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
                    className={`cursor-pointer px-3 py-2 transition ${
                      isSelected
                        ? 'bg-indigo-50 border-l-4 border-indigo-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-black text-slate-900">
                        {contact?.name || 'Contact'}
                      </span>
                      <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        rel.stage === 'ENGAGED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        rel.stage === 'OPTED_OUT' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                        'bg-slate-200 text-slate-800'
                      }`}>
                        {rel.stage}
                      </span>
                    </div>

                    <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">
                      {contact?.organisation || 'Independent'}
                    </div>

                    <div className="mt-1 flex items-center gap-1 text-[9px]">
                      {hasTakeover && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                          Takeover Active
                        </span>
                      )}
                      {relAction && (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 font-black text-[10px] animate-pulse">
                          Approval Required
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
          <main className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
            {/* Thread Header */}
            <div className="p-5 border-b-2 border-slate-300 bg-white flex items-center justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black text-slate-900">{selectedContact.name}</h2>
                  <span className="text-sm text-slate-600 font-mono font-bold">({selectedContact.emailNormalized})</span>
                  {selectedContact.isSuppressed && (
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                      Suppressed
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 font-semibold mt-0.5">
                  {selectedContact.organisation || 'Independent'} • {selectedContact.country || 'Global'}
                </div>
              </div>

              {/* Takeover Toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleTakeover(selectedRel.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition border-2 shadow-sm ${
                    isTakeover
                      ? 'bg-amber-100 text-amber-900 border-amber-400 hover:bg-amber-200'
                      : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isTakeover ? (
                    <>
                      <PauseCircle className="w-4 h-4 text-amber-700" />
                      Takeover Active (AI Paused)
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4 text-indigo-600" />
                      Enable Manual Takeover
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Relationship Memory Summary Bar */}
            <div className="px-6 py-3 bg-white border-b border-slate-200 text-xs flex flex-wrap items-center gap-6 text-slate-700 font-medium">
              <div className="flex-1">
                <span className="text-slate-500 font-bold uppercase tracking-wider">Memory Summary:</span>{' '}
                <span className="text-slate-950 font-semibold">{selectedRel.summary || 'None recorded'}</span>
              </div>
              {selectedRel.factsJson && selectedRel.factsJson.length > 0 && (
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wider">Facts:</span>{' '}
                  <span className="text-indigo-900 font-bold">{selectedRel.factsJson.join(' • ')}</span>
                </div>
              )}
            </div>

            {/* Message Thread Stream */}
            <div className="flex-1 p-8 overflow-y-auto space-y-5">
              {relMessages.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-500 font-bold">
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
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-bold mb-1">
                        {isInbound ? (
                          <>
                            <User className="w-3.5 h-3.5 text-slate-600" />
                            <span>{selectedContact.name}</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Relationship Agent</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>

                      <div
                        className={`max-w-2xl p-4 rounded-2xl text-sm leading-relaxed shadow-sm font-medium ${
                          isInbound
                            ? 'bg-white text-slate-900 border-2 border-slate-300'
                            : 'bg-indigo-50 text-indigo-950 border-2 border-indigo-200'
                        }`}
                      >
                        {msg.subject && (
                          <div className="font-black text-slate-900 pb-2 mb-2 border-b border-slate-200">
                            {msg.subject}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{msg.bodyText}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Proposed Reply or Manual Compose Pane */}
            <div className="p-6 border-t-2 border-slate-300 bg-white space-y-4 shadow-xl">
              {currentAction && (
                <div className="p-5 rounded-2xl border-2 border-amber-300 bg-amber-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-indigo-600" />
                      <span className="text-sm font-black text-slate-900">
                        AI Proposed Next Action ({currentAction.type})
                      </span>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-black ${
                        currentAction.status === 'AWAITING_APPROVAL' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                        'bg-blue-100 text-blue-900 border border-blue-300'
                      }`}>
                        {currentAction.status}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                      Draft v{currentAction.payloadJson?.draft_version || 1}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 font-semibold">
                    <span className="text-slate-500 font-bold uppercase">Reason:</span> {currentAction.reason}
                  </div>

                  {currentAction.payloadJson?.draft && (
                    <div className="p-4 rounded-xl bg-white border-2 border-slate-300 text-sm shadow-sm space-y-1">
                      <div className="font-black text-slate-900 mb-1">
                        Subject: {currentAction.payloadJson.draft.subject}
                      </div>
                      <pre className="text-slate-800 whitespace-pre-wrap font-sans text-sm leading-relaxed font-medium">
                        {currentAction.payloadJson.draft.body_text}
                      </pre>
                    </div>
                  )}

                  {/* Operator Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => handleAction(currentAction.id, 'approve')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve & Enqueue Send
                    </button>
                    <button
                      onClick={() => {
                        setEditActionId(currentAction.id);
                        setEditText(currentAction.payloadJson?.draft?.body_text || '');
                      }}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-300 font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                    >
                      <FileEdit className="w-4 h-4" /> Edit Proposed Draft
                    </button>
                    <button
                      onClick={() => handleAction(currentAction.id, 'reject', { reason: 'Operator rejected' })}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs flex items-center gap-1.5 border border-rose-300 transition"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>

                  {/* Inline Editor */}
                  {editActionId === currentAction.id && (
                    <div className="p-4 rounded-xl bg-white border-2 border-indigo-400 space-y-3 mt-3 shadow-lg">
                      <div className="text-xs font-black text-indigo-800 uppercase tracking-wide">
                        Editing Draft (Increments draft version and resets approval)
                      </div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={4}
                        className="w-full p-3 text-sm bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditActionId(null)}
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAction(currentAction.id, 'edit', { newBodyText: editText })}
                          className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md"
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
                  <div className="text-xs font-black text-amber-800 flex items-center gap-1.5 uppercase tracking-wide">
                    <User className="w-4 h-4" />
                    Operator Manual Reply (Takeover Mode)
                  </div>
                  <div className="flex gap-3">
                    <textarea
                      rows={2}
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="Type a manual response to send directly to the contact..."
                      className="flex-1 p-3 text-sm rounded-xl bg-slate-50 border-2 border-slate-300 text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
                    />
                    <button
                      onClick={handleSendManual}
                      disabled={!manualText.trim()}
                      className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shrink-0 self-end transition disabled:opacity-50 shadow-md"
                    >
                      Send Message
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm font-bold text-slate-500">
            Select a conversation on the left to view messages.
          </div>
        )}
      </div>
    </div>
  );
}
