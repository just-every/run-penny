import { z } from 'zod'
import { ToolRefusal, type ToolContext, type ToolDefinition, type ClassAndFacts, type ClassId } from '../../../../base/modules/agent-door/index.ts'
import { MutationError } from '../../app/operator-mutations'
import { RequestLifecycleError } from '../requests/lifecycle-types'
import { NativeError } from '../auth/native-tokens'
import { inputSchema } from './schema'
import { nativeAudit, nativeContext } from './context'

export const text = z.string().trim().min(1).max(20000)
export const id = z.string().min(1).max(160)
export const idResult = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
export const okResult = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }
export const objectResult = { type: 'object' }
export const arrayResult = { type: 'object', properties: { items: { type: 'array', items: { type: 'object' } } }, required: ['items'] }
export const standard = () => [{ class: 'standard' as const, facts: { measure: 1 } }]

type Native = Awaited<ReturnType<typeof nativeContext>>
interface Definition<T extends z.ZodObject> {
  name: string; title: string; description: string; scope: string; clauses: string[]; input: T
  classes?: ClassId[]
  classify?(input: z.output<T>, native: Native): Promise<ClassAndFacts[]>
  output: ToolDefinition['outputSchema']; readOnly?: boolean
  resources?(input: z.output<T>, result: unknown): Array<{ uri: string; name: string }>
  run(input: z.output<T>, native: Native, ctx: ToolContext): Promise<unknown>
  target?(input: z.output<T>, native: Native): Promise<{ kind: string; id: string } | null>
  revision?(input: z.output<T>, native: Native): Promise<string | number | null>
  summary?(input: z.output<T>, native: Native): Promise<{ target?: { id?: string; name?: string }; items?: string[] }>
}
export function nativeTool<T extends z.ZodObject>(definition: Definition<T>): ToolDefinition {
  const parse = (args: Record<string, unknown>) => {
    const { idempotency_key: _key, expected_revision: _revision, ...input } = args
    return definition.input.strip().parse(input) as z.output<T>
  }
  const protect = async <R>(action: () => Promise<R>) => {
    try { return await action() } catch (error) {
      if (error instanceof ToolRefusal) throw error
      if (error instanceof MutationError) throw new ToolRefusal(error.status === 404 ? 'resource_unavailable' : error.status === 409 ? 'revision_conflict' : 'invalid_arguments')
      if (error instanceof RequestLifecycleError) throw new ToolRefusal(error.status === 404 ? 'resource_unavailable' : error.code)
      if (error instanceof NativeError) throw new ToolRefusal(error.status === 404 ? 'resource_unavailable' : error.code)
      if (error instanceof z.ZodError) throw new ToolRefusal('invalid_arguments')
      throw error
    }
  }
  const tool: ToolDefinition = {
    name: definition.name, title: definition.title, description: definition.description, scope: definition.scope,
    readOnly: definition.readOnly ?? false, clauses: definition.clauses, classes: definition.classes ?? ['standard'], untrusted: true,
    inputSchema: inputSchema(definition.input), outputSchema: definition.output,
    classify: (args, ctx, completed) => protect(async () => { const native = await nativeContext(ctx); return completed ? [...completed] : definition.classify ? definition.classify(parse(args), native) : standard() }),
    summary: (args, ctx) => protect(async () => definition.summary ? definition.summary(parse(args), await nativeContext(ctx)) : { items: [definition.title] }),
    run: (args, ctx) => protect(async () => {
      const input = parse(args), native = await nativeContext(ctx, !definition.readOnly)
      const result = await definition.run(input, native, ctx)
      if (!definition.readOnly) await nativeAudit(ctx, definition.name, result && typeof result === 'object' && 'id' in result ? String(result.id) : null)
      return { result, ...(definition.resources ? { resources: definition.resources(input, result) } : {}) }
    }),
  }
  if (definition.target) tool.target = (args, ctx) => protect(async () => definition.target!(parse(args), await nativeContext(ctx)))
  if (definition.revision) {
    tool.revisionType = 'string'
    tool.revision = (args, ctx) => protect(async () => definition.revision!(parse(args), await nativeContext(ctx)))
  }
  return tool
}
