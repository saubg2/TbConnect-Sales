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
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchSettings = async () => {
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
    }
  };

  useEffect(() => {
    fetchSettings();
    const interval = setInterval(fetchSettings, 3000);
    return () => clearInterval(interval);
  }, []);

  const sendTestAlert = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/telegram-test?workspaceId=ws_default', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setTestResult('✅ Test alert sent to Telegram!');
      } else {
        setTestResult(`⚠️ ${data.error || 'Failed to send test alert'}`);
      }
    } catch (e: any) {
      setTestResult(`⚠️ ${e.message}`);
    } finally {
      setTestLoading(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

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
    <div className="sketch-page min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
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
          <Link href="/actions" className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition">
            Actions
          </Link>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <h1 className="text-base font-black text-slate-900">Settings</h1>
          </div>
        </div>

        <button
          onClick={fetchSettings}
          disabled={loading}
          className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 shadow-sm transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Main Settings Sections */}
      <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-8">
        {/* Emergency Stop Alert Banner */}
        {emergencyActive && (
          <div className="p-4 rounded-xl border-2 border-rose-400 bg-rose-50 flex items-center justify-between text-sm text-rose-950 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertOctagon className="w-6 h-6 text-rose-600 shrink-0" />
              <div>
                <div className="font-black text-rose-950 uppercase tracking-wide">
                  Emergency Stop Active — Outbound Sending Suspended
                </div>
                <div className="text-rose-800 font-medium">All automated queues are paused across the workspace.</div>
              </div>
            </div>
            <button
              onClick={toggleEmergencyStop}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow"
            >
              Resume Sending
            </button>
          </div>
        )}

        {/* 1. Telegram Integration Section */}
        <section className="p-6 rounded-xl border-2 border-slate-300 bg-white shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b-2 border-slate-100">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-6 h-6 text-sky-600 shrink-0" />
              <div>
                <h2 className="text-base font-black text-slate-900">Telegram Alerts & Inline Approvals</h2>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Connect your private Telegram chat to receive instant notifications and 1-click Approve / Reject buttons.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {members.some((m) => m.telegramLinked) && (
                <button
                  onClick={sendTestAlert}
                  disabled={testLoading}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition"
                >
                  {testLoading ? 'Sending...' : 'Send Test Alert'}
                </button>
              )}
              <button
                onClick={generateTelegramLink}
                disabled={linkingLoading}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow transition"
              >
                {linkingLoading ? 'Generating...' : 'Generate 1-Time Link Token'}
              </button>
            </div>
          </div>

          {testResult && (
            <div className="p-3 rounded-lg bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800">
              {testResult}
            </div>
          )}

          {/* Linking Modal Box */}
          {linkingResult && (
            <div className="p-4 rounded-xl border-2 border-sky-300 bg-sky-50 space-y-3 text-xs">
              <div className="font-bold text-sky-950 text-sm">
                Single-Use Telegram Deep Link (Valid for 15 minutes):
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={linkingResult.linkUrl}
                  className="flex-1 p-2.5 bg-white border-2 border-slate-300 rounded-lg font-mono text-xs text-slate-900 shadow-sm"
                />
                <button
                  onClick={copyLink}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-300 rounded-lg flex items-center gap-1.5 shrink-0 font-bold shadow-sm transition"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <a
                  href={linkingResult.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg flex items-center gap-1.5 shrink-0 font-bold shadow transition"
                >
                  <ExternalLink className="w-4 h-4" /> Open Bot
                </a>
              </div>
              <p className="text-xs text-slate-700 font-medium">
                Click the button or open the link to start the bot. The bot will automatically authenticate and link your Telegram user ID to your workspace role.
              </p>
            </div>
          )}

          {/* Connected Telegram Operators Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Workspace Operators & Linkage</h3>
            <div className="rounded-xl border-2 border-slate-300 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-black border-b-2 border-slate-300">
                  <tr>
                    <th className="py-3 px-4">Member ID</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Telegram Account</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500 font-medium text-xs">
                        No operators linked yet. Click &quot;Generate 1-Time Link Token&quot; above.
                      </td>
                    </tr>
                  ) : (
                    members.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{m.userId}</td>
                        <td className="py-3 px-4 capitalize text-slate-800 font-bold">{m.role}</td>
                        <td className="py-3 px-4 text-slate-800 font-medium">
                          {m.telegramUsername ? `@${m.telegramUsername}` : m.telegramChatId ? `Chat: ${m.telegramChatId}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {m.telegramLinked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Linked
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-slate-500">Unlinked</span>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Email Sender Configuration */}
          <section className="p-6 rounded-xl border-2 border-slate-300 bg-white shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-slate-100">
              <Send className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-black text-slate-900">Email Sender Configuration</h2>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-bold">Active Email Provider</label>
                <div className="p-3 rounded-lg bg-slate-50 border-2 border-slate-200 font-mono font-bold text-slate-900">
                  Resend (REST API)
                </div>
              </div>
              <div>
                <label className="text-slate-700 block mb-1 font-bold">Default From Email</label>
                <div className="p-3 rounded-lg bg-slate-50 border-2 border-slate-200 font-medium text-slate-800">
                  onboarding@resend.dev (or verified custom domain)
                </div>
              </div>
              <div className="pt-1">
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border-2 border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">Safe-by-Default Dry Run</div>
                    <div className="text-xs text-slate-600 font-medium">Never sends external email without explicit approval.</div>
                  </div>
                  <span className="px-3 py-1 rounded text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* LLM & AI Engine Configuration */}
          <section className="p-6 rounded-xl border-2 border-slate-300 bg-white shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b-2 border-slate-100">
              <Bot className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-black text-slate-900">LLM Provider & Model</h2>
            </div>
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-bold">Active Provider</label>
                <div className="p-3 rounded-lg bg-slate-50 border-2 border-slate-200 font-mono font-bold text-slate-900">
                  Mistral AI
                </div>
              </div>
              <div>
                <label className="text-slate-700 block mb-1 font-bold">Active Model</label>
                <div className="p-3 rounded-lg bg-slate-50 border-2 border-slate-200 font-mono font-bold text-slate-900">
                  ministral-8b-latest (JSON Mode)
                </div>
              </div>
              <div className="pt-1">
                <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-50 border-2 border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">API Key Authentication</div>
                    <div className="text-xs text-slate-600 font-medium">Verified & active in environment.</div>
                  </div>
                  <span className="px-3 py-1 rounded text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                    Live
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 3. Operational Safety Controls */}
        <section className="p-6 rounded-xl border-2 border-slate-300 bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b-2 border-slate-100">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-black text-slate-900">Emergency Controls & Safety Limits</h2>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-xl border-2 border-slate-300 bg-slate-50">
            <div>
              <div className="font-black text-slate-900 text-sm">Workspace Emergency Stop</div>
              <div className="text-slate-600 text-xs font-medium mt-1">
                Immediately blocks all background worker sends, cancels queued dispatches, and halts outreach across the entire workspace.
              </div>
            </div>
            <button
              onClick={toggleEmergencyStop}
              disabled={emergencyLoading}
              className={`px-4 py-2.5 rounded-lg font-bold text-xs transition border-2 shrink-0 shadow ${
                emergencyActive
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700 animate-pulse'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
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
