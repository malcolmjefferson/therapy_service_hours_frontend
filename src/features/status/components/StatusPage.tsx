import { useHealthQuery } from '../api/useHealthQuery';
import { StatusView } from './StatusView';

/** Container: wires the health query to the view (FE-10). */
export function StatusPage() {
  const query = useHealthQuery();
  if (query.isPending) {
    return <StatusView state="loading" />;
  }
  if (query.isError) {
    return <StatusView state="error" error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <StatusView state="ok" health={query.data} />;
}
