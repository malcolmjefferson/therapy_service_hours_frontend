import type { ApiError } from '../../../lib/api';
import type { Health } from '../api/useHealthQuery';
import styles from './StatusView.module.css';

export type StatusViewProps =
  { state: 'loading' } | { state: 'error'; error: ApiError; onRetry: () => void } | { state: 'ok'; health: Health };

/** Presentational view of the API status (FE-10). Every state is explicit (FE-33). */
export function StatusView(props: StatusViewProps) {
  return (
    <section className={styles.card} aria-labelledby="status-heading" aria-busy={props.state === 'loading'}>
      <h2 id="status-heading" className={styles.heading}>
        System status
      </h2>
      <StatusBody {...props} />
    </section>
  );
}

function StatusBody(props: StatusViewProps) {
  switch (props.state) {
    case 'loading':
      return <p className={styles.placeholder}>Checking the API…</p>;
    case 'error':
      return (
        <div role="alert" className={styles.error}>
          <p>{describeError(props.error)}</p>
          {props.error.requestId && (
            <p className={styles.meta}>
              Reference: <code>{props.error.requestId}</code>
            </p>
          )}
          <button type="button" className={styles.retry} onClick={props.onRetry}>
            Try again
          </button>
        </div>
      );
    case 'ok':
      return (
        <dl className={styles.facts}>
          <dt>API</dt>
          <dd>
            <span className={styles.ok}>Up</span>
          </dd>
          <dt>Version</dt>
          <dd>
            <code>{props.health.version}</code>
          </dd>
        </dl>
      );
    default: {
      const unreachable: never = props;
      return unreachable;
    }
  }
}

/** Plain-language message for a failed status check (FE-37). Never shows the raw payload. */
function describeError(error: ApiError): string {
  if (error.status === undefined) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  if (error.status >= 500) {
    return 'The API is having a problem right now. Please try again in a moment.';
  }
  return 'The status check was refused. Please reload the page.';
}
