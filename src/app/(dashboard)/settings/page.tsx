'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Send,
  Shield,
  Bot,
  Users,
  AlertOctagon,
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingResult, setLinkingResult] = useState<any>(null);
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Settings State
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/telegram-link?workspaceId=ws_default');
      const data = await res.json();
      if (data && data.members) {
        setMembers(data.members);
      }

      const emRes = await fetch('/api/workspace/emergency-stop?workspaceId=ws_default');
      const emData = await emRes.json();
      setEmergencyActive(!!emData.emergencyStopActive);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const generateTelegramLink = async () => {
    setLinkingLoading(true);
    try {
      const res = await fetch('/api/settings/telegram-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_default',
          userId: 'operator_dan',
        }),
      });
      const data = await res.json();
      if (data.linkUrl) {
        setLinkingResult(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLinkingLoading(false);
    }
  };

  const copyLink = () => {
    if (linkingResult?.linkUrl) {
      navigator.clipboard.writeText(linkingResult.linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleEmergencyStop = async () => {
    setEmergencyLoading(true);
    try {
      await fetch('/api/workspace/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_default',
          enabled: !emergencyActive,
          reason: !emergencyActive ? 'Manual emergency stop triggered from Settings' : 'Resumed by operator',
        }),
      });
      await fetchSettings();
    } catch (e) {
      console.error(e);
    } finally {
      setEmergencyLoading(false);
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
          <Link href="/actions" className="text-xs text-slate-400 hover:text-slate-200 transition">
            Actions
          </Link>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            <h1 className="text-base font-bold text-white">Workspace Settings</h1>
          </div>
        </div>

        <button
          onClick={fetchSettings}
          disabled={loading}
          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Main Settings Sections */}
      <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-8">
        {/* Emergency Stop Alert Banner */}
        {emergencyActive && (
          <div className="p-4 rounded-xl border border-rose-800 bg-rose-950/70 flex items-center justify-between text-xs text-rose-200 shadow-lg animate-pulse">
            <div className="flex items-center gap-3">
              <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <div className="font-bold text-rose-100 uppercase tracking-wide">
                  Emergency Stop Active — Outbound Sending Suspended
                </div>
                <div className="text-rose-300">All automated queues are paused across the workspace.</div>
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

        {/* 1. Telegram Integration Section */}
        <section className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-sky-400" />
              <div>
                <h2 className="text-sm font-bold text-white">Telegram Alerts & Inline Approvals</h2>
                <p className="text-xs text-slate-400">
                  Connect your private Telegram chat to receive instant notifications and 1-click Approve / Reject buttons.
                </p>
              </div>
            </div>
            <button
              onClick={generateTelegramLink}
              disabled={linkingLoading}
              className="px-3.5 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shrink-0 transition"
            >
              {linkingLoading ? 'Generating...' : 'Generate 1-Time Link Token'}
            </button>
          </div>

          {/* Linking Modal Box */}
          {linkingResult && (
            <div className="p-4 rounded-lg border border-sky-900 bg-sky-950/40 space-y-3 text-xs">
              <div className="font-semibold text-sky-300">
                Single-Use Telegram Deep Link (Valid for 15 minutes):
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={linkingResult.linkUrl}
                  className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-200"
                />
                <button
                  onClick={copyLink}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-1 shrink-0 font-medium transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <a
                  href={linkingResult.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded flex items-center gap-1 shrink-0 font-semibold transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Bot
                </a>
              </div>
              <p className="text-[11px] text-slate-400">
                Click the button or open the link to start the bot. The bot will automatically authenticate and link your Telegram user ID to your workspace role.
              </p>
            </div>
          )}

          {/* Connected Telegram Operators Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-300">Workspace Operators & Linkage</h3>
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Member ID</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Telegram Account</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-500">
                        No operators linked yet. Click &quot;Generate 1-Time Link Token&quot; above.
                      </td>
                    </tr>
                  ) : (
                    members.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/20">
                        <td className="py-2.5 px-3 font-mono text-slate-300">{m.userId}</td>
                        <td className="py-2.5 px-3 capitalize text-slate-300">{m.role}</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {m.telegramUsername ? `@${m.telegramUsername}` : m.telegramChatId ? `Chat: ${m.telegramChatId}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {m.telegramLinked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Linked
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Unlinked</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 2. Sender Configuration & Safety Limits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Email Sender Configuration */}
          <section className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Send className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Email Sender Configuration</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Active Email Provider</label>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-slate-200">
                  Resend (REST API)
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Default From Email</label>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-300">
                  onboarding@resend.dev (or verified custom domain)
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-200">Safe-by-Default Dry Run</div>
                    <div className="text-[11px] text-slate-400">Never sends external email without explicit approval.</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* LLM & AI Engine Configuration */}
          <section className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Bot className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">LLM Provider & Model</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Active Provider</label>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-slate-200">
                  Mistral AI
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Active Model</label>
                <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-slate-300">
                  ministral-8b-latest (JSON Mode)
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-200">API Key Authentication</div>
                    <div className="text-[11px] text-slate-400">Verified & active in environment.</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                    Live
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 3. Operational Safety Controls */}
        <section className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Emergency Controls & Safety Limits</h2>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-950 text-xs">
            <div>
              <div className="font-bold text-white">Workspace Emergency Stop</div>
              <div className="text-slate-400">
                Immediately blocks all background worker sends, cancels queued dispatches, and halts outreach across the entire workspace.
              </div>
            </div>
            <button
              onClick={toggleEmergencyStop}
              disabled={emergencyLoading}
              className={`px-4 py-2 rounded-md font-bold text-xs transition border shrink-0 ${
                emergencyActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 animate-pulse'
                  : 'bg-rose-950 hover:bg-rose-900 text-rose-300 border-rose-800'
              }`}
            >
              {emergencyActive ? 'Resume Outreach' : 'Activate Emergency Stop'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
