import { useParams } from '@tanstack/react-router'
import { DecisionBriefPage } from './decision-brief-page'

export function DecisionBriefRoute() {
  const { decisionSlug } = useParams({ from: '/app/decisions/$decisionSlug' })
  return <DecisionBriefPage decisionSlug={decisionSlug} />
}
