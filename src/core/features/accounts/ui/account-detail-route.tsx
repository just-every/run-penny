import { useParams } from '@tanstack/react-router'
import { AccountDetailPage } from './account-detail-page'

export function AccountDetailRoute() {
  const { accountSlug } = useParams({ from: '/app/customers/$accountSlug' })
  return <AccountDetailPage accountSlug={accountSlug} />
}
