import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme';
import { App } from './app/App';
import { createApiClient } from './lib/api';
import { loadAuthConfig } from './lib/auth/config';
import { browserSession } from './lib/auth/session';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html is missing <div id="root">.');
}

const reactRoot = createRoot(root);
try {
  const config = await loadAuthConfig(window.location.origin);
  const session = browserSession(config);
  reactRoot.render(
    <StrictMode>
      <App apiClient={createApiClient(window.location.origin, undefined, session)} session={session} />
    </StrictMode>,
  );
} catch {
  reactRoot.render(
    <main>
      <h1>Clinical Hours Ledger</h1>
      <p role="alert">Sign-in configuration could not be loaded. Please reload and try again.</p>
    </main>,
  );
}
