export interface BlobStore {
  verifyReachability(): Promise<void>
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | Blob | string, contentType: string): Promise<void>
  get(key: string): Promise<R2ObjectBody | null>
  delete(key: string): Promise<void>
}

export function createBlobStore(binding: R2Bucket | undefined): BlobStore {
  if (!binding) {
    throw new Error('Missing required FILES R2 binding.')
  }

  return {
    async verifyReachability(): Promise<void> {
      await binding.list({ limit: 1 })
    },
    async put(key, value, contentType) {
      await binding.put(key, value, { httpMetadata: { contentType } })
    },
    async get(key) {
      return binding.get(key)
    },
    async delete(key) {
      await binding.delete(key)
    },
  }
}
