import { publicLandingConfig } from '@/core/app/extension-config'
import type { Resources } from '@/core/app/resources.server'

/** A tab's title: the page or record it shows, then the workspace's name. */
export function pageHead(page?: string) {
  return { meta: [{ title: page ? `${page} · ${publicLandingConfig.ownerName}` : publicLandingConfig.ownerName }] }
}

/** A tab's title from the record a detail route's loader read: the record's own `title` (or `name`), else the page's name. */
export function recordHead(loaderData: Resources | undefined, path: string, fallback: string) {
  const record = loaderData?.[path]?.data
  const name = record && typeof record === 'object' && !Array.isArray(record) ? (record.title ?? record.name) : undefined
  return pageHead(typeof name === 'string' && name ? name : fallback)
}
