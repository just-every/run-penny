export interface JobDispatcher {
  verifyAvailability(): Promise<void>
}

export function createJobDispatcher(binding: Queue | undefined): JobDispatcher {
  if (!binding || typeof binding.metrics !== 'function' || typeof binding.send !== 'function') {
    throw new Error('Missing required JOBS Queue binding.')
  }

  return {
    async verifyAvailability(): Promise<void> {
      await binding.metrics()
    },
  }
}
