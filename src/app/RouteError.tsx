import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

/**
 * Per-route error boundary (FE-33). Shows plain language only; details go to the console for
 * developers, never the raw error to the user (FE-37).
 */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (!notFound) {
    console.error(error);
  }
  return (
    <section role="alert" aria-labelledby="route-error-heading">
      <h2 id="route-error-heading">{notFound ? 'Page not found' : 'Something went wrong'}</h2>
      <p>
        {notFound ? 'There is no page at this address.' : 'This page could not be shown. Please reload and try again.'}
      </p>
      <Link to="/">Back to the start page</Link>
    </section>
  );
}
