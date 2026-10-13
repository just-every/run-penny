export function parseTagNamesJson(value: string): readonly string[] {
  const parsed: unknown = JSON.parse(value)
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
    throw new Error('D1 returned an invalid tag list.')
  }
  return parsed
}
