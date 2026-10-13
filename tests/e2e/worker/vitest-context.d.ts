import 'vitest'

declare module 'vitest' {
  interface ProvidedContext {
    generatedTransport: Record<string, string>
    fullMigrationNames: string[]
    migrations: Array<{
      name: string
      queries: string[]
    }>
  }
}
