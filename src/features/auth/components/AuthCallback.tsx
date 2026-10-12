import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../lib/auth/AuthProvider';

export function AuthCallback() {
  const { session } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    void session.complete(window.location.href).then(() => {
      if (active) {
        const state = session.getSnapshot();
        void navigate(state === 'signed-in' ? '/app' : state === 'denied' ? '/access-denied' : '/', { replace: true });
      }
    });
    return () => {
      active = false;
    };
  }, [session, navigate]);
  return <p role="status">Completing sign-in…</p>;
}
