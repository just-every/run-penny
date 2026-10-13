const ULID_PATTERN = /^[0-9A-HJKMNPQRSTVWXYZ]{26}$/

export function assertUlid(value: string, label: string): void {
  if (!ULID_PATTERN.test(value)) {
    throw new Error(`${label} must be a ULID`)
  }
}

export function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate values`)
  }
}
