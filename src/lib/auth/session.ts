import type { AuthConfig } from './config';

export type SessionState = 'signed-out' | 'redirecting' | 'signed-in' | 'signing-out' | 'expired' | 'denied' | 'error';
interface Tokens {
  id: string;
  refresh: string;
  expires: number;
}
interface Transaction {
  state: string;
  verifier: string;
  nonce: string;
  created: number;
}
export interface SessionDependencies {
  crypto: Crypto;
  storage: Storage;
  fetch: typeof fetch;
  now: () => number;
  navigate: (url: string) => void;
  cleanCallback: () => void;
}
export const TRANSACTION_KEY = 'therapy-sign-in-transaction';

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/** Tokens live only in this instance. Storage contains only the short-lived PKCE transaction. */
export class AuthSession {
  private state: SessionState = 'signed-out';
  private tokens: Tokens | undefined;
  private generation = 0;
  private listeners = new Set<() => void>();
  private refreshing: Promise<string | undefined> | undefined;
  private completion: Promise<void> | undefined;
  readonly config: AuthConfig;
  private readonly deps: SessionDependencies;
  constructor(config: AuthConfig, deps: SessionDependencies) {
    this.config = config;
    this.deps = deps;
  }
  getSnapshot = (): SessionState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: SessionState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  private clearTransaction(): void {
    try {
      this.deps.storage.removeItem(TRANSACTION_KEY);
    } catch {
      /* Storage may be blocked; no tokens are persisted. */
    }
  }
  invalidate = (state: SessionState = 'expired'): void => {
    this.generation++;
    this.tokens = undefined;
    this.publish(state);
  };

  async signIn(resume = false): Promise<void> {
    if (!this.config.enabled || this.state === 'redirecting' || this.state === 'signing-out') return;
    this.invalidate('redirecting');
    this.completion = undefined;
    const generation = this.generation;
    const random = (): string => base64url(this.deps.crypto.getRandomValues(new Uint8Array(32)));
    const transaction: Transaction = { state: random(), verifier: random(), nonce: random(), created: this.deps.now() };
    try {
      const digest = await this.deps.crypto.subtle.digest('SHA-256', new TextEncoder().encode(transaction.verifier));
      if (generation !== this.generation) return;
      this.deps.storage.setItem(TRANSACTION_KEY, JSON.stringify(transaction));
      const url = new URL('/oauth2/authorize', this.config.hostedUiOrigin);
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: this.config.clientId,
        redirect_uri: this.config.callbackUrl,
        scope: 'openid email profile',
        state: transaction.state,
        nonce: transaction.nonce,
        code_challenge_method: 'S256',
        code_challenge: base64url(new Uint8Array(digest)),
        ...(!resume ? { identity_provider: 'Google' } : {}),
      }).toString();
      // Classic hosted UI reuses its session cookie. prompt=none is managed-login-only.
      this.deps.navigate(url.href);
    } catch {
      if (generation === this.generation) {
        this.clearTransaction();
        this.publish('error');
      }
    }
  }

  complete(url: string): Promise<void> {
    // React StrictMode must not exchange the same one-use code twice.
    this.completion ??= this.finish(url);
    return this.completion;
  }

  private async finish(url: string): Promise<void> {
    if (!this.config.enabled) {
      this.deps.cleanCallback();
      this.invalidate('denied');
      return;
    }
    const generation = this.generation;
    let transaction: Transaction | undefined;
    let params: URLSearchParams;
    try {
      this.deps.cleanCallback();
      const callback = new URL(url);
      if (callback.origin + callback.pathname !== this.config.callbackUrl || callback.hash)
        throw new Error('Invalid callback');
      params = callback.searchParams;
      const raw = this.deps.storage.getItem(TRANSACTION_KEY);
      this.clearTransaction();
      const value: unknown = raw ? JSON.parse(raw) : undefined;
      if (typeof value !== 'object' || value === null) throw new Error('Invalid sign-in transaction');
      const txn = value as Record<string, unknown>;
      if (
        typeof txn.state !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(txn.state) ||
        typeof txn.verifier !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(txn.verifier) ||
        typeof txn.nonce !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(txn.nonce) ||
        typeof txn.created !== 'number' ||
        this.deps.now() - txn.created > 600_000 ||
        txn.created > this.deps.now() ||
        params.getAll('state').length !== 1 ||
        params.get('state') !== txn.state
      )
        throw new Error('Invalid sign-in transaction');
      transaction = { state: txn.state, verifier: txn.verifier, nonce: txn.nonce, created: txn.created };
      if (
        params.has('error') ||
        params.has('error_description') ||
        params.getAll('code').length !== 1 ||
        !params.get('code')
      )
        throw new Error('Sign-in denied');
    } catch {
      this.clearTransaction();
      this.invalidate('denied');
      return;
    }
    try {
      const tokens = await this.exchange(
        {
          grant_type: 'authorization_code',
          code: params.get('code') ?? '',
          redirect_uri: this.config.callbackUrl,
          code_verifier: transaction.verifier,
        },
        transaction.nonce,
      );
      if (generation === this.generation) {
        this.tokens = tokens;
        this.publish('signed-in');
      }
    } catch {
      this.invalidate('error');
    }
  }

  private async exchange(parameters: Record<string, string>, nonce?: string): Promise<Tokens> {
    if (!this.config.enabled) throw new Error('Sign-in unavailable');
    const response = await this.deps.fetch(new URL('/oauth2/token', this.config.hostedUiOrigin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...parameters, client_id: this.config.clientId }),
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Session unavailable');
    const value: unknown = await response.json();
    if (typeof value !== 'object' || value === null) throw new Error('Invalid session');
    const result = value as Record<string, unknown>;
    if (
      typeof result.id_token !== 'string' ||
      result.id_token.length > 16384 ||
      typeof result.expires_in !== 'number' ||
      !Number.isFinite(result.expires_in) ||
      result.expires_in <= 0 ||
      result.expires_in > 3600 ||
      result.token_type !== 'Bearer'
    )
      throw new Error('Invalid session');
    const parts = result.id_token.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new Error('Invalid session');
    const header: unknown = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof header !== 'object' || header === null || !('alg' in header) || header.alg !== 'RS256')
      throw new Error('Invalid session');
    const decoded: unknown = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof decoded !== 'object' || decoded === null) throw new Error('Invalid session');
    const claims = decoded as Record<string, unknown>;
    if (
      claims.iss !== this.config.issuer ||
      claims.aud !== this.config.clientId ||
      claims.token_use !== 'id' ||
      typeof claims.exp !== 'number' ||
      !Number.isFinite(claims.exp) ||
      claims.exp * 1000 <= this.deps.now() ||
      (nonce !== undefined && claims.nonce !== nonce)
    )
      throw new Error('Invalid session');
    const refresh = typeof result.refresh_token === 'string' ? result.refresh_token : this.tokens?.refresh;
    if (!refresh) throw new Error('Invalid session');
    // Claims here validate the OAuth exchange only. Roles always come from /me.
    return {
      id: result.id_token,
      refresh,
      expires: Math.min(claims.exp * 1000, this.deps.now() + result.expires_in * 1000),
    };
  }

  async getIdToken(): Promise<string | undefined> {
    if (!this.tokens) return undefined;
    if (this.tokens.expires > this.deps.now() + 30_000) return this.tokens.id;
    if (!this.refreshing) {
      const generation = this.generation;
      const refresh = this.tokens.refresh;
      this.refreshing = this.exchange({ grant_type: 'refresh_token', refresh_token: refresh })
        .then((tokens) => {
          if (generation !== this.generation) return undefined;
          this.tokens = tokens;
          return tokens.id;
        })
        .catch(() => {
          if (generation === this.generation) this.invalidate();
          return undefined;
        })
        .finally(() => {
          this.refreshing = undefined;
        });
    }
    return this.refreshing;
  }

  async signOut(): Promise<void> {
    const refresh = this.tokens?.refresh;
    this.invalidate('signing-out');
    this.clearTransaction();
    if (!this.config.enabled) return;
    try {
      if (refresh) {
        const response = await this.deps.fetch(new URL('/oauth2/revoke', this.config.hostedUiOrigin), {
          method: 'POST',
          body: new URLSearchParams({ token: refresh, client_id: this.config.clientId }),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error('Session revocation failed');
      }
    } finally {
      const url = new URL('/logout', this.config.hostedUiOrigin);
      url.search = new URLSearchParams({
        client_id: this.config.clientId,
        logout_uri: this.config.logoutUrl,
      }).toString();
      this.deps.navigate(url.href);
    }
  }
}

export function browserSession(config: AuthConfig): AuthSession {
  return new AuthSession(config, {
    crypto: window.crypto,
    storage: window.sessionStorage,
    fetch: window.fetch.bind(window),
    now: Date.now,
    navigate: (url) => {
      window.location.assign(url);
    },
    cleanCallback: () => {
      window.history.replaceState(null, '', '/auth/callback');
    },
  });
}
