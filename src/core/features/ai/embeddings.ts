import type {PennyRuntime} from '@/core/app/runtime'
import {providers, type Provider} from './configuration'
import {meteredCost} from './cost'

export const EMBEDDINGS_ADAPTER_VERSION = '1.0.0'
/** Initial cosine cutoff for evaluation; this is not an automatic merge gate. */
export const DUPLICATE_SUGGESTION_THRESHOLD = 0.70

export interface EmbeddingsRuntime {
  readonly bindings: Pick<PennyRuntime['bindings'], 'PENNY_AI'>
}
export interface EmbeddingsRequest {
  url: 'https://api.openai.com/v1/embeddings'
  method: 'POST'
  headers: Record<string, string>
  body: string
}
export interface EmbeddingsResponse {status: number; body: string}
/** The caller supplies the enforcing network edge. No fetch or retry is implicit. */
export type EmbeddingsTransport = (request: EmbeddingsRequest) => Promise<EmbeddingsResponse>
export interface EmbeddingsOptions {
  provider: Provider
  model: string
  inputs: readonly string[]
  ceilingMicros: number
  /** Caller ceiling across the entire batch, checked before transport. */
  maxInputTokens: number
  transport: EmbeddingsTransport
}
export interface EmbeddingsResult {
  provider: 'openai'
  model: string
  /** Vectors are reordered to match the supplied inputs. */
  vectors: number[][]
  inputTokens: number
  costMicros: number
  upperInputTokens: number
  upperCostMicros: number
}
export type EmbeddingsFailureClassification = 'insufficient_quota' | 'authentication_failed' | 'access_denied' | 'rate_limited'
export class EmbeddingsError extends Error {
  readonly code: string
  readonly safeReason: string
  /** Provider HTTP status, when a valid HTTP response was received. */
  readonly status?: number
  readonly classification?: EmbeddingsFailureClassification
  constructor(code: string, message: string, status?: number, classification?: EmbeddingsFailureClassification) {
    super(message)
    this.name = 'EmbeddingsError'
    this.code = code
    this.safeReason = message
    this.status = status
    this.classification = classification
  }
}

const MAX_INPUTS = 2048
const MAX_INPUT_TOKENS = 8192
const MAX_BATCH_TOKENS = 300000
const encoder = new TextEncoder()

/** UTF-8 bytes bound byte-level text tokens, plus eight tokens per input for
 * conservative framing. This deliberately refuses some batches that an exact
 * tokenizer would admit; it never estimates from characters or a mean ratio. */
export function embeddingsUpperBound(inputs: readonly string[]): number {
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > MAX_INPUTS) {
    throw new EmbeddingsError('embeddings_inputs_invalid', 'Supply between 1 and 2048 embedding inputs.')
  }
  let total = 0
  for (const input of inputs) {
    if (typeof input !== 'string' || input.length === 0) {
      throw new EmbeddingsError('embeddings_inputs_invalid', 'Embedding inputs must be nonempty strings.')
    }
    // A code-unit count is a cheap lower bound on UTF-8 bytes, before allocation.
    if (input.length > MAX_INPUT_TOKENS - 8) {
      throw new EmbeddingsError('embeddings_input_limit', 'An embedding input exceeds the conservative 8192-token limit.')
    }
    const upper = encoder.encode(input).length + 8
    if (upper > MAX_INPUT_TOKENS) {
      throw new EmbeddingsError('embeddings_input_limit', 'An embedding input exceeds the conservative 8192-token limit.')
    }
    total += upper
    if (total > MAX_BATCH_TOKENS) {
      throw new EmbeddingsError('embeddings_batch_limit', 'The embedding batch exceeds the conservative 300000-token limit.')
    }
  }
  return total
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function payloadInvalid(): never {
  throw new EmbeddingsError('embeddings_payload_invalid', 'The embedding provider returned an invalid response.')
}
function parseResult(body: string, model: string, count: number, upper: number) {
  let raw: unknown
  try { raw = JSON.parse(body) } catch { return payloadInvalid() }
  if (!record(raw) || raw.object !== 'list' || raw.model !== model ||
      !Array.isArray(raw.data) || raw.data.length !== count || !record(raw.usage)) return payloadInvalid()
  const inputTokens = raw.usage.prompt_tokens, totalTokens = raw.usage.total_tokens
  if (typeof inputTokens !== 'number' || !Number.isSafeInteger(inputTokens) || inputTokens <= 0 ||
      typeof totalTokens !== 'number' || !Number.isSafeInteger(totalTokens) || totalTokens !== inputTokens) return payloadInvalid()
  if (inputTokens > upper) {
    throw new EmbeddingsError('embeddings_usage_exceeded', 'Reported embedding usage exceeds the reserved input bound.')
  }
  const vectors: number[][] = new Array(count)
  let dimensions = 0
  for (const row of raw.data) {
    if (!record(row) || row.object !== 'embedding' || typeof row.index !== 'number' ||
        !Number.isSafeInteger(row.index) || row.index < 0 || row.index >= count || vectors[row.index] !== undefined ||
        !Array.isArray(row.embedding) || row.embedding.length === 0) return payloadInvalid()
    if (!dimensions) dimensions = row.embedding.length
    if (row.embedding.length !== dimensions) return payloadInvalid()
    let norm = 0
    for (const value of row.embedding) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return payloadInvalid()
      norm = Math.hypot(norm, value)
    }
    if (!Number.isFinite(norm) || norm === 0) return payloadInvalid()
    vectors[row.index] = row.embedding
  }
  // Count + unique in-range indices proves completeness, including reordered rows.
  return {vectors, inputTokens}
}

function providerFailure(response: EmbeddingsResponse): never {
  let quota = false
  try {
    const raw: unknown = JSON.parse(response.body)
    quota = record(raw) && record(raw.error) &&
      (raw.error.code === 'insufficient_quota' || raw.error.type === 'insufficient_quota')
  } catch { /* Provider wording is never surfaced, including malformed errors. */ }
  const classification: EmbeddingsFailureClassification | undefined = quota ? 'insufficient_quota' :
    response.status === 401 ? 'authentication_failed' : response.status === 403 ? 'access_denied' :
    response.status === 429 ? 'rate_limited' : undefined
  const message = quota ? 'The embedding provider reports insufficient quota.' :
    response.status === 401 ? 'The embedding provider rejected the configured credentials.' :
    response.status === 403 ? 'The embedding provider denied access to the selected model.' :
    response.status === 429 ? 'The embedding provider rate limit was reached.' : 'The embedding provider refused the request.'
  throw new EmbeddingsError(classification ? `embeddings_${classification}` : 'embeddings_provider_failed',
    message, response.status, classification)
}

/** Compose, dispatch once, validate and meter. Product authorization, privacy,
 * durable monthly reservation and settlement belong to the caller. */
export async function embeddingsCall(runtime: EmbeddingsRuntime, options: EmbeddingsOptions): Promise<EmbeddingsResult> {
  const {provider, model, ceilingMicros, maxInputTokens, transport} = options
  if (provider === 'anthropic') {
    throw new EmbeddingsError('embeddings_provider_unsupported',
      'Anthropic has no first-party embedding model. Voyage requires a separate configured account.')
  }
  if (provider !== 'openai') {
    throw new EmbeddingsError('embeddings_provider_unsupported', 'The selected embedding provider is unsupported.')
  }
  if (typeof model !== 'string' || !model.length || !Number.isSafeInteger(ceilingMicros) || ceilingMicros < 0 ||
      !Number.isSafeInteger(maxInputTokens) || maxInputTokens <= 0 || typeof transport !== 'function') {
    throw new EmbeddingsError('embeddings_options_invalid', 'Supply a configured model, transport and valid input and cost ceilings.')
  }
  const upperInputTokens = embeddingsUpperBound(options.inputs)
  if (upperInputTokens > maxInputTokens) {
    throw new EmbeddingsError('embeddings_input_budget_exceeded', 'The embedding batch exceeds the caller input-token ceiling.')
  }
  // Snapshot caller input before crossing the asynchronous network boundary.
  const inputs = [...options.inputs]
  let configured: ReturnType<typeof providers>
  try {
    // providers currently accepts PennyRuntime but reads only bindings.PENNY_AI.
    configured = providers(runtime as PennyRuntime)
  } catch {
    throw new EmbeddingsError('ai_configuration_invalid', 'The installation AI configuration is invalid.')
  }
  const entry = configured.openai, selected = entry?.models.find(candidate => candidate.id === model)
  if (!entry || !selected) {
    throw new EmbeddingsError('embeddings_model_unconfigured', 'The selected embedding model is absent from the installation AI catalog.')
  }
  const cost = (tokens: number) => {
    try { return meteredCost(tokens, 0, selected.inputMicrosPerToken, selected.outputMicrosPerToken) }
    catch { throw new EmbeddingsError('embeddings_cost_invalid', 'The configured embedding cost exceeds the supported range.') }
  }
  const upperCostMicros = cost(upperInputTokens)
  if (upperCostMicros > ceilingMicros) {
    throw new EmbeddingsError('embeddings_call_budget_exceeded', 'The embedding batch exceeds the caller cost ceiling.')
  }
  let response: EmbeddingsResponse
  try {
    response = await transport({
      url: 'https://api.openai.com/v1/embeddings', method: 'POST',
      headers: {Authorization: `Bearer ${entry.apiKey}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({model, input: inputs, encoding_format: 'float'}),
    })
  } catch {
    throw new EmbeddingsError('embeddings_transport_failed', 'The embedding transport failed; paid usage may be unknown.')
  }
  if (!response || !Number.isInteger(response.status) || response.status < 100 || response.status > 599 ||
      typeof response.body !== 'string') return payloadInvalid()
  if (response.status !== 200) return providerFailure(response)
  const {vectors, inputTokens} = parseResult(response.body, model, inputs.length, upperInputTokens)
  const costMicros = cost(inputTokens)
  if (costMicros > upperCostMicros || costMicros > ceilingMicros) {
    throw new EmbeddingsError('embeddings_cost_exceeded', 'Reported embedding cost exceeds the reserved ceiling.')
  }
  return {provider, model, vectors, inputTokens, costMicros, upperInputTokens, upperCostMicros}
}
