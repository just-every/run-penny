import { useState } from 'react'
import { fieldLabelClass, primaryButtonClass } from '@/core/ui/app/classes'
import { fieldClass } from '@/core/features/auth/client-mutations'
import { subformClass } from './form-classes'
import { usePublicResource } from '@/core/features/portal/ui/public-resource'
import { operatorMutation } from './operator-client'
import { CustomFieldsEditor } from '@/core/features/settings/ui/custom-fields-editor'

export function RequestMetadata({ requestId }: { requestId: string }) {
  const [catalog] = usePublicResource<{ tags: { id: string; name: string }[] }>('/api/operator/catalog/settings')
  const [message, setMessage] = useState('')
  async function applyTag(tagId: string) {
    try {
      await operatorMutation(`/api/operator/catalog/requests/${encodeURIComponent(requestId)}/tags/${encodeURIComponent(tagId)}`, {}, 'PUT')
      setMessage('Tag applied.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tag could not be applied.')
    }
  }

  return <>
    <section className={`${subformClass} space-y-4`}>
      <h3 className="font-bold text-penny-ink">Private request context</h3>
      <p className="text-sm font-semibold text-penny-ink empty:hidden" role="status">{message}</p>
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault()
        const tagId = String(new FormData(event.currentTarget).get('tag') ?? '')
        if (tagId) void applyTag(tagId)
      }}>
        <label className={fieldLabelClass}>Apply tag<select name="tag" className={fieldClass} required defaultValue=""><option value="" disabled>Select a private tag</option>{catalog.kind === 'ready' ? catalog.data.tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>) : null}</select></label>
        <button className={primaryButtonClass}>Apply tag</button>
      </form>
    </section>
    <CustomFieldsEditor entityType="request" entityId={requestId} />
  </>
}
