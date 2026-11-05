export type OrganizationType = 'Academic/Hospital' | 'Government' | 'NGO' | 'Private Sector' | 'Other';

export function classifyOrganizationType(name: string): OrganizationType {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  if (/\b(minister|ministry)\b/.test(normalized)
    || /\bnational (tb|tuberculosis) (program|programme)\b/.test(normalized)) {
    return 'Government';
  }

  if (/\b(university|institute|institutet|college|hospital)\b/.test(normalized)) {
    return 'Academic/Hospital';
  }

  if (/\b(ngo|foundation|association|society|charity|non governmental)\b/.test(normalized)) {
    return 'NGO';
  }

  if (/\b(ltd|limited|llc|inc|corporation|corp|company|private)\b/.test(normalized)) {
    return 'Private Sector';
  }

  return 'Other';
}
