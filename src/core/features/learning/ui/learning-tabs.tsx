import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export type LearningTab = 'results' | 'learning' | 'needs-you'
const sections: { id: LearningTab; label: string }[] = [
 { id: 'results', label: 'Results' },
 { id: 'learning', label: 'Learning' },
 { id: 'needs-you', label: 'Needs you' },
]

export function LearningTabs({ selected, onSelect, needsYou }: { selected: LearningTab; onSelect: (tab: LearningTab) => void; needsYou: boolean }) {
 const tabs = useRef<(HTMLButtonElement | null)[]>([])
 function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
  const next = event.key === 'ArrowRight' ? (index + 1) % sections.length
   : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length
   : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : null
  if (next === null) return
  event.preventDefault()
  tabs.current[next]?.focus()
  onSelect(sections[next].id)
 }
 return <div className="tabs" role="tablist" aria-label="Learning sections">{sections.map((section, index) => <button
  key={section.id} ref={node => { tabs.current[index] = node }} type="button" role="tab"
  id={`learning-tab-${section.id}`} aria-controls={`learning-panel-${section.id}`}
  aria-selected={selected === section.id} tabIndex={selected === section.id ? 0 : -1}
  onClick={() => onSelect(section.id)} onKeyDown={event => move(event, index)}
 >{section.label}{section.id === 'needs-you' && needsYou ? ' (1)' : ''}</button>)}</div>
}

export function LearningPanel({ id, selected, children }: { id: LearningTab; selected: LearningTab; children: ReactNode }) {
 return <section id={`learning-panel-${id}`} role="tabpanel" aria-labelledby={`learning-tab-${id}`} hidden={selected !== id} tabIndex={0}>{children}</section>
}
