import { z } from 'zod'
import { NativeError } from '../auth/native-tokens'

const instant = z.iso.datetime({ offset: true }).transform(value => new Date(value).toISOString())
const windowSchema = z.object({ from: instant, to: instant }).strict().refine(value => {
  const duration = Date.parse(value.to) - Date.parse(value.from)
  return duration > 0 && duration <= 366 * 86400000
})
export type VolumeWindow = z.infer<typeof windowSchema>

export function volumeInput(url: string): VolumeWindow {
  try {
    const params = new URL(url).searchParams
    if ([...params.keys()].some(key => params.getAll(key).length !== 1)) throw new Error()
    return windowSchema.parse(Object.fromEntries(params))
  } catch {
    throw new NativeError('validation_failed', 400)
  }
}
