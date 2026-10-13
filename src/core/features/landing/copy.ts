// Every word on the landing page, prose and drawings alike (the header and footer are the shared site chrome's,
// src/core/ui/site/site.ts). Edit copy here; the sections and drawings only lay it out.
// Each capability named is one Penny ships (CONTRACT.md, HOME-002): the moderated public board with email-verified votes and
// duplicate suggestions, recorded evidence and committed decisions, the public roadmap and release notes with quiet-hours
// email through SendGrid or Resend, private commercial context, and self-hosting with a downloadable archive of the business
// data (the operator app's Data screen; docs/DATA.md gives its limits). The board drawing uses the
// public portal's own labels. A headline's `key` must appear in its `title`; it is the phrase drawn with the copper stroke.
export const copy = {
  meta: {
    title: 'Penny — Every customer, heard.',
    description: 'Collect requests, decide with real evidence, and tell everyone who asked when it ships. Open source. 100% free, open source alternative to Canny, UserVoice and Productboard.',
  },
  skip: 'Skip to content',
  hero: {
    title: 'Every customer, heard.',
    key: 'heard.',
    sub: 'Collect requests, decide with real evidence, and tell everyone who asked when it ships. Open source.',
    // Plain text for search and for people who need to know what Penny replaces; the owner's own wording (12 Oct 2026).
    alternative: { lead: '100% free, open source alternative to', names: ['Canny', 'UserVoice', 'Productboard'] },
    primary: 'Deploy your own',
    secondary: 'Read the docs',
  },
  board: {
    eyebrow: 'The board',
    title: 'A board your customers will actually use.',
    key: 'actually use.',
    body: 'Customers post requests, vote, follow and comment on a public board. Nothing goes public until you approve it.',
    points: ['Duplicate suggestions before anyone posts', 'Email-verified votes, one per address', 'Statuses everyone understands'],
  },
  evidence: {
    eyebrow: 'Evidence',
    title: 'Decide with evidence, not the loudest voice.',
    key: 'the loudest',
    body: 'Record what you hear on sales calls, in support conversations, in interviews and by email. Compare your options against it, then commit to one and say why.',
    points: ['Every quote keeps its source', 'Options side by side', 'One accountable decision'],
  },
  loop: {
    eyebrow: 'Close the loop',
    title: 'Tell everyone who asked.',
    key: 'who asked.',
    body: 'When the roadmap moves, followers hear about it. When it ships, the release note goes to every customer who asked — held during your quiet hours.',
    points: ['Public roadmap and updates', 'Release notes in your own words', 'Email updates'],
  },
  privacy: {
    eyebrow: 'Private by default',
    title: 'What’s private stays private.',
    key: 'stays private.',
    body: 'Account names, revenue, evidence sources and internal notes never reach a public page, an email or a search engine. Customers see only what you publish.',
    points: ['Customer-safe wording you approve', 'Internal boards and notes', 'No tracking, no cookies on public pages'],
  },
  yours: {
    eyebrow: 'Yours',
    title: 'Yours to run, yours to change.',
    key: 'yours to change.',
    body: 'Penny is MIT-licensed source. Download an archive of your business data from the operator app, and change anything with your own coding agent.',
    points: ['One Worker', 'Download a data archive', 'No telemetry'],
  },
  closing: {
    title: 'Give every customer an answer.',
    key: 'an answer.',
    primary: 'Deploy your own',
    secondary: 'Read the docs',
  },
  // The drawings. Each `label` is the drawing's accessible description; the rest is text drawn inside it.
  art: {
    hero: {
      label: 'Paper collage of a request’s journey: a feature request note with 248 votes moves to a status note marked Planned, In progress and Shipped, past a mountain with a flag, and a letter saying “It’s live — thanks for asking.” flies back to the customer as a paper plane.',
      request: 'Feature request',
      votes: '248',
      statuses: ['Planned', 'In progress', 'Shipped'],
      // The letter's lines as written; “live —” never parts, so a narrow note breaks after the dash.
      letter: ['It’s live\u00a0— thanks', 'for asking.'],
    },
    board: {
      label: 'Drawing of a public feedback board ordered by most votes, with a Submit feedback button and three requests: Dark mode with 248 votes is In progress, Export to CSV with 173 votes is Planned and Custom branding with 96 votes is Under review. A customer’s comment “This would be amazing!” carries an Approved stamp, and another says “+1 — we need this too.”',
      title: 'Feedback',
      sort: ['Most votes', 'Recent activity'],
      submit: 'Submit feedback',
      rows: [
        { title: 'Dark mode', votes: '248', status: 'In progress', comments: '32' },
        { title: 'Export to CSV', votes: '173', status: 'Planned', comments: '18' },
        { title: 'Custom branding', votes: '96', status: 'Under review', comments: '12' },
      ],
      quote: '“This would be amazing!”',
      stamp: 'Approved',
      reply: '“+1 — we need this too.”',
    },
    evidence: {
      label: 'Drawing of a decision sheet comparing two options, Export to CSV and Dark mode, with clipped notes from a sales call, a support conversation and an email attached as evidence. Export to CSV is circled in copper as the chosen option.',
      sheet: 'What do we build next?',
      options: [
        { mark: 'A', title: 'Export to CSV' },
        { mark: 'B', title: 'Dark mode' },
      ],
      why: 'Because…',
      clips: ['Sales call', 'Support conversation', 'Email'],
    },
    loop: {
      label: 'Drawing of a roadmap note moving from Under review through In progress to Shipped, an update email titled “Dark mode is here” with a Read update button, a paper plane looping back to the customer, and a note saying “Same customers. Real follow through.”',
      roadmap: 'Roadmap',
      stages: ['Under review', 'In progress', 'Shipped'],
      letterTitle: 'Dark mode is here',
      letterBody: 'Hi there, the feature you asked for is live today.',
      button: 'Read update',
      // Each note's lines as written; the last line carries the inked sign-off.
      note: ['Same customers.', 'Real follow through.'],
    },
    privacy: {
      label: 'Drawing of a locked card listing account names, revenue, evidence sources and internal notes, beside a note saying “Your context stays with you.”',
      fields: ['Account names', 'Revenue', 'Evidence sources', 'Internal notes'],
      note: ['Your context', 'stays with you.'],
    },
    yours: {
      label: 'Drawing of a parcel tied with string and tagged MIT, beside a terminal note on paper running pnpm run setup, pnpm run dev and pnpm run deploy.',
      tag: 'MIT',
      prompt: '$',
      commands: ['pnpm run setup', 'pnpm run dev', 'pnpm run deploy'],
      note: ['Yours to keep.'],
    },
  },
} as const
