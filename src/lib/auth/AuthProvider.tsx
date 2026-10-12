import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthSession, browserSession } from './session';

const AuthContext = createContext<AuthSession | null>(null);
export function AuthProvider({ session, children }: { session?: AuthSession | undefined; children: ReactNode }) {
  const [current] = useState(() => session ?? browserSession({ enabled: false }));
  const cache = useQueryClient();
  useEffect(
    () =>
      current.subscribe(() => {
        if (current.getSnapshot() !== 'signed-in') cache.clear();
      }),
    [current, cache],
  );
  return <AuthContext.Provider value={current}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const session = useContext(AuthContext);
  if (session === null) throw new Error('Authentication provider is missing');
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return { session, state };
}
