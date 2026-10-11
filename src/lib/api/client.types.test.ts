import { describe, expect, test } from 'vitest';
import { createApiClient } from './client';

// Compile-time contract checks: `npm run typecheck` fails if these expectations stop holding,
// for example when an endpoint is removed from the spec and the types are regenerated (ADR-0006).
describe('typed API client', () => {
  test('only spec paths and their schemas type-check', () => {
    const client = createApiClient('http://localhost:3000', () => Promise.resolve(new Response('{}')));
    const typed = async () => {
      const { data } = await client.GET('/healthz');
      // The response body is the generated HealthResponse type.
      const version: string | undefined = data?.version;
      const { data: me } = await client.GET('/me');
      const organizationName: string | undefined = me?.organization.name;
      const roles: ('admin' | 'supervisor')[] | undefined = me?.roles;
      // @ts-expect-error -- /not-in-spec is not a path in the pinned spec.
      await client.GET('/not-in-spec');
      return { version, organizationName, roles };
    };
    expect(typeof typed).toBe('function');
  });
});
