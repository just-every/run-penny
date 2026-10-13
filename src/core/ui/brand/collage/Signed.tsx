/** A handwritten note's lines, each on its own line as written. */
export function Written({ lines }: { lines: readonly string[] }) {
  return lines.map((line) => <span key={line} className="pl-written-line">{line}</span>)
}

/**
 * A handwritten note's lines, each on its own line as written, with a short inked underline swept under the end of the
 * last one, the way the note's writer would sign it off.
 */
export function Signed({ lines }: { lines: readonly string[] }) {
  const last = lines.length - 1
  return lines.map((line, index) => (
    <span key={line} className="pl-written-line">
      {index === last ? (
        <span className="pl-signed-end">
          {line}
          <svg className="pl-signoff" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path className="pl-ink" d="M2 8.2C28 7.4 62 5.2 98 2.4" vectorEffect="non-scaling-stroke" />
          </svg>
        </span>
      ) : line}
    </span>
  ))
}
