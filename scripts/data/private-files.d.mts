export function privateInput(path: string, max?: number): Promise<unknown>
export function privateBytes(path: string, max?: number): Promise<Buffer>
export function privateWrite(path: string, value: unknown, replace?: boolean): Promise<string>
export function privateDestination(path: string, replace?: boolean): Promise<string>
export function privateSession(path: string): Promise<string>
export const MAX_ARCHIVE_BYTES: number
