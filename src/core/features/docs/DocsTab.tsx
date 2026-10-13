import { TornRect } from '@/core/ui/brand/collage/Torn'

/** The current page's marker in the section navigation: a strip of torn copper paper behind the link's white text. */
export function DocsTab() {
  return (
    <svg className="docs-tab" viewBox="0 0 520 92" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <TornRect x={8} y={8} w={504} h={76} tone="rust" seed={29} rough={3.4} />
    </svg>
  );
}
