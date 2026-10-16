/** The Queue message that wakes the data runner. Duplicates are harmless:
 * every step is claimed, so each runs once. */
export const DATA_WORK = { kind: 'data.advance' } as const
export const isDataWork = (body: unknown) => !!body && typeof body === 'object' && (body as { kind?: unknown }).kind === DATA_WORK.kind
export async function queueDataWork(jobs: Queue, delaySeconds = 0): Promise<void> {
 await jobs.send(DATA_WORK, { delaySeconds: Math.min(43_200, Math.max(0, Math.ceil(delaySeconds))) })
}
