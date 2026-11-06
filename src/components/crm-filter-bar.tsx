'use client';

import { Filter, Search, X } from 'lucide-react';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  country: string;
  onCountryChange: (value: string) => void;
  organization: string;
  onOrganizationChange: (value: string) => void;
  status: 'all' | 'active' | 'suppressed';
  onStatusChange: (value: 'all' | 'active' | 'suppressed') => void;
  countries: string[];
  organizations: string[];
  type: string;
  onTypeChange: (value: string) => void;
  types: string[];
  resultCount: number;
};

export function CrmFilterBar(props: Props) {
  const hasFilters = !!props.search || !!props.country || !!props.organization || !!props.type || props.status !== 'all';
  const clear = () => {
    props.onSearchChange('');
    props.onCountryChange('');
    props.onOrganizationChange('');
    props.onTypeChange('');
    props.onStatusChange('all');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 bg-[#f6f2e9] p-2">
      <div className="flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-wider text-neutral-600">
        <Filter className="h-3.5 w-3.5" /> Filters
      </div>
      <label className="relative min-w-[240px] flex-1">
        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-500" />
        <input
          value={props.search}
          onChange={event => props.onSearchChange(event.target.value)}
          placeholder="Search name, email or organization..."
          className="w-full border border-[#b8b4aa] bg-white py-1.5 pl-8 pr-3 text-xs outline-none"
        />
      </label>
      <select value={props.country} onChange={event => props.onCountryChange(event.target.value)} className="max-w-44 border px-2 py-1.5 text-xs font-semibold">
        <option value="">All countries</option>
        <option value="__unknown__">Unknown country</option>
        {props.countries.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <select value={props.organization} onChange={event => props.onOrganizationChange(event.target.value)} className="max-w-56 border px-2 py-1.5 text-xs font-semibold">
        <option value="">All organizations</option>
        <option value="__unknown__">No organization</option>
        {props.organizations.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <select value={props.type} onChange={event => props.onTypeChange(event.target.value)} className="max-w-44 border px-2 py-1.5 text-xs font-semibold">
        <option value="">All types</option>
        {props.types.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
      <select value={props.status} onChange={event => props.onStatusChange(event.target.value as Props['status'])} className="border px-2 py-1.5 text-xs font-semibold">
        <option value="all">All statuses</option>
        <option value="active">Eligible</option>
        <option value="suppressed">Suppressed</option>
      </select>
      <span className="px-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">{props.resultCount} results</span>
      {hasFilters && (
        <button onClick={clear} className="flex items-center gap-1 border border-[#b8b4aa] bg-[#fbeceb] px-2 py-1.5 text-[10px] font-black uppercase">
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}
