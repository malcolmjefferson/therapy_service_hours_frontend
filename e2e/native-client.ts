import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

type NativeUser = 'test-invited' | 'test-uninvited';
interface AuthenticationResult {
  IdToken: string;
  RefreshToken: string;
}

/** Test runner only: private CLI inputs and captured output; never bundled into the SPA. */
function awsCall(env: NodeJS.ProcessEnv, service: string, operation: string, input: object): unknown {
  const directory = mkdtempSync(join(tmpdir(), 'dev-native-e2e-'));
  const safeDirectory = resolve(directory).startsWith(resolve(tmpdir()) + sep);
  if (!safeDirectory) throw new Error('DEV_AUTH_INVALID_TEMP_DIRECTORY');
  chmodSync(directory, 0o700);
  try {
    const request = join(directory, 'request.json');
    writeFileSync(request, JSON.stringify(input), { mode: 0o600 });
    try {
      const output = execFileSync(
        'aws',
        [
          service,
          operation,
          '--region',
          'us-west-2',
          '--cli-input-json',
          `file://${request}`,
          '--output',
          'json',
          '--no-cli-pager',
          '--no-cli-auto-prompt',
        ],
        { env, encoding: 'utf8', timeout: 45_000, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      return JSON.parse(output || '{}') as unknown;
    } catch {
      // CLI failures can contain passwords or tokens. Do not attach their cause/output.
      throw new Error('DEV_AUTH_AWS_CALL_FAILED');
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function nativeSession(username: NativeUser, issuer: string) {
  if (process.env.APP_ENV !== 'dev' || process.env.AUTH_ENABLED !== 'true') throw new Error('DEV_AUTH_ONLY');
  const pool = process.env.USER_POOL_ID;
  const client = process.env.TEST_CLIENT_ID;
  const secret = process.env.TEST_CREDENTIALS_ARN;
  if (
    !pool ||
    issuer !== `https://cognito-idp.us-west-2.amazonaws.com/${pool}` ||
    !client ||
    !/^[a-z0-9]+$/.test(client) ||
    !secret ||
    !/^arn:aws:secretsmanager:us-west-2:\d{12}:secret:therapy-service-hours-dev-auth-test-users-[A-Za-z0-9]+$/.test(
      secret,
    )
  )
    throw new Error('DEV_AUTH_TARGET_MISMATCH');
  const env = { ...process.env };
  const role = env.SMOKE_READER_ROLE_ARN;
  if (role) {
    if (!/^arn:aws:iam::\d{12}:role\/therapy-service-hours-dev-smoke-reader$/.test(role))
      throw new Error('DEV_AUTH_READER_MISMATCH');
    const result = awsCall(env, 'sts', 'assume-role', {
      RoleArn: role,
      RoleSessionName: 'dev-native-browser-e2e',
      DurationSeconds: 900,
    }) as { Credentials: { AccessKeyId: string; SecretAccessKey: string; SessionToken: string } };
    env.AWS_ACCESS_KEY_ID = result.Credentials.AccessKeyId;
    env.AWS_SECRET_ACCESS_KEY = result.Credentials.SecretAccessKey;
    env.AWS_SESSION_TOKEN = result.Credentials.SessionToken;
  }
  const described = awsCall(env, 'cognito-idp', 'describe-user-pool-client', {
    UserPoolId: pool,
    ClientId: client,
  }) as {
    UserPoolClient: {
      ClientName: string;
      UserPoolId: string;
      SupportedIdentityProviders: string[];
      ExplicitAuthFlows: string[];
    };
  };
  const settings = described.UserPoolClient;
  if (
    settings.ClientName !== 'therapy-service-hours-dev-test-only' ||
    settings.UserPoolId !== pool ||
    settings.SupportedIdentityProviders.length !== 1 ||
    settings.SupportedIdentityProviders[0] !== 'COGNITO' ||
    !settings.ExplicitAuthFlows.includes('ALLOW_USER_PASSWORD_AUTH')
  )
    throw new Error('DEV_AUTH_TARGET_MISMATCH');
  const value = awsCall(env, 'secretsmanager', 'get-secret-value', { SecretId: secret }) as { SecretString: string };
  let credentials: { password?: unknown };
  try {
    const decoded: unknown = JSON.parse(value.SecretString);
    if (typeof decoded !== 'object' || decoded === null) throw new Error('Invalid credential object');
    credentials = decoded;
  } catch {
    throw new Error('DEV_AUTH_INVALID_CREDENTIALS');
  }
  if (typeof credentials.password !== 'string' || credentials.password.length < 12)
    throw new Error('DEV_AUTH_INVALID_CREDENTIALS');
  const authenticated = awsCall(env, 'cognito-idp', 'initiate-auth', {
    ClientId: client,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: username, PASSWORD: credentials.password },
  }) as { AuthenticationResult: AuthenticationResult };
  const result = authenticated.AuthenticationResult;
  if (typeof result.IdToken !== 'string' || typeof result.RefreshToken !== 'string')
    throw new Error('DEV_AUTH_INVALID_SESSION');
  return {
    idToken: result.IdToken,
    revoke() {
      awsCall(env, 'cognito-idp', 'revoke-token', { ClientId: client, Token: result.RefreshToken });
    },
  };
}
