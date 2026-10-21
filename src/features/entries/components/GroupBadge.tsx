import { Badge, type BadgeTone } from '../../../components';
import type { components } from '../../../lib/api';

type CategoryGroup = components['schemas']['CategoryGroup'];

// Direct = gold, Indirect = lime, Supervision = red (CLAUDE.md §12.2). A new group in the spec fails tsc here (FE-29).
const groupBadge = {
  direct: { label: 'Direct Service', tone: 'gold' },
  indirect: { label: 'Indirect Service', tone: 'lime' },
  supervision: { label: 'Supervision', tone: 'red' },
} as const satisfies Record<CategoryGroup, { label: string; tone: BadgeTone }>;

/** The category group as a colored label; the text carries the meaning. */
export function GroupBadge({ group }: { group: CategoryGroup }) {
  const { label, tone } = groupBadge[group];
  return <Badge tone={tone}>{label}</Badge>;
}
