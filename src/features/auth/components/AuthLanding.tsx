import { Navigate } from 'react-router';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { StatusPage } from '../../status';
import styles from './AuthView.module.css';

export function AuthLanding() {
  const { session, state } = useAuth();
  if (!session.config.enabled) return <StatusPage />;
  if (state === 'signed-in') return <Navigate to="/app" replace />;
  return (
    <section className={styles.panel} aria-labelledby="sign-in-title">
      <h2 id="sign-in-title">Track your clinical hours</h2>
      <p>Sign in with your invited Google account.</p>
      {state === 'expired' && <p role="status">Your session has expired. Please sign in again.</p>}
      {state === 'error' && <p role="alert">Sign-in could not be completed. Please try again.</p>}
      <button
        className={styles.button}
        type="button"
        disabled={state === 'redirecting'}
        onClick={() => {
          void session.signIn();
        }}
      >
        Sign in with Google
      </button>
    </section>
  );
}
