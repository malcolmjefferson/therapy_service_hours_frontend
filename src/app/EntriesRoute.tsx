import { RequireSignIn } from '../features/auth';
import { EntriesPage } from '../features/entries';

/** `/app/entries`: the add and edit form with the entries table, for signed-in users only. It is its own chunk (FE-54). */
export function EntriesRoute() {
  return (
    <RequireSignIn>
      <EntriesPage />
    </RequireSignIn>
  );
}
