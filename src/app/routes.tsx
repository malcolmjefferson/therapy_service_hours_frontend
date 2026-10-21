import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import { RouteError } from './RouteError';

/**
 * Route table. Pages load lazily so each feature is its own chunk (FE-54). Unknown paths render
 * the 404 view inside the shell; CloudFront rewrites deep links to index.html (ADR-0004).
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        errorElement: <RouteError />,
        lazy: async () => ({ Component: (await import('../features/auth')).AuthLanding }),
      },
      { path: 'auth/callback', lazy: async () => ({ Component: (await import('../features/auth')).AuthCallback }) },
      { path: 'access-denied', lazy: async () => ({ Component: (await import('../features/auth')).AccessDenied }) },
      { path: 'app/entries', lazy: async () => ({ Component: (await import('./EntriesRoute')).EntriesRoute }) },
      { path: 'app', lazy: async () => ({ Component: (await import('../features/auth')).AuthenticatedHome }) },
      {
        path: '*',
        loader: () => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router's documented 404 signal.
          throw new Response('Not Found', { status: 404 });
        },
        errorElement: <RouteError />,
      },
    ],
  },
];
