import { useRouter } from '@tanstack/react-router';
import type { MouseEvent } from 'react';

/**
 * The article's own links to other docs pages are plain anchors in the build-time HTML. After hydration a plain left click
 * on one navigates inside the app, as the navigation does, instead of reloading the document; every other link (another
 * site, a heading on the same page, a modified click) keeps the browser's own behaviour.
 */
export function useProseLinks() {
  const router = useRouter();
  return (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest('a');
    const href = link?.getAttribute('href');
    if (!link || !href || link.target || !/^\/docs(?:[/#]|$)/.test(href)) return;
    event.preventDefault();
    void router.navigate({ href });
  };
}
