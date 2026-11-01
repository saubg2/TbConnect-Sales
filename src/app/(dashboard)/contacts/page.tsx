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

  const loadSampleCSV = (count: 5 | 100) => {
    if (count === 5) {
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-900 transition">
            ← Home
          </Link>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <h1 className="text-base font-bold text-slate-900">Contacts</h1>
          </div>
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
          <Link href="/settings" className="text-xs text-slate-500 hover:text-slate-900 transition">
            Settings
          </Link>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
            {contacts.length} Records
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowImportModal(true);
              setImportResult(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs self-stretch sm:self-auto justify-center">
            <button
              onClick={() => setSuppressedFilter('all')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                suppressedFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSuppressedFilter('active')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                suppressedFilter === 'active'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Eligible Only
            </button>
            <button
              onClick={() => setSuppressedFilter('suppressed')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                suppressedFilter === 'suppressed'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Suppressed
            </button>
          </div>
        </div>

        {/* Contacts Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
              <tr>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Country</th>
                <th className="py-3 px-4">Tags</th>
                <th className="py-3 px-4">Eligibility / Suppression</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No contacts found matching criteria. Click &quot;Import CSV&quot; to import contacts.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-slate-50 cursor-pointer transition"
                    onClick={() => loadProfile(contact.id)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{contact.name}</div>
                      <div className="text-slate-500 text-[11px]">{contact.emailNormalized}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {contact.organisation || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {contact.country || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {contact.tagsJson && contact.tagsJson.length > 0 ? (
                          contact.tagsJson.map((t: string) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] border border-slate-200 font-medium"
                            >
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {contact.isSuppressed ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Suppressed</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Eligible</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSuppression(contact.id, contact.isSuppressed);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                          contact.isSuppressed
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-semibold text-slate-900">CSV Contact Importer</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste raw CSV text or click a sample dataset. Automatic header detection supports Name,
              Email, Company, Country, Tags, and Suppression flags.
            </p>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Quick Fixtures:</span>
              <button
                onClick={() => loadSampleCSV(5)}
                className="px-2.5 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition font-medium"
              >
                5 Sample Contacts
              </button>
              <button
                onClick={() => loadSampleCSV(100)}
                className="px-2.5 py-1 text-xs rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold transition"
              >
                100 Contacts Bulk Dataset
              </button>
            </div>

            <textarea
              rows={8}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              placeholder="Name,Email,Company,Country,Tags..."
              className="w-full p-3 font-mono text-xs rounded-md bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            {/* Import Results Box */}
            {importResult && (
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs">
                <div className="font-semibold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Import Complete (Batch: {importResult.batchId})
                </div>
                <div className="grid grid-cols-4 gap-2 text-center pt-1">
                  <div className="bg-white border border-slate-200 p-2 rounded shadow-sm">
                    <div className="text-slate-500 text-[10px]">Total Parsed</div>
                    <div className="font-bold text-slate-900">{importResult.totalRows}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-2 rounded shadow-sm">
                    <div className="text-emerald-700 text-[10px]">Imported</div>
                    <div className="font-bold text-emerald-700">{importResult.importedCount}</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-2 rounded shadow-sm">
                    <div className="text-amber-800 text-[10px]">Duplicates Skipped</div>
                    <div className="font-bold text-amber-800">{importResult.duplicateCount}</div>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-2 rounded shadow-sm">
                    <div className="text-rose-700 text-[10px]">Suppressed</div>
                    <div className="font-bold text-rose-700">{importResult.suppressedCount}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Close
              </button>
              <button
                onClick={handleImport}
                disabled={importLoading || !csvInput.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50 shadow-sm"
              >
                {importLoading ? 'Processing...' : 'Start Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact & Relationship Detail Drawer */}
      {selectedContactId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex justify-end">
          <div className="w-full max-w-lg bg-white border-l border-slate-200 p-6 space-y-6 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h3 className="text-base font-semibold text-slate-900">Relationship Memory</h3>
              </div>
              <button
                onClick={() => {
                  setSelectedContactId(null);
                  setSelectedProfile(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {profileLoading || !selectedProfile ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading profile...</div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* Contact Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{selectedProfile.contact.name}</div>
                      <div className="text-slate-500">{selectedProfile.contact.emailNormalized}</div>
                    </div>
                    {selectedProfile.contact.isSuppressed ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        Suppressed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Eligible
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-700 pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-slate-400 font-medium">Organisation:</span>{' '}
                      {selectedProfile.contact.organisation || 'N/A'}
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Country:</span>{' '}
                      {selectedProfile.contact.country || 'N/A'}
                    </div>
                  </div>

                  {/* Provenance */}
                  {selectedProfile.contact.sourceJson && (
                    <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-400 font-medium">Provenance:</span>{' '}
                      {JSON.stringify(selectedProfile.contact.sourceJson)}
                    </div>
                  )}

                  {selectedProfile.contact.isSuppressed && (
                    <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                      Reason: {selectedProfile.contact.suppressionReason || 'Unknown'}
                    </div>
                  )}
                </div>

                {/* Relationship State */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Relationship Context</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Stage: {selectedProfile.relationship?.stage || 'NEW'}
                    </span>
                  </div>

                  <div className="text-slate-800 bg-white p-2.5 rounded border border-slate-200">
                    <div className="text-[11px] text-slate-400 font-medium">Memory Summary:</div>
                    <div className="mt-1 leading-relaxed">
                      {selectedProfile.relationship?.summary || 'No conversations recorded yet.'}
                    </div>
                  </div>

                  {selectedProfile.relationship?.factsJson?.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-slate-700 mb-1">Verified Facts:</div>
                      <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px]">
                        {selectedProfile.relationship.factsJson.map((f: string, idx: number) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-slate-900">Event Log & Audit Trail</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedProfile.events?.length === 0 ? (
                      <div className="text-slate-500 text-center py-4">No logged events yet.</div>
                    ) : (
                      selectedProfile.events.map((evt: any) => (
                        <div
                          key={evt.id}
                          className="p-2.5 rounded border border-slate-200 bg-white text-[11px] flex items-center justify-between shadow-sm"
                        >
                          <div>
                            <span className="font-semibold text-indigo-600">{evt.eventType}</span>
                            <span className="text-slate-500 ml-2">
                              {JSON.stringify(evt.payloadJson)}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">
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
