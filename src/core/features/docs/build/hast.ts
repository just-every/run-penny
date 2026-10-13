import type { DocsTocEntry } from '../types.ts';
import { calloutSheet, calloutStamp, codeBurst } from './decorations.ts';
import { rewriteHref, rewriteImageSrc } from './links.ts';
import type { AnchorCheck, LinkContext } from './links.ts';

// The one rehype pass over a page's HTML tree, before react-markdown turns it into React elements. In document order it
// takes out the leading H1 (the page renders its own), gives h2-h6 GitHub ids, collects the contents list, rewrites links
// and images, turns GitHub alert blockquotes into callouts and code blocks into code cards (both with their decorative
// collage marks), turns table-cell align into classes (react-markdown would make it an inline style) and picks the page
// description.

type Text = { type: 'text' | 'raw'; value: string };
type Element = { type: 'element'; tagName: string; properties: Record<string, unknown>; children: Node[] };
type Root = { type: 'root'; children: Node[] };
type Node = Root | Element | Text | { type: 'comment' | 'doctype'; value?: string };

export type HastState = {
  slug: (text: string) => string;
  links: LinkContext;
  title: string;
  titleId: string;
  description: string;
  toc: DocsTocEntry[];
  ids: string[];
  anchors: AnchorCheck[];
  images: string[];
  problems: string[];
  /** Code blocks seen so far; only the page's first card carries the inked burst. */
  codeBlocks: number;
};

export const imageToken = (index: number) => `__DOCS_IMAGE_${index}__`;
/** Splits rendered HTML around its image tokens; the captured group is the image's index. */
export const imageTokenPattern = /__DOCS_IMAGE_(\d+)__/;

const isElement = (node: Node): node is Element => node.type === 'element';
const textOf = (node: Node): string => node.type === 'text' || node.type === 'raw' ? node.value
  : 'children' in node ? node.children.map(textOf).join('') : '';
const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();
const alerts: Record<string, string> = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };

function describe(paragraph: Element) {
  const words = collapse(textOf(paragraph));
  if (words.split(' ').length < 8) return '';
  if (words.length <= 160) return words;
  return `${words.slice(0, 159).replace(/\s+\S*$/, '')}…`;
}

/**
 * A blockquote whose first paragraph opens with [!NOTE] (or TIP, IMPORTANT, WARNING, CAUTION) becomes a labelled note: a
 * torn sand sheet with the copper star stamp, then the label and the note's own text.
 */
function callout(node: Element) {
  const paragraph = node.children.find(isElement);
  if (!paragraph || paragraph.tagName !== 'p') return;
  const lead = paragraph.children.findIndex(child => child.type !== 'text');
  const leading = (lead === -1 ? paragraph.children : paragraph.children.slice(0, lead)) as Text[];
  const match = leading.map(child => child.value).join('').match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/);
  if (!match) return;
  let strip = match[0].length;
  for (const child of leading) {
    const take = Math.min(strip, child.value.length);
    child.value = child.value.slice(take);
    strip -= take;
  }
  paragraph.children = paragraph.children.filter(child => child.type !== 'text' || child.value !== '');
  if (!paragraph.children.length) node.children.splice(node.children.indexOf(paragraph), 1);
  const kind = match[1];
  node.tagName = 'div';
  node.properties = { className: ['docs-callout', `docs-callout--${kind.toLowerCase()}`], role: 'note' };
  node.children.unshift(calloutSheet(), calloutStamp(), { type: 'element', tagName: 'p', properties: { className: ['docs-callout-label'] }, children: [{ type: 'text', value: alerts[kind] }] });
}

/** The scroll region's accessible name: the block's number on the page, so each is unique, and its first line. */
function codeLabel(node: Element, number: number) {
  const first = textOf(node).split('\n').map(collapse).find(Boolean) ?? '';
  const label = first ? `Code ${number}: ${first}` : `Code ${number}`;
  return label.length > 80 ? `${label.slice(0, 79).trimEnd()}…` : label;
}

/**
 * A code block becomes a code card: the pre inside a wrapper that also holds the card and the page's one inked burst.
 * Commands keep to one line each, so the pre scrolls sideways inside the card when a line is wider than it; it is a
 * labelled, focusable region so keyboard users can scroll it too.
 */
function codeCard(node: Element, state: HastState) {
  const index = state.codeBlocks++;
  const properties = { ...node.properties, role: 'region', tabIndex: 0, ariaLabel: codeLabel(node, index + 1) };
  const pre: Element = { type: 'element', tagName: 'pre', properties, children: node.children };
  node.tagName = 'div';
  node.properties = { className: ['docs-code'] };
  node.children = index === 0 ? [codeBurst(), pre] : [pre];
}

function visit(node: Element, state: HastState) {
  const { tagName, properties } = node;
  if (tagName === 'h1') state.problems.push('an H1 that is not the first block (a page has exactly one H1, first)');
  if (/^h[2-6]$/.test(tagName)) {
    const id = state.slug(textOf(node));
    properties.id = id;
    state.ids.push(id);
    if (tagName === 'h2' || tagName === 'h3') state.toc.push({ depth: tagName === 'h2' ? 2 : 3, id, text: collapse(textOf(node)) });
  }
  if (tagName === 'a' && typeof properties.href === 'string') {
    const result = rewriteHref(properties.href, state.links);
    if ('problem' in result) state.problems.push(result.problem);
    else {
      properties.href = result.href;
      if (result.anchor) state.anchors.push(result.anchor);
    }
  }
  if (tagName === 'img') {
    const result = rewriteImageSrc(String(properties.src ?? ''), String(properties.alt ?? ''), state.links);
    if ('problem' in result) state.problems.push(result.problem);
    else {
      properties.src = imageToken(state.images.push(result.path) - 1);
      properties.loading = 'lazy';
      properties.decoding = 'async';
    }
  }
  if (tagName === 'blockquote') callout(node);
  // The code inside needs no visiting: links, images and headings in a code block are text.
  if (tagName === 'pre') return codeCard(node, state);
  if ((tagName === 'td' || tagName === 'th') && properties.align) {
    properties.className = [`docs-align-${properties.align}`];
    delete properties.align;
  }
  for (const child of node.children) if (isElement(child)) visit(child, state);
}

export function docsHast(state: HastState) {
  // Typed as unified's transformer argument (a unist node); react-markdown hands it the hast root.
  return (node: { type: string }) => {
    const tree = node as Root;
    const first = tree.children.find(isElement);
    const before = first ? tree.children.slice(0, tree.children.indexOf(first)) : tree.children;
    if (first?.tagName === 'h1' && before.every(child => child.type === 'text' && !child.value.trim())) {
      state.title = collapse(textOf(first));
      state.titleId = state.slug(textOf(first));
      tree.children.splice(0, tree.children.indexOf(first) + 1);
      while (tree.children[0]?.type === 'text' && !tree.children[0].value.trim()) tree.children.shift();
    } else state.problems.push('the first block must be the page\'s H1');
    for (const child of tree.children) if (isElement(child)) visit(child, state);
    for (const child of tree.children) {
      if (isElement(child) && child.tagName === 'p' && (state.description = describe(child))) break;
    }
  };
}
