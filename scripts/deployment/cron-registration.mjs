import { checkCronOwnership } from '../../base/modules/deploy-kit/resources.mjs'
import { assert } from '../../base/modules/deploy-kit/validation.mjs'

// A changed Penny deployment explicitly registers its schedules after upload,
// even when the provider already lists the same set. PUT replaces the whole set:
// retain Base's ownership check and never clear schedules as a refresh workaround.
export async function registerDeploymentCrons(api, plan, changed) {
  if (!changed) return
  await checkCronOwnership(api, plan)
  await api.request(`/workers/scripts/${plan.worker}/schedules`, {
    method: 'PUT', body: plan.crons.map(cron => ({ cron })),
  })
  const registered = await checkCronOwnership(api, plan)
  assert(JSON.stringify(registered) === JSON.stringify([...plan.crons].sort()), 'cron-drift')
}
