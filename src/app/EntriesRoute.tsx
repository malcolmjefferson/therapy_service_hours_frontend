import { RequireSignIn } from '../features/auth';
import { EntriesPanel } from '../features/entries';

/** `/app/entries`: the entries table, for signed-in users only. It is its own chunk (FE-54). */
export function EntriesRoute() {
  return (
    <RequireSignIn>
      <EntriesPanel />
    </RequireSignIn>
  );
}
