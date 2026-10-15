import { useEffect, type RefObject } from 'react'
import { useLocation } from '@tanstack/react-router'

/** Keep a linked form in view while the settings above it finish loading. */
export function useSettingsAnchor(section: RefObject<HTMLElement | null>) {
  const hash = useLocation({ select: location => location.hash })
  useEffect(() => {
    const root = section.current, target = document.getElementById(hash)
    if (!root || !target || !root.contains(target)) return
    const align = () => target.scrollIntoView({ block: 'start' })
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
