import { useEffect, type RefObject } from 'react'
import { useLocation } from '@tanstack/react-router'

/** Keep a linked form in view while the settings above it finish loading, including a form that renders late. */
export function useSettingsAnchor(section: RefObject<HTMLElement | null>) {
  const hash = useLocation({ select: location => location.hash })
  useEffect(() => {
    const root = section.current
    if (!root || !hash) return
    // A card that loads its own data may render after this section mounts, so find the target on every alignment.
    const align = () => {
      const target = document.getElementById(hash)
      if (!target || !root.contains(target)) return
      target.scrollIntoView({ block: 'start' })
      const top = target.getBoundingClientRect().top, covered = pinnedBottom(target)
      if (covered > top) window.scrollBy(0, top - covered)
    }
    const observer = new ResizeObserver(align)
    observer.observe(root)
    align()
    const stop = () => observer.disconnect()
    // Once the person interacts, their position takes precedence over the link.
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    for (const event of events) window.addEventListener(event, stop, { once: true, passive: true })
    return () => {
      stop()
      for (const event of events) window.removeEventListener(event, stop)
    }
  }, [hash, section])
}

/** The bottom of a bar pinned over the top of the page above the target (the phone header), or 0. */
function pinnedBottom(target: HTMLElement) {
  const { left, right } = target.getBoundingClientRect()
  for (let element = document.elementFromPoint((left + right) / 2, 1); element && element !== document.body; element = element.parentElement) {
    if (target.contains(element)) return 0
    const { position } = getComputedStyle(element)
    if (position === 'sticky' || position === 'fixed') return element.getBoundingClientRect().bottom
  }
  return 0
}
