'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  KanbanSquare,
  Upload,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { CrmFilterBar } from '@/components/crm-filter-bar';

type CrmTab = 'contacts' | 'organizations' | 'pipeline';
const canonicalOrganization = (value: unknown) => String(value || '').normalize('NFKD').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const cleanOrganizationName = (value: unknown) => String(value || '').trim()
  .replace(/\s*[-–—]+\s*/g, ' ').replace(/\s+/g, ' ');
type OrganizationSummary = {
  id: string | null;
  name: string;
  type: string;
  website: string | null;
  address: string | null;
  owner: string | null;
  phone: string | null;
  notes: string | null;
  contacts: number;
  countries: Set<string>;
  active: number;
  stages: Set<string>;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [countryFilters, setCountryFilters] = useState<string[]>([]);
  const [organizationFilters, setOrganizationFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<CrmTab>('contacts');

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
      const res = await fetch('/api/contacts/crm?workspaceId=ws_default');
      const data = await res.json();
      if (data && data.records) {
        setContacts(data.records);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

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

  const visibleContacts = contacts.filter((contact) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [contact.name, contact.emailNormalized, contact.organisation, contact.country]
      .some(value => String(value || '').toLowerCase().includes(query));
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(contact.isSuppressed ? 'suppressed' : 'active');
    const effectiveCountry = contact.country || '';
    const matchesCountry = countryFilters.length === 0 || countryFilters.includes(effectiveCountry || '__unknown__');
    const organizationKey = contact.organisation ? canonicalOrganization(contact.organisation) : '__unknown__';
    const matchesOrganization = organizationFilters.length === 0 || organizationFilters.includes(organizationKey);
    const matchesType = typeFilters.length === 0 || typeFilters.includes(contact.organizationType || 'Other');
    return matchesSearch && matchesStatus && matchesCountry && matchesOrganization && matchesType;
  });

  const countryOptions = ['__unknown__', ...Array.from(new Set(contacts
    .map(contact => contact.country)
    .filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b))]
    .map(value => ({ value, label: value === '__unknown__' ? 'Unknown country' : value }));
  const organizationLabels = contacts.reduce<Map<string, string>>((map, contact) => {
    if (contact.organisation) {
      const key = canonicalOrganization(contact.organisation);
      if (!map.has(key)) map.set(key, cleanOrganizationName(contact.organisation));
    }
    return map;
  }, new Map());
  const organizationOptions = [{ value: '__unknown__', label: 'No organization' }, ...Array.from(organizationLabels)
    .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))];
  const typeOptions = Array.from(new Set(contacts
    .map(contact => contact.organizationType || 'Other')
    .filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)).map(value => ({ value, label: value }));

  const organizationMap = visibleContacts.reduce<Map<string, OrganizationSummary>>((grouped, contact) => {
    const name = contact.organisation
      ? (organizationLabels.get(canonicalOrganization(contact.organisation)) || cleanOrganizationName(contact.organisation))
      : 'No organization';
    const country = contact.country || 'Unknown';
    const groupKey = `${canonicalOrganization(name) || '__unknown__'}::${country.toLowerCase()}`;
    const current = grouped.get(groupKey) || {
      id: contact.organizationId || null,
      name,
      type: contact.organizationType || 'Other',
      website: contact.organizationWebsite || null,
      address: contact.organizationAddress || null,
      owner: contact.organizationOwner || null,
      phone: contact.organizationPhone || null,
      notes: contact.organizationNotes || null,
      contacts: 0,
      countries: new Set<string>(),
      active: 0,
      stages: new Set<string>(),
    };
    current.contacts += 1;
    if (contact.country) current.countries.add(contact.country);
    if (!contact.isSuppressed) current.active += 1;
    current.stages.add(contact.stage || 'NEW');
    grouped.set(groupKey, current);
    return grouped;
  }, new Map<string, OrganizationSummary>());
  const organizations = Array.from(organizationMap.values())
    .sort((a, b) => b.contacts - a.contacts || a.name.localeCompare(b.name));

  const pipelineStages = [
    { key: 'NEW', label: 'New' },
    { key: 'OUTREACH', label: 'Outreach' },
    { key: 'ENGAGED', label: 'Engaged' },
    { key: 'NEGOTIATING', label: 'Negotiating' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'STALLED,OPTED_OUT', label: 'Stalled / Opted Out' },
  ];

  return (
    <div className="sketch-page min-h-screen bg-white text-black font-sans">
      <AppHeader actions={
        <button
            onClick={() => {
              setShowImportModal(true);
              setImportResult(null);
            }}
            className="flex items-center gap-1.5 border border-black bg-black px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-800"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
      } />

      <main className="w-full px-5 py-4 space-y-3">
        <div className="flex items-end justify-between border-b border-black">
          <div className="flex items-end">
            {([
              ['contacts', 'Contacts', Users],
              ['organizations', 'Organizations', Building2],
              ['pipeline', 'Leads Pipeline', KanbanSquare],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 border-x border-t border-black px-5 py-2 text-xs font-black ${
                  activeTab === key ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="pb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-600">
            {contacts.length} records
          </div>
        </div>

        <CrmFilterBar
          search={search}
          onSearchChange={setSearch}
          countries={countryOptions}
          selectedCountries={countryFilters}
          onCountriesChange={setCountryFilters}
          organizations={organizationOptions}
          selectedOrganizations={organizationFilters}
          onOrganizationsChange={setOrganizationFilters}
          types={typeOptions}
          selectedTypes={typeFilters}
          onTypesChange={setTypeFilters}
          statuses={[{ value: 'active', label: 'Eligible' }, { value: 'suppressed', label: 'Suppressed' }]}
          selectedStatuses={statusFilters}
          onStatusesChange={setStatusFilters}
          resultCount={visibleContacts.length}
        />

        {activeTab === 'contacts' && (
        <div className="max-h-[calc(100vh-180px)] overflow-auto border border-black bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-black bg-neutral-100 text-[10px] font-black uppercase tracking-wider text-black">
              <tr>
                <th className="border-r border-black px-3 py-2">Name</th>
                <th className="border-r border-black px-3 py-2">Email</th>
                <th className="border-r border-black px-3 py-2">Organization</th>
                <th className="border-r border-black px-3 py-2">Country</th>
                <th className="border-r border-black px-3 py-2">Pipeline stage</th>
                <th className="border-r border-black px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleContacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center font-bold text-neutral-500">
                    No contacts match this view.
                  </td>
                </tr>
              ) : (
                visibleContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="cursor-pointer border-b border-black/20 font-medium hover:bg-neutral-100"
                    onClick={() => loadProfile(contact.id)}
                  >
                    <td className="border-r border-black/20 px-3 py-2 font-bold">{contact.name}</td>
                    <td className="border-r border-black/20 px-3 py-2 font-mono text-[11px]">{contact.emailNormalized}</td>
                    <td className="border-r border-black/20 px-3 py-2">{contact.organisation || '—'}</td>
                    <td className="border-r border-black/20 px-3 py-2">{contact.country || 'Unknown'}</td>
                    <td className="border-r border-black/20 px-3 py-2 font-bold">{contact.stage || 'NEW'}</td>
                    <td className="border-r border-black/20 px-3 py-2">
                      <span className={`inline-flex items-center gap-1 border border-black px-1.5 py-0.5 text-[10px] font-bold ${contact.isSuppressed ? 'bg-neutral-200' : 'bg-white'}`}>
                        {contact.isSuppressed ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                        {contact.isSuppressed ? 'Suppressed' : 'Eligible'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSuppression(contact.id, contact.isSuppressed);
                        }}
                        className="border border-black bg-white px-2 py-1 text-[10px] font-bold hover:bg-black hover:text-white"
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
        )}

        {activeTab === 'organizations' && (
          <div className="max-h-[calc(100vh-180px)] overflow-auto border border-black bg-white">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 border-b border-black bg-neutral-100 text-[10px] font-black uppercase tracking-wider">
                <tr>
                  <th className="border-r border-black px-3 py-2">Organization</th>
                  <th className="border-r border-black px-3 py-2">Type</th>
                  <th className="border-r border-black px-3 py-2">Contacts</th>
                  <th className="border-r border-black px-3 py-2">Eligible</th>
                  <th className="border-r border-black px-3 py-2">Countries</th>
                  <th className="border-r border-black px-3 py-2">Website</th>
                  <th className="border-r border-black px-3 py-2">Owner</th>
                  <th className="border-r border-black px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Pipeline coverage</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map(org => (
                  <tr key={`${org.name}-${Array.from(org.countries).join('-') || 'unknown'}`} className="border-b border-black/20 hover:bg-neutral-100">
                    <td className="border-r border-black/20 px-3 py-2 font-bold">{org.name}</td>
                    <td className="border-r border-black/20 px-3 py-2 font-bold">{org.type}</td>
                    <td className="border-r border-black/20 px-3 py-2">{org.contacts}</td>
                    <td className="border-r border-black/20 px-3 py-2">{org.active}</td>
                    <td className="border-r border-black/20 px-3 py-2">{Array.from(org.countries).join(', ') || '—'}</td>
                    <td className="border-r border-black/20 px-3 py-2">{org.website || '—'}</td>
                    <td className="border-r border-black/20 px-3 py-2">{org.owner || '—'}</td>
                    <td className="border-r border-black/20 px-3 py-2">{org.phone || '—'}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{Array.from(org.stages).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="grid min-w-[1100px] grid-cols-6 gap-2 overflow-x-auto pb-3">
            {pipelineStages.map(stage => {
              const keys = stage.key.split(',');
              const records = visibleContacts.filter(contact => keys.includes(contact.stage || 'NEW'));
              return (
                <section key={stage.key} className="min-h-[calc(100vh-190px)] border border-black bg-neutral-50">
                  <header className="border-b border-black bg-white px-3 py-2">
                    <div className="text-xs font-black">{stage.label}</div>
                    <div className="mt-0.5 text-[10px] font-bold text-neutral-500">{records.length} leads</div>
                  </header>
                  <div className="space-y-2 p-2">
                    {records.slice(0, 100).map(contact => (
                      <button
                        key={contact.id}
                        onClick={() => loadProfile(contact.id)}
                        className="block w-full border border-black bg-white p-2 text-left hover:bg-neutral-100"
                      >
                        <div className="truncate text-xs font-black">{contact.organisation || contact.name}</div>
                        <div className="mt-1 truncate text-[11px] font-medium">{contact.name}</div>
                        <div className="mt-1 truncate font-mono text-[9px] text-neutral-600">{contact.emailNormalized}</div>
                      </button>
                    ))}
                    {records.length === 0 && <div className="py-10 text-center text-[10px] font-bold text-neutral-400">Empty stage</div>}
                  </div>
                </section>
              );
            })}
          </div>
        )}
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
