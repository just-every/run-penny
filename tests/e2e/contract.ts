import { test } from 'node:test'
type TestBody = () => void | Promise<void>
export function contract(clauseId: string, name: string, body: TestBody) {
  return test(`[${clauseId}] ${name}`, body)
}
