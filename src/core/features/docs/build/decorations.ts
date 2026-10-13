import { burstPath } from '../../../ui/brand/collage/burst.ts';
import { stampStarPath } from '../../../ui/brand/collage/star.ts';
import { tornCircle, tornRect } from '../../../ui/brand/collage/tearing.ts';

// Penny's collage marks, drawn into the docs' static HTML at build time from the same geometry the landing draws with
// (src/core/ui/brand/collage). Every mark is decorative: hidden from assistive technology, unfocusable, without text and
// painted by class only (docs styles), so the page's text stays real and the markup carries no style attribute. The paper
// filters the marks refer to (#pl-copper, #pl-sand) are rendered once by the docs page.

export type Mark = { type: 'element'; tagName: string; properties: Record<string, unknown>; children: Mark[] };

function mark(className: string, viewBox: string, paths: [string, string][], stretch = false): Mark {
  const fit = stretch ? { preserveAspectRatio: 'none' } : {};
  return {
    type: 'element',
    tagName: 'svg',
    properties: { className: [className], viewBox, ariaHidden: 'true', focusable: 'false', ...fit },
    children: paths.map(([name, d]) => ({ type: 'element', tagName: 'path', properties: { className: [name], d }, children: [] })),
  };
}

/** A callout's torn sand sheet, stretched behind the note to its box. */
export const calloutSheet = () => mark('docs-callout-sheet', '0 0 640 120', [['docs-sheet', tornRect(6, 6, 628, 108, 17, 2.4, 12)]], true);

/** The copper star stamp pressed beside a callout's label. */
export const calloutStamp = () => mark('docs-stamp', '0 0 64 64', [['docs-stamp-disc', tornCircle(32, 32, 28, 23, 1.8)], ['pl-stamp-star', stampStarPath(32, 32, 28)]]);

/** The inked burst at the corner of a page's first code card. */
export const codeBurst = () => mark('docs-code-burst', '0 0 64 64', [['pl-ink', burstPath({ x: 6, y: 58, angle: -38, spread: 40, gap: 12, length: 20 })]]);
