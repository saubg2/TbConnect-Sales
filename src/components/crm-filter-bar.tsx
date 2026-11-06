'use client';

import { Check, ChevronDown, Filter, Search, X } from 'lucide-react';

type Option = { value: string; label: string };
type Props = {
  search: string; onSearchChange: (value: string) => void;
  countries: Option[]; selectedCountries: string[]; onCountriesChange: (value: string[]) => void;
  organizations: Option[]; selectedOrganizations: string[]; onOrganizationsChange: (value: string[]) => void;
  types: Option[]; selectedTypes: string[]; onTypesChange: (value: string[]) => void;
  statuses: Option[]; selectedStatuses: string[]; onStatusesChange: (value: string[]) => void;
  resultCount: number;
};

function MultiSelect({ label, options, selected, onChange }: { label: string; options: Option[]; selected: string[]; onChange: (values: string[]) => void }) {
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]);
  return (
    <details className="group relative">
      <summary className="flex min-w-36 cursor-pointer list-none items-center justify-between gap-2 bg-white px-2.5 py-1.5 text-xs font-semibold outline outline-1 outline-[#d8d3c9]">
        <span>{selected.length ? `${label} (${selected.length})` : `All ${label.toLowerCase()}`}</span>
        <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-[calc(100%+4px)] z-40 max-h-64 min-w-56 overflow-auto bg-[#fffefa] p-1.5 shadow-lg ring-1 ring-black/10">
        {options.map(option => {
          const checked = selected.includes(option.value);
          return <button type="button" key={option.value} onClick={() => toggle(option.value)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-[#f2eee5]">
            <span className={`flex h-3.5 w-3.5 items-center justify-center ${checked ? 'bg-black text-white' : 'ring-1 ring-[#cfc9bd]'}`}>
              {checked && <Check className="h-3 w-3" />}
            </span>
            <span className="whitespace-nowrap">{option.label}</span>
          </button>;
        })}
      </div>
    </details>
  );
}

export function CrmFilterBar(props: Props) {
  const hasFilters = !!props.search || props.selectedCountries.length > 0 || props.selectedOrganizations.length > 0 || props.selectedTypes.length > 0 || props.selectedStatuses.length > 0;
  const clear = () => {
    props.onSearchChange(''); props.onCountriesChange([]); props.onOrganizationsChange([]); props.onTypesChange([]); props.onStatusesChange([]);
  };
  return <div className="flex flex-wrap items-center gap-2 bg-[#f6f2e9] p-2">
    <div className="flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-wider text-neutral-600"><Filter className="h-3.5 w-3.5" /> Filters</div>
    <label className="relative min-w-[240px] flex-1">
      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-500" />
      <input value={props.search} onChange={event => props.onSearchChange(event.target.value)} placeholder="Search name, email or organization..." className="w-full bg-white py-1.5 pl-8 pr-3 text-xs outline outline-1 outline-[#d8d3c9]" />
    </label>
    <MultiSelect label="Countries" options={props.countries} selected={props.selectedCountries} onChange={props.onCountriesChange} />
    <MultiSelect label="Organizations" options={props.organizations} selected={props.selectedOrganizations} onChange={props.onOrganizationsChange} />
    <MultiSelect label="Types" options={props.types} selected={props.selectedTypes} onChange={props.onTypesChange} />
    <MultiSelect label="Statuses" options={props.statuses} selected={props.selectedStatuses} onChange={props.onStatusesChange} />
    <span className="px-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">{props.resultCount} results</span>
    {hasFilters && <button onClick={clear} className="flex items-center gap-1 bg-[#f7e8e5] px-2 py-1.5 text-[10px] font-black uppercase"><X className="h-3 w-3" /> Clear</button>}
  </div>;
}
