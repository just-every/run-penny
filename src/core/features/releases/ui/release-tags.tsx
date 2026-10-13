import { tagPillClass } from '@/core/ui/app/classes'

export function ReleaseTags({ tags, className = 'mt-4' }: { readonly tags: readonly string[]; readonly className?: string }) {
  if (tags.length === 0) return null
  return <ul className={`${className} flex flex-wrap gap-2`} aria-label="Release tags">{tags.map((tag) => <li key={tag} className={tagPillClass}>{tag}</li>)}</ul>
}
