/** Breaks a handwritten note into lines of at most `width` characters, word by word, as its writer would; a no-break space keeps two words together. */
export function noteLines(text: string, width: number): string[] {
  return text.split(/[ \t\n]+/).reduce<string[]>((lines, word) => {
    const last = lines.at(-1)
    if (last !== undefined && `${last} ${word}`.length <= width) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
    return lines
  }, [])
}
