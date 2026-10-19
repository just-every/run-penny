import 'vitest'

declare module 'vitest' {
  interface ProvidedContext {
    generatedTransport: Record<string, string>
    fullMigrationNames: string[]
    platformLedger: Array<{ name: string; sha256: string }>
    migrations: Array<{
      name: string
      queries: string[]
    }>
  }
}
