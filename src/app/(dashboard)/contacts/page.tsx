'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Upload,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  X,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [suppressedFilter, setSuppressedFilter] = useState<'all' | 'active' | 'suppressed'>('all');

  // Modal & Drawer State
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvInput, setCsvInput] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      let url = `/api/contacts?workspaceId=ws_default`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (suppressedFilter === 'active') url += `&isSuppressed=false`;
      if (suppressedFilter === 'suppressed') url += `&isSuppressed=true`;

      const res = await fetch(url);
      const data = await res.json();
      if (data && data.contacts) {
        setContacts(data.contacts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [search, suppressedFilter]);

  const loadProfile = async (contactId: string) => {
    setSelectedContactId(contactId);
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}?workspaceId=ws_default`);
      const data = await res.json();
      if (data && !data.error) {
        setSelectedProfile(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleToggleSuppression = async (contactId: string, currentSuppressed: boolean) => {
    try {
      await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_default',
          isSuppressed: !currentSuppressed,
          reason: !currentSuppressed ? 'Manually suppressed by operator' : undefined,
        }),
      });
      await fetchContacts();
      if (selectedContactId === contactId) {
        await loadProfile(contactId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImport = async () => {
    if (!csvInput.trim()) return;
    setImportLoading(true);
    try {
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_default',
          csvText: csvInput,
          sourceName: 'web_csv_import',
        }),
      });
      const data = await res.json();
      setImportResult(data);
      await fetchContacts();
    } catch (e) {
      console.error(e);
    } finally {
      setImportLoading(false);
    }
  };

  const seedMonitoredContacts = async () => {
    setImportLoading(true);
    try {
      const csv = `Name,Email,Company,Country,Tags,Suppressed,Reason
Saurabh Sharma,saurabhjaipur@gmail.com,Jaipur Tech,India,vip;test-lead,false,
Saub Consulting,saubconsulting@gmail.com,Saub Consulting,India,vip;client,false,`;
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'ws_default',
          csvText: csv,
          sourceName: 'monitored_experiment',
        }),
      });
      const data = await res.json();
      setImportResult(data);
      await fetchContacts();
    } catch (e) {
      console.error(e);
    } finally {
      setImportLoading(false);
    }
  };

  const loadSampleCSV = (count: 2 | 5 | 100) => {
    if (count === 2) {
      setCsvInput(`Name,Email,Company,Country,Tags,Suppressed,Reason
Saurabh Sharma,saurabhjaipur@gmail.com,Jaipur Tech,India,vip;test-lead,false,
Saub Consulting,saubconsulting@gmail.com,Saub Consulting,India,vip;client,false,`);
    } else if (count === 5) {
      setCsvInput(`Name,Email,Company,Country,Tags,Suppressed,Reason
Alice Walker,alice@enterprise.com,Enterprise Tech,United States,vip;partner,false,
Bob Smith,bob@samplecorp.io,SampleCorp,United Kingdom,tier-1,true,Requested do not contact
Carlos Ray,carlos@innovate.co,Innovate Co,Canada,inbound,false,
Diana Prince,diana@themyscira.gov,Gov Services,Greece,lead,false,
Alice Walker,alice@enterprise.com,Enterprise Tech,United States,duplicate,false,`);
    } else {
      let rows = 'Name,Email,Company,Country,Tags,Suppressed,Reason\n';
      for (let i = 1; i <= 100; i++) {
        const isSupp = i % 15 === 0;
        rows += `Partner User ${i},partner${i}@cloudscale${i % 10}.com,CloudScale ${i % 5},United States,imported-100;tier-${(i % 3) + 1},${isSupp},${isSupp ? 'Compliance suppression' : ''}\n`;
      }
      rows += `Partner User 1,partner1@cloudscale1.com,CloudScale 1,United States,duplicate-entry,false,\n`;
      rows += `Partner User 2,partner2@cloudscale2.com,CloudScale 2,United States,duplicate-entry,false,\n`;
      setCsvInput(rows);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-300 bg-white sticky top-0 z-10 px-8 py-5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-bold text-slate-700 hover:text-indigo-600 transition">
            ← Home
          </Link>
          <span className="text-slate-300 font-bold">|</span>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h1 className="text-lg font-black text-slate-900">Contacts</h1>
          </div>
          <span className="text-slate-300 font-bold">|</span>
          <Link href="/agents" className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition">
            Agents
          </Link>
          <span className="text-slate-300 font-bold">|</span>
          <Link href="/inbox" className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition">
            Inbox
          </Link>
          <span className="text-slate-300 font-bold">|</span>
          <Link href="/actions" className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition">
            Actions
          </Link>
          <span className="text-slate-300 font-bold">|</span>
          <Link href="/settings" className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition">
            Settings
          </Link>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-300 font-bold">
            {contacts.length} Records
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={seedMonitoredContacts}
            disabled={importLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition"
          >
            <UserCheck className="w-4 h-4" />
            + Add 2 Monitored Contacts (Saurabh & Saub)
          </button>

          <button
            onClick={() => {
              setShowImportModal(true);
              setImportResult(null);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Quick Helper Banner for Monitored Experiment */}
        <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              Live Monitored Experiment Mode
            </h2>
            <p className="text-sm text-slate-600 mt-1 font-medium">
              Click <strong className="text-emerald-700">&quot;+ Add 2 Monitored Contacts&quot;</strong> to instantly seed <strong>saurabhjaipur@gmail.com</strong> and <strong>saubconsulting@gmail.com</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-bold">
              Target 1: saurabhjaipur@gmail.com
            </span>
            <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-bold">
              Target 2: saubconsulting@gmail.com
            </span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-300 shadow-sm">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-300 text-xs self-stretch sm:self-auto justify-center font-bold">
            <button
              onClick={() => setSuppressedFilter('all')}
              className={`px-4 py-1.5 rounded-lg transition ${
                suppressedFilter === 'all'
                  ? 'bg-white text-slate-950 shadow font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Contacts
            </button>
            <button
              onClick={() => setSuppressedFilter('active')}
              className={`px-4 py-1.5 rounded-lg transition ${
                suppressedFilter === 'active'
                  ? 'bg-white text-slate-950 shadow font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Eligible Only
            </button>
            <button
              onClick={() => setSuppressedFilter('suppressed')}
              className={`px-4 py-1.5 rounded-lg transition ${
                suppressedFilter === 'suppressed'
                  ? 'bg-white text-slate-950 shadow font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Suppressed
            </button>
          </div>
        </div>

        {/* Contacts Table */}
        <div className="bg-white rounded-2xl border-2 border-slate-300 shadow overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-800 border-b-2 border-slate-300 uppercase tracking-wider text-xs font-black">
              <tr>
                <th className="py-3.5 px-5">Contact</th>
                <th className="py-3.5 px-5">Company</th>
                <th className="py-3.5 px-5">Country</th>
                <th className="py-3.5 px-5">Tags</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-600 font-medium">
                    No contacts found. Click <strong>&quot;+ Add 2 Monitored Contacts&quot;</strong> above to get started immediately.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-slate-50 cursor-pointer transition font-medium"
                    onClick={() => loadProfile(contact.id)}
                  >
                    <td className="py-4 px-5">
                      <div className="font-bold text-slate-900 text-base">{contact.name}</div>
                      <div className="text-slate-600 font-mono text-xs font-semibold">{contact.emailNormalized}</div>
                    </td>
                    <td className="py-4 px-5 text-slate-800 font-semibold">
                      {contact.organisation || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-4 px-5 text-slate-800">
                      {contact.country || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex flex-wrap gap-1.5">
                        {contact.tagsJson && contact.tagsJson.length > 0 ? (
                          contact.tagsJson.map((t: string) => (
                            <span
                              key={t}
                              className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs border border-slate-300 font-bold"
                            >
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      {contact.isSuppressed ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                          <span>Suppressed</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Eligible</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSuppression(contact.id, contact.isSuppressed);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                          contact.isSuppressed
                            ? 'bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-400'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {contact.isSuppressed ? 'Unsuppress' : 'Suppress'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
                <h3 className="text-lg font-black text-slate-900">CSV Contact Importer</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 font-medium">
              Paste raw CSV text or pick one of the quick fixtures below.
            </p>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold uppercase">Presets:</span>
              <button
                onClick={() => loadSampleCSV(2)}
                className="px-3 py-1.5 text-xs rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition font-black"
              >
                2 Monitored Contacts (Saurabh & Saub)
              </button>
              <button
                onClick={() => loadSampleCSV(5)}
                className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition font-bold"
              >
                5 Sample
              </button>
              <button
                onClick={() => loadSampleCSV(100)}
                className="px-3 py-1.5 text-xs rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold transition"
              >
                100 Contacts Bulk
              </button>
            </div>

            <textarea
              rows={8}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder="Name,Email,Company,Country,Tags..."
              className="w-full p-3 font-mono text-xs rounded-xl bg-slate-50 border-2 border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-600"
            />

            {/* Import Results Box */}
            {importResult && (
              <div className="p-4 rounded-xl border-2 border-slate-300 bg-slate-50 space-y-2 text-xs">
                <div className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Import Complete (Batch: {importResult.batchId})
                </div>
                <div className="grid grid-cols-4 gap-2 text-center pt-1 font-bold">
                  <div className="bg-white border border-slate-300 p-2 rounded-lg shadow-sm">
                    <div className="text-slate-500 text-[10px]">Total Parsed</div>
                    <div className="text-base text-slate-900 font-black">{importResult.totalRows}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-300 p-2 rounded-lg shadow-sm">
                    <div className="text-emerald-800 text-[10px]">Imported</div>
                    <div className="text-base text-emerald-800 font-black">{importResult.importedCount}</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-300 p-2 rounded-lg shadow-sm">
                    <div className="text-amber-800 text-[10px]">Duplicates</div>
                    <div className="text-base text-amber-800 font-black">{importResult.duplicateCount}</div>
                  </div>
                  <div className="bg-rose-50 border border-rose-300 p-2 rounded-lg shadow-sm">
                    <div className="text-rose-800 text-[10px]">Suppressed</div>
                    <div className="text-base text-rose-800 font-black">{importResult.suppressedCount}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900"
              >
                Close
              </button>
              <button
                onClick={handleImport}
                disabled={importLoading || !csvInput.trim()}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50 shadow-md"
              >
                {importLoading ? 'Processing...' : 'Start Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact & Relationship Detail Drawer */}
      {selectedContactId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex justify-end">
          <div className="w-full max-w-xl bg-white border-l-2 border-slate-300 p-8 space-y-6 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-black text-slate-900">Relationship Memory</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedContactId(null);
                  setSelectedProfile(null);
                }}
                className="text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {profileLoading || !selectedProfile ? (
              <div className="py-16 text-center text-sm text-slate-500 font-bold">Loading profile...</div>
            ) : (
              <div className="space-y-6 text-sm">
                {/* Contact Card */}
                <div className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-base font-black text-slate-900">{selectedProfile.contact.name}</div>
                      <div className="text-slate-600 font-mono text-xs font-bold">{selectedProfile.contact.emailNormalized}</div>
                    </div>
                    {selectedProfile.contact.isSuppressed ? (
                      <span className="px-3 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                        Suppressed
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        Eligible
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-800 pt-3 border-t border-slate-200 font-medium">
                    <div>
                      <span className="text-slate-500 font-bold">Organisation:</span>{' '}
                      {selectedProfile.contact.organisation || 'N/A'}
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold">Country:</span>{' '}
                      {selectedProfile.contact.country || 'N/A'}
                    </div>
                  </div>

                  {/* Provenance */}
                  {selectedProfile.contact.sourceJson && (
                    <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-300 font-mono">
                      <span className="text-slate-900 font-bold">Provenance:</span>{' '}
                      {JSON.stringify(selectedProfile.contact.sourceJson)}
                    </div>
                  )}

                  {selectedProfile.contact.isSuppressed && (
                    <div className="text-xs text-rose-800 bg-rose-50 p-2.5 rounded-lg border border-rose-300 font-bold">
                      Reason: {selectedProfile.contact.suppressionReason || 'Unknown'}
                    </div>
                  )}
                </div>

                {/* Relationship State */}
                <div className="p-5 rounded-2xl border-2 border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900">Relationship Context</span>
                    <span className="px-3 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-300">
                      Stage: {selectedProfile.relationship?.stage || 'NEW'}
                    </span>
                  </div>

                  <div className="text-slate-900 bg-white p-3 rounded-xl border border-slate-300 leading-relaxed">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Memory Summary:</div>
                    <div>
                      {selectedProfile.relationship?.summary || 'No conversations recorded yet.'}
                    </div>
                  </div>

                  {selectedProfile.relationship?.factsJson?.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-slate-700 uppercase mb-1">Verified Facts:</div>
                      <ul className="list-disc list-inside space-y-1 text-slate-800 text-xs font-medium">
                        {selectedProfile.relationship.factsJson.map((f: string, idx: number) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                  <h4 className="font-black text-slate-900">Event Log & Audit Trail</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedProfile.events?.length === 0 ? (
                      <div className="text-slate-500 text-center py-4 font-bold">No logged events yet.</div>
                    ) : (
                      selectedProfile.events.map((evt: any) => (
                        <div
                          key={evt.id}
                          className="p-3 rounded-xl border border-slate-300 bg-white text-xs flex items-center justify-between shadow-sm font-medium"
                        >
                          <div>
                            <span className="font-bold text-indigo-700">{evt.eventType}</span>
                            <span className="text-slate-600 ml-2">
                              {JSON.stringify(evt.payloadJson)}
                            </span>
                          </div>
                          <span className="text-slate-400 shrink-0 ml-2 font-mono">
                            {new Date(evt.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
