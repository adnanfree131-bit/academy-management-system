import { describe, expect, it } from 'vitest';
import { countRealAcademies, wouldWipeAcademies } from '../src/services/store-persist.js';

function tenantEntry(slug: string, isPlatform = false) {
  return [
    `id-${slug}`,
    {
      slug,
      settings: isPlatform ? { is_platform: true } : { is_platform: false },
    },
  ];
}

describe('free-tier snapshot guards', () => {
  it('counts real academies and ignores the platform tenant', () => {
    const payload = {
      tenants: [tenantEntry('app', true), tenantEntry('alpha'), tenantEntry('beta')],
    };
    expect(countRealAcademies(payload)).toBe(2);
  });

  it('treats a missing snapshot as zero academies', () => {
    expect(countRealAcademies(null)).toBe(0);
    expect(countRealAcademies({})).toBe(0);
  });

  it('refuses a save that would replace live academies with an empty snapshot', () => {
    expect(wouldWipeAcademies(4, 0)).toBe(true);
    expect(wouldWipeAcademies(1, 0)).toBe(true);
  });

  it('allows the first save and later saves that keep academies', () => {
    expect(wouldWipeAcademies(0, 0)).toBe(false);
    expect(wouldWipeAcademies(0, 1)).toBe(false);
    expect(wouldWipeAcademies(4, 10)).toBe(false);
    expect(wouldWipeAcademies(4, 3)).toBe(false);
  });
});
