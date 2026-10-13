import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const documentInput = z.string().max(2048).refine((path) => path.startsWith('/') && !path.startsWith('//'))

export const loadPublicResources = createServerFn({ method: 'GET' })
  .validator(documentInput)
  .handler(async ({ data }) => {
    const { publicResources } = await import('./resources.server')
    return publicResources(data)
  })

export const loadOperatorResources = createServerFn({ method: 'GET' })
  .validator(documentInput)
  .handler(async ({ data }) => {
    const { operatorResources } = await import('./resources.server')
    return operatorResources(data)
  })
