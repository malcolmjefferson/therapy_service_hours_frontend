import { setupServer } from 'msw/node';
import { defaultHandlers } from './handlers';

/** MSW server mocking the API at the network boundary (FE-24). */
export const server = setupServer(...Object.values(defaultHandlers));
