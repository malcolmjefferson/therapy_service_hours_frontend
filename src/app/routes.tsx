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
        lazy: async () => {
          const { StatusPage } = await import('../features/status');
          return { Component: StatusPage };
        },
      },
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
