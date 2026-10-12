import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { nativeSession } from '../e2e/native-client.ts';

const cli = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ execFileSync: cli, default: { execFileSync: cli } }));
const issuer = 'https://cognito-idp.us-west-2.amazonaws.com/us-west-2_Fixture';
let requests;
let directories;

beforeEach(() => {
  requests = [];
  directories = [];
  vi.stubEnv('APP_ENV', 'dev');
  vi.stubEnv('AUTH_ENABLED', 'true');
  vi.stubEnv('USER_POOL_ID', 'us-west-2_Fixture');
  vi.stubEnv('TEST_CLIENT_ID', 'fixtureclient');
  vi.stubEnv(
    'TEST_CREDENTIALS_ARN',
    'arn:aws:secretsmanager:us-west-2:123456789012:secret:therapy-service-hours-dev-auth-test-users-fixture',
  );
  vi.stubEnv('SMOKE_READER_ROLE_ARN', '');
  cli.mockReset();
  cli.mockImplementation((_binary, args) => {
    const path = args[args.indexOf('--cli-input-json') + 1].slice('file://'.length);
    directories.push(dirname(path));
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600);
    const input = JSON.parse(readFileSync(path, 'utf8'));
    requests.push({ operation: args[1], input });
    expect(args.join(' ')).not.toContain('fictional-private-');
    switch (args[1]) {
      case 'describe-user-pool-client':
        return JSON.stringify({
          UserPoolClient: {
            ClientName: 'therapy-service-hours-dev-test-only',
            UserPoolId: 'us-west-2_Fixture',
            SupportedIdentityProviders: ['COGNITO'],
            ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH'],
          },
        });
      case 'get-secret-value':
        return JSON.stringify({ SecretString: JSON.stringify({ password: 'fictional-private-password' }) });
      case 'initiate-auth':
        return JSON.stringify({
          AuthenticationResult: { IdToken: 'fictional-private-id', RefreshToken: 'fictional-private-refresh' },
        });
      case 'revoke-token':
        return '{}';
      default:
        throw new Error('Unexpected CLI operation');
    }
  });
});

afterEach(() => {
  for (const directory of directories) expect(existsSync(directory)).toBe(false);
  vi.unstubAllEnvs();
});

test('native fixtures authenticate without putting credentials in process arguments and revoke the same session', () => {
  const session = nativeSession('test-invited', issuer);
  expect(session.idToken).toBe('fictional-private-id');
  session.revoke();
  const login = requests.find((request) => request.operation === 'initiate-auth');
  expect(login.input.AuthParameters).toEqual({ USERNAME: 'test-invited', PASSWORD: 'fictional-private-password' });
  expect(requests.at(-1).input).toEqual({ ClientId: 'fixtureclient', Token: 'fictional-private-refresh' });
});

test.each(['prod', ''])('refuses %s environment before retrieving credentials', (environment) => {
  vi.stubEnv('APP_ENV', environment);
  expect(() => nativeSession('test-uninvited', issuer)).toThrow('DEV_AUTH_ONLY');
  expect(cli).not.toHaveBeenCalled();
});

test('refuses a foreign issuer before any CLI operation', () => {
  expect(() => nativeSession('test-invited', issuer.replace('Fixture', 'Other'))).toThrow('DEV_AUTH_TARGET_MISMATCH');
  expect(cli).not.toHaveBeenCalled();
});

test('raw CLI output cannot escape a test failure', () => {
  cli.mockImplementation(() => {
    throw new Error('fictional-private-password and token output');
  });
  expect(() => nativeSession('test-invited', issuer)).toThrow('DEV_AUTH_AWS_CALL_FAILED');
});

test('malformed credential JSON is redacted', () => {
  const normal = cli.getMockImplementation();
  cli.mockImplementation((binary, args) =>
    args[1] === 'get-secret-value'
      ? JSON.stringify({ SecretString: 'fictional-private-password is invalid JSON' })
      : normal(binary, args),
  );
  expect(() => nativeSession('test-invited', issuer)).toThrow('DEV_AUTH_INVALID_CREDENTIALS');
});
