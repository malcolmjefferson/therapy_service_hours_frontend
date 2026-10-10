import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme';
import { App } from './app/App';
import { createApiClient } from './lib/api';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html is missing <div id="root">.');
}

createRoot(root).render(
  <StrictMode>
    <App apiClient={createApiClient(window.location.origin)} />
  </StrictMode>,
);
