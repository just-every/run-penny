import { subformClass } from './form-classes'
import { CustomFieldsEditor } from '@/core/features/settings/ui/custom-fields-editor'
import { TagEditor, requestTagApi } from '@/core/features/catalog/ui/tag-editor'

export function RequestMetadata({ requestId, tags, onChanged }: { requestId: string; tags: readonly { name: string }[]; onChanged: () => void }) {
  return <>
    <section className={`${subformClass} space-y-4`}>
      <h3 className="font-bold text-penny-ink">Private request tags</h3>
      <TagEditor label="Request tags" tagNames={tags.map(tag => tag.name)} onChanged={onChanged} {...requestTagApi(requestId)} />
    </section>
    <CustomFieldsEditor entityType="request" entityId={requestId} />
  </>
}
