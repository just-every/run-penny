import { useEffect, useState } from 'react';

/** How far below the top of the window a heading counts as the one being read. */
const readingLine = 140;

/**
 * The contents entry being read: the last heading that has scrolled up to the reading line, or the last one once the page
 * is scrolled to its end. It starts at the first entry, so the server and the first client render agree.
 */
export function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join(' ');
  useEffect(() => {
    if (!key) return;
    const headings = key.split(' ');
    let frame = 0;
    const update = () => {
      frame = 0;
      const end = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
      const read = headings.filter(id => (document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= readingLine);
      setActive(end ? headings[headings.length - 1] : read[read.length - 1] ?? headings[0]);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    return () => {
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [key]);
  return active;
}
