import { describe, expect, it } from 'vitest';
import { classifyOrganizationType } from '@/core/organizations/classify';

describe('organization type classification', () => {
  it.each([
    ['University of Delhi', 'Academic/Hospital'],
    ['National Health Institute', 'Academic/Hospital'],
    ['Karolinska Institutet', 'Academic/Hospital'],
    ['Medical College of Pune', 'Academic/Hospital'],
    ['Central Chest Hospital', 'Academic/Hospital'],
    ['Ministry of Health', 'Government'],
    ['Minister of Public Health', 'Government'],
    ['National TB Programme', 'Government'],
  ])('classifies %s as %s', (name, expected) => {
    expect(classifyOrganizationType(name)).toBe(expected);
  });
});
