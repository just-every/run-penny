import { createContext, useContext } from 'react'

export type SiteVariant = 'instance' | 'site'
export const SiteVariantContext = createContext<SiteVariant>('instance')
export const useSiteVariant = () => useContext(SiteVariantContext)
