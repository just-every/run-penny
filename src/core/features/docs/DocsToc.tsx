import { CopperStroke } from '@/core/ui/brand/collage/Stroke';
import type { DocsTocEntry } from './types';
import { useActiveHeading } from './useActiveHeading';

type Group = DocsTocEntry & { children: DocsTocEntry[] };

/** h3 entries nest under the h2 before them. Pages with fewer than two h2s get no contents list. */
function groups(toc: DocsTocEntry[]) {
  if (toc.filter(entry => entry.depth === 2).length < 2) return [];
  return toc.reduce<Group[]>((list, entry) => {
    if (entry.depth === 3 && list.length) list[list.length - 1].children.push(entry);
    else list.push({ ...entry, children: [] });
    return list;
  }, []);
}

function TocLink({ entry, active }: { entry: DocsTocEntry; active?: string }) {
  const current = entry.id === active;
  return <a href={`#${entry.id}`} aria-current={current ? 'location' : undefined}>
    {entry.text}
    {current ? <CopperStroke className="docs-toc-stroke" /> : null}
  </a>;
}

/** The list; `active` (beside the page only) marks the entry being read. */
function TocList({ toc, active }: { toc: DocsTocEntry[]; active?: string }) {
  return <ul>
    {groups(toc).map(group => <li key={group.id}>
      <TocLink entry={group} active={active} />
      {group.children.length > 0 && <ul>{group.children.map(entry => <li key={entry.id}><TocLink entry={entry} active={active} /></li>)}</ul>}
    </li>)}
  </ul>;
}

/** The contents list beside the page, from 1200px, with the section being read underlined in copper. */
export function DocsToc({ toc }: { toc: DocsTocEntry[] }) {
  const list = groups(toc);
  const active = useActiveHeading(list.flatMap(group => [group.id, ...group.children.map(entry => entry.id)]));
  if (!list.length) return null;
  return <nav className="docs-toc" aria-label="On this page">
    <p className="docs-toc-title">On this page</p>
    <TocList toc={toc} active={active} />
  </nav>;
}

/** The same list above the page body below 1200px, folded away until asked for. */
export function DocsTocCompact({ toc }: { toc: DocsTocEntry[] }) {
  if (!groups(toc).length) return null;
  return <details className="docs-toc-compact">
    <summary>On this page</summary>
    <TocList toc={toc} />
  </details>;
}
