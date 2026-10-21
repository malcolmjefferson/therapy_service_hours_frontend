import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useProfileQuery } from '../api/useProfileQuery';
import { AccessDenied } from './AccessDenied';
import styles from './AuthView.module.css';

function CurrentProfile() {
  const { session } = useAuth();
  const profile = useProfileQuery();
  const cache = useQueryClient();
  useEffect(() => {
    if (profile.error?.status === 403) {
      session.invalidate('denied');
      cache.clear();
    }
  }, [profile.error, session, cache]);
  if (profile.isPending) return <p role="status">Loading your profile…</p>;
  if (profile.error?.status === 403) return <AccessDenied />;
  if (profile.error)
    return (
      <section role="alert">
        <h2>Your profile could not be loaded</h2>
        <button
          type="button"
          onClick={() => {
            void profile.refetch();
          }}
        >
          Try again
        </button>
      </section>
    );
  return (
    <section className={styles.panel} aria-labelledby="profile-title">
      <h2 id="profile-title">Welcome, {profile.data.name || profile.data.email}</h2>
      <p>{profile.data.organization.name}</p>
      <p>{profile.data.roles.length ? `Roles: ${profile.data.roles.join(', ')}` : 'Clinical hours account'}</p>
      <p>
        <Link to="/app/entries">Your entries</Link>
      </p>
    </section>
  );
}

/** Shows `children` only to a signed-in user; everyone else is sent to sign in, the start page or the access-denied page. */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { session, state } = useAuth();
  useEffect(() => {
    if (session.config.enabled && state === 'signed-out') void session.signIn(true);
  }, [session, state]);
  if (!session.config.enabled) return <Navigate to="/" replace />;
  if (state === 'denied') return <Navigate to="/access-denied" replace />;
  if (state === 'error' || state === 'expired') return <Navigate to="/" replace />;
  if (state !== 'signed-in') return <p role="status">Returning to sign-in…</p>;
  return children;
}

export function AuthenticatedHome() {
  return (
    <RequireSignIn>
      <CurrentProfile />
    </RequireSignIn>
  );
}
