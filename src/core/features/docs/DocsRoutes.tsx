import { getRouteApi } from '@tanstack/react-router';
import { DocsPage } from './DocsPage';

const home = getRouteApi('/docs/');
const article = getRouteApi('/docs/$slug');

/** The docs home route's page (src/routes/docs.index.tsx). */
export function DocsHomeRoute() {
  return <DocsPage {...home.useLoaderData()} />;
}

/** One docs page's route (src/routes/docs.$slug.tsx). */
export function DocsArticleRoute() {
  return <DocsPage {...article.useLoaderData()} />;
}
