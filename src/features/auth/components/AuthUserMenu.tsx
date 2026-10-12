import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useProfileQuery } from '../api/useProfileQuery';
import styles from './AuthView.module.css';

function CurrentUserMenu() {
  const { session } = useAuth();
  const profile = useProfileQuery();
  const cache = useQueryClient();
  const current = profile.error ? undefined : profile.data;
  return (
    <details className={styles.account}>
      <summary>{current ? `Account: ${current.name || current.email}` : 'Account'}</summary>
      {current && <p>{current.organization.name}</p>}
      <button
        className={styles.button}
        type="button"
        onClick={() => {
          cache.clear();
          void session.signOut().catch(() => {
            session.invalidate('error');
          });
        }}
      >
        Sign out
      </button>
    </details>
  );
}

export function AuthUserMenu() {
  const { state } = useAuth();
  return state === 'signed-in' ? <CurrentUserMenu /> : null;
}
