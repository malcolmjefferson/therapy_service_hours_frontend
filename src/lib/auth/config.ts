/** Public deployment settings. This file never contains a client secret or test credentials. */
export type AuthConfig =
  | { enabled: false }
  | {
      enabled: true;
      hostedUiOrigin: string;
      clientId: string;
      issuer: string;
      callbackUrl: string;
      logoutUrl: string;
    };

export function parseAuthConfig(value: unknown, origin: string): AuthConfig {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid sign-in configuration');
  const config = value as Record<string, unknown>;
  if (config.enabled === false && Object.keys(config).length === 1) return { enabled: false };
  if (
    config.enabled !== true ||
    Object.keys(config).length !== 6 ||
    typeof config.hostedUiOrigin !== 'string' ||
    !/^https:\/\/[a-z0-9-]+\.auth\.us-west-2\.amazoncognito\.com$/.test(config.hostedUiOrigin) ||
    typeof config.clientId !== 'string' ||
    !/^[a-z0-9]{1,128}$/.test(config.clientId) ||
    typeof config.issuer !== 'string' ||
    !/^https:\/\/cognito-idp\.us-west-2\.amazonaws\.com\/us-west-2_[A-Za-z0-9]+$/.test(config.issuer) ||
    config.callbackUrl !== new URL('/auth/callback', origin).href ||
    config.logoutUrl !== new URL('/', origin).href
  )
    throw new Error('Invalid sign-in configuration');
  return {
    enabled: true,
    hostedUiOrigin: config.hostedUiOrigin,
    clientId: config.clientId,
    issuer: config.issuer,
    callbackUrl: config.callbackUrl,
    logoutUrl: config.logoutUrl,
  };
}

export async function loadAuthConfig(origin: string, fetchImpl: typeof fetch = fetch): Promise<AuthConfig> {
  const response = await fetchImpl(new URL('/auth-config.json', origin), {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('Sign-in configuration is unavailable');
  return parseAuthConfig((await response.json()) as unknown, origin);
}
