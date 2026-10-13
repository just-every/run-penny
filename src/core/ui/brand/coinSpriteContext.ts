import { createContext } from 'react'

/** The one fixed id of the full drawing's <symbol>; the page holds exactly one sprite, so the id is the same on the server and the client. */
export const coinFullId = 'pl-coin-full'

/** True below a CoinSprite. A `full` CoinMark outside one throws, because its <use> would point at nothing and render empty. */
export const CoinSpriteContext = createContext(false)
