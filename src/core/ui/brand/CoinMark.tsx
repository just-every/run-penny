import { useContext, useId } from 'react'
import { coin32 } from './coinSmall'
import { coin64 } from './coinFull'
import { draw } from './coinDraw'
import { CoinSpriteContext, coinFullId } from './coinSpriteContext'
import './coin.css'

/**
 * Penny's coin mark, the penny alone: exactly one <svg> per mark. Decorative: it always sits beside the name.
 * The use site names the drawing. `full` is the smooth 64-unit drawing, for the landing drawings' coins (12px to 23px),
 * where the pixel-snapped art read as jagged: about 22 KB of paths, so it is not inlined per mark but emitted once per page
 * by CoinSprite (the landing renders it) and each mark `use`s it; a `full` mark outside a CoinSprite throws. `medium` is
 * the 32-unit hinted drawing, inlined, for the header, footer, portal, sign-in, 404 and operator lockups (the drawing rendered 27px to 44px wide).
 * The 16-unit drawing is the 16px favicon only. The caller's class only sets the slot, `--coin-slot`: the height the lockup
 * gives the mark (see coin.css).
 */
export function CoinMark({ className = 'pl-coin', tier = 'medium' }: { className?: string; tier?: 'full' | 'medium' }) {
  const prefix = `pl-coin-${useId().replace(/[^\w-]/g, '')}`
  const hasSprite = useContext(CoinSpriteContext)
  if (tier === 'full' && !hasSprite) throw new Error('CoinMark tier "full" needs a <CoinSprite> above it: the full drawing is emitted once per page as a <symbol>, and this page has none')
  const size = tier === 'full' ? coin64.size : coin32.size
  return (
    <span className={`pl-mark pl-mark--${tier} ${className}`} aria-hidden="true">
      <svg className="pl-mark-art" viewBox={`0 0 ${size} ${size}`} focusable="false">
        {tier === 'full' ? <use href={`#${coinFullId}`} /> : draw(coin32.elements, prefix)}
      </svg>
    </span>
  )
}
