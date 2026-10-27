import type { components } from '../../../lib/api';

type Entry = components['schemas']['Entry'];

const DIRECT = { id: '00000000-0000-4000-8000-0000000000c1', name: 'Individual Counseling', group: 'direct' } as const;
const INDIRECT = { id: '00000000-0000-4000-8000-0000000000c2', name: 'Staff Meetings', group: 'indirect' } as const;
const SUPERVISION = {
  id: '00000000-0000-4000-8000-0000000000c4',
  name: 'Individual Supervision',
  group: 'supervision',
} as const;

/** One fictional entry (FE-70); override only what a test cares about. */
export function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '00000000-0000-4000-8000-0000000000e1',
    session_date: '2026-01-05',
    start_time: '09:00',
    end_time: '10:00',
    duration_minutes: 60,
    hours: 1,
    category: DIRECT,
    clients: [],
    on_site: false,
    status: 'approved',
    needs_time: false,
    created_at: '2026-01-05T17:00:00Z',
    updated_at: '2026-01-05T17:00:00Z',
    ...overrides,
  };
}

export const categories = { DIRECT, INDIRECT, SUPERVISION };

/** A legacy entry imported without times: it has hours but no `start_time` or `end_time`. */
export function legacyEntry(overrides: Partial<Entry> = {}): Entry {
  const legacy = entry({ needs_time: true, ...overrides });
  Reflect.deleteProperty(legacy, 'start_time');
  Reflect.deleteProperty(legacy, 'end_time');
  return legacy;
}
