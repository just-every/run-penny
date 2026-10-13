import type { ReactNode } from 'react'
import { draw } from './coinDraw'
import { coin64 } from './coinFull'
import { CoinSpriteContext, coinFullId } from './coinSpriteContext'

/**
 * The full coin drawing, emitted once as an SVG <symbol> in a hidden, zero-size <svg>, for every `full` CoinMark on the page
 * to <use>. The landing renders it once around its page. Zero size and absolutely positioned, not display:none, because a
 * clip path inside a display:none svg does not apply in every browser. Its clip id takes the symbol's id as a prefix.
 */
export function CoinSprite({ children }: { children: ReactNode }) {
  return (
    <CoinSpriteContext.Provider value={true}>
      <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <symbol id={coinFullId} viewBox={`0 0 ${coin64.size} ${coin64.size}`} overflow="visible">{draw(coin64.elements, coinFullId)}</symbol>
      </svg>
      {children}
    </CoinSpriteContext.Provider>
  )
}
