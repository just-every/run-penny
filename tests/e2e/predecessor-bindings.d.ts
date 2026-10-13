// Retired input names exist only in historical fixture types. Runtime ignores them.
import '@/core/shared/bindings'
declare module '@/core/shared/bindings' {
 interface AppBindings {
  PENNY_AUTH_TRANSPORT?: string
  MAIL_PROVIDER_API_KEY?: string
  MAIL_WEBHOOK_SECRET?: string
 }
}
