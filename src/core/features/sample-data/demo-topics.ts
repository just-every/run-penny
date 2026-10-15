import type { PennySample } from './schema'

export interface DemoTopic {
  slug: string
  title: string
  summary: string
  question: string
  alternative: string
  tradeoff: string
  measure: string
  state: PennySample['decisions'][number]['state']
  status: Exclude<PennySample['roadmapItems'][number]['status'], 'dropped'>
  board: number
  tag: number
  daysAgo: number
  // Each quote keeps its speaker/account, source and observed time.
  signals: readonly (readonly [account: number, source: PennySample['evidence'][number]['sourceType'], wording: string])[]
}

export const demoTopics: readonly DemoTopic[] = [
  {
    slug: 'scim-provisioning', title: 'SCIM provisioning',
    summary: 'Provision and remove workspace members through your identity provider.',
    question: 'How should we remove the manual work from enterprise access management?',
    alternative: 'Scheduled CSV provisioning', tradeoff: 'CSV works for smaller teams, but leaves a delay when access must be revoked.',
    measure: 'Three pilot admins provision and deprovision without a manual support ticket.',
    state: 'committed', status: 'in_progress', board: 40, tag: 50, daysAgo: 18,
    signals: [
      [0, 'sales_call', 'Our security review needs automatic deprovisioning. We cannot rely on someone remembering to upload a CSV.'],
      [2, 'interview', 'We add about forty people a month. An Entra group should be the source of truth for access.'],
      [1, 'support_conversation', 'A weekly CSV is enough for our small admin team this quarter; immediate SCIM is less urgent for us.'],
    ],
  },
  {
    slug: 'shared-external-threads', title: 'Shared external threads',
    summary: 'Invite a client into one discussion without exposing the rest of your workspace.',
    question: 'What is the smallest safe way to bring clients into a feedback discussion?',
    alternative: 'Read-only discussion exports', tradeoff: 'Exports are simpler, but replies still arrive in a separate email thread.',
    measure: 'Five client handoffs finish in a shared thread without screenshots.',
    state: 'ready', status: 'planned', board: 41, tag: 51, daysAgo: 9,
    signals: [
      [3, 'portal_request', 'We screenshot comment threads for every client handoff. Can we share just one discussion?'],
      [4, 'interview', 'Clients need to reply to the question in context, rather than starting another email chain.'],
      [0, 'email', 'We could use read-only exports first. Our compliance team is not ready for guest access.'],
    ],
  },
  {
    slug: 'weekly-feedback-digest', title: 'Weekly feedback digest',
    summary: 'A weekly roundup of new feedback, decisions and deliveries for your team.',
    question: 'How can teams keep up with customer feedback without watching the inbox all day?',
    alternative: 'Daily activity notifications', tradeoff: 'Daily notifications suit support, but interrupt teams that review feedback once a week.',
    measure: 'Four of six pilot teams replace their manual Friday feedback summary.',
    state: 'ready', status: 'planned', board: 42, tag: 52, daysAgo: 7,
    signals: [
      [4, 'support_conversation', 'Every Friday I copy the new requests into a team update. A weekly digest would give me that hour back.'],
      [5, 'sales_call', 'Our team wants a Monday summary of what changed, especially decisions and shipped items.'],
      [3, 'interview', 'For a client escalation I need the update today. Please keep immediate notifications available too.'],
    ],
  },
  {
    slug: 'saved-feedback-views', title: 'Saved feedback views',
    summary: 'Save a useful combination of feedback filters and return to it in one click.',
    question: 'Which recurring feedback views should teams be able to save and share?',
    alternative: 'Personal filter bookmarks', tradeoff: 'Personal bookmarks avoid shared-view permissions but cannot give a team one queue.',
    measure: 'Pilot teams return to a saved view at least three times in a week.',
    state: 'draft', status: 'exploring', board: 42, tag: 53, daysAgo: 4,
    signals: [
      [5, 'portal_request', 'I rebuild the same filters every morning: unreviewed, enterprise, access management.'],
      [2, 'email', 'Can our customer success team open the same saved queue before the account review?'],
      [4, 'interview', 'A personal bookmark would cover my needs; I do not need a shared view yet.'],
    ],
  },
  {
    slug: 'audit-log-export', title: 'Audit log export',
    summary: 'Download a dated CSV of workspace changes for your audit review.',
    question: 'Did self-serve audit exports remove the recurring support burden?',
    alternative: 'Scheduled audit reports', tradeoff: 'Scheduled delivery is convenient, but customers first need to select and inspect the date range.',
    measure: 'Two finance teams finish an audit review without requesting a custom export.',
    state: 'review_due', status: 'shipped', board: 40, tag: 50, daysAgo: 24,
    signals: [
      [1, 'support_conversation', 'We need the access changes from the last thirty days in a CSV for the auditor.'],
      [0, 'sales_call', 'A dated export with the actor and the change would complete our evidence pack.'],
      [2, 'interview', 'We still need a monthly reminder; a self-serve export alone may get forgotten.'],
    ],
  },
  {
    slug: 'bulk-feedback-triage', title: 'Bulk feedback triage',
    summary: 'Select related feedback and apply tags or mark it reviewed together.',
    question: 'How should support teams clear a busy feedback inbox while keeping attribution?',
    alternative: 'Automatic review rules', tradeoff: 'Rules remove more clicks but can review an important new signal before a person reads it.',
    measure: 'Support clears a fifty-item queue in under fifteen minutes without losing attribution.',
    state: 'committed', status: 'shipped', board: 42, tag: 53, daysAgo: 17,
    signals: [
      [5, 'support_conversation', 'After a launch we get dozens of related notes. Tagging each one separately takes longer than reading them.'],
      [4, 'portal_request', 'Let me select the notes I have read and mark them reviewed together, with one reason.'],
      [1, 'interview', 'We would rather keep an explicit review step than have a rule silently clear the queue.'],
    ],
  },
  {
    slug: 'search-by-customer', title: 'Search by customer',
    summary: 'Find feedback and decisions by customer name alongside matching words.',
    question: 'Can customer-aware search shorten preparation for an account review?',
    alternative: 'A larger customer directory', tradeoff: 'A directory helps browsing but still separates the account from the evidence and decisions.',
    measure: 'Customer success finds the evidence for an account review in under a minute.',
    state: 'committed', status: 'shipped', board: 41, tag: 52, daysAgo: 11,
    signals: [
      [3, 'email', 'Before a client call I want all their feedback and the decisions it influenced in one search.'],
      [2, 'support_conversation', 'Searching an account name should find the evidence even when the quote does not mention the company.'],
      [0, 'interview', 'For our quarterly review I still start at the account page. Please keep that timeline too.'],
    ],
  },
]
