'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  MessageSquare,
  Send,
  AlertOctagon,
  CheckCircle2,
  Copy,
  ExternalLink,
  RefreshCw,
  Bot,
  Key,
} from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [linkingResult, setLinkingResult] = useState<{
    linkUrl: string;
    token: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Emergency Stop State
  const [emergencyActive, setEmergencyActive] = useState<boolean>(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // 1. Fetch Telegram operators & members
      const res = await fetch('/api/settings/telegram-link?workspaceId=ws_default');
      const data = await res.json();
      if (data && data.members) {
        setMembers(data.members);
      }

      // 2. Fetch emergency stop state
      const emRes = await fetch('/api/workspace/emergency-stop?workspaceId=ws_default');
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
          userId: 'usr_default_admin',
        }),
      });
      const data = await res.json();
      if (data && data.linkUrl) {
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
          <Link href="/actions" className="text-xs text-slate-500 hover:text-slate-900 transition">
            Actions
          </Link>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-600" />
            <h1 className="text-base font-bold text-slate-900">Settings</h1>
          </div>
        </div>

        <button
          onClick={fetchSettings}
          disabled={loading}
          className="p-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Main Settings Sections */}
      <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-8">
        {/* Emergency Stop Alert Banner */}
        {emergencyActive && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-between text-xs text-rose-800 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <div className="font-bold text-rose-900 uppercase tracking-wide">
                  Emergency Stop Active — Outbound Sending Suspended
                </div>
                <div className="text-rose-700">All automated queues are paused across the workspace.</div>
              </div>
            </div>
            <button
              onClick={toggleEmergencyStop}
              className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold transition shadow-sm"
            >
              Resume Sending
            </button>
          </div>
        )}

        {/* 1. Telegram Integration Section */}
        <section className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-sky-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Telegram Alerts & Inline Approvals</h2>
                <p className="text-xs text-slate-500">
                  Connect your private Telegram chat to receive instant notifications and 1-click Approve / Reject buttons.
                </p>
              </div>
            </div>
            <button
              onClick={generateTelegramLink}
              disabled={linkingLoading}
              className="px-3.5 py-1.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shrink-0 shadow-sm transition"
            >
              {linkingLoading ? 'Generating...' : 'Generate 1-Time Link Token'}
            </button>
          </div>

          {/* Linking Modal Box */}
          {linkingResult && (
            <div className="p-4 rounded-xl border border-sky-200 bg-sky-50 space-y-3 text-xs">
              <div className="font-semibold text-sky-900">
                Single-Use Telegram Deep Link (Valid for 15 minutes):
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={linkingResult.linkUrl}
                  className="flex-1 p-2 bg-white border border-slate-300 rounded-md font-mono text-[11px] text-slate-900 shadow-sm"
                />
                <button
                  onClick={copyLink}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md flex items-center gap-1 shrink-0 font-medium shadow-sm transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <a
                  href={linkingResult.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md flex items-center gap-1 shrink-0 font-semibold shadow-sm transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Bot
                </a>
              </div>
              <p className="text-[11px] text-slate-600">
                Click the button or open the link to start the bot. The bot will automatically authenticate and link your Telegram user ID to your workspace role.
              </p>
            </div>
          )}

          {/* Connected Telegram Operators Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-700">Workspace Operators & Linkage</h3>
            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Member ID</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Telegram Account</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        No operators linked yet. Click &quot;Generate 1-Time Link Token&quot; above.
                      </td>
                    </tr>
                  ) : (
                    members.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-800">{m.userId}</td>
                        <td className="py-2.5 px-3 capitalize text-slate-700 font-medium">{m.role}</td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {m.telegramUsername ? `@${m.telegramUsername}` : m.telegramChatId ? `Chat: ${m.telegramChatId}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {m.telegramLinked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Linked
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Unlinked</span>
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
          <section className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Send className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Email Sender Configuration</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-slate-500 block mb-1 font-medium">Active Email Provider</label>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-800">
                  Resend (REST API)
                </div>
              </div>
              <div>
                <label className="text-slate-500 block mb-1 font-medium">Default From Email</label>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                  onboarding@resend.dev (or verified custom domain)
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-800">Safe-by-Default Dry Run</div>
                    <div className="text-[11px] text-slate-500">Never sends external email without explicit approval.</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* LLM & AI Engine Configuration */}
          <section className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Bot className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-bold text-slate-900">LLM Provider & Model</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-slate-500 block mb-1 font-medium">Active Provider</label>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-800">
                  Mistral AI
                </div>
              </div>
              <div>
                <label className="text-slate-500 block mb-1 font-medium">Active Model</label>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-800">
                  ministral-8b-latest (JSON Mode)
                </div>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-800">API Key Authentication</div>
                    <div className="text-[11px] text-slate-500">Verified & active in environment.</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 3. Operational Safety Controls */}
        <section className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Shield className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Emergency Controls & Safety Limits</h2>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <div>
              <div className="font-bold text-slate-900">Workspace Emergency Stop</div>
              <div className="text-slate-500 mt-0.5">
                Immediately blocks all background worker sends, cancels queued dispatches, and halts outreach across the entire workspace.
              </div>
            </div>
            <button
              onClick={toggleEmergencyStop}
              disabled={emergencyLoading}
              className={`px-4 py-2 rounded-md font-bold text-xs transition border shrink-0 shadow-sm ${
                emergencyActive
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 animate-pulse'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
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
