// The app's line icons on a 24px grid, drawn in the current colour: the operator navigation, row and section marks, and the
// marks inside chips and icon discs. One set, so a meaning keeps one picture across the portal, the operator app and sign-in.
const iconPaths = {
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Zm5.3-2.2L21 21',
  moderation: 'M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  settings: 'M19.25 10.53 21.42 10.77 21.42 13.23 19.25 13.47 18.17 16.09 19.53 17.79 17.79 19.53 16.09 18.17 13.47 19.25 13.23 21.42 10.77 21.42 10.53 19.25 7.91 18.17 6.21 19.53 4.47 17.79 5.83 16.09 4.75 13.47 2.58 13.23 2.58 10.77 4.75 10.53 5.83 7.91 4.47 6.21 6.21 4.47 7.91 5.83 10.53 4.75 10.77 2.58 13.23 2.58 13.47 4.75 16.09 5.83 17.79 4.47 19.53 6.21 18.17 7.91ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  data: 'M4 6c0-4 16-4 16 0s-16 4-16 0Zm0 0v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0',
  overview: 'M4 12.5 12 5l8 7.5v6.25A1.25 1.25 0 0 1 18.75 20h-13.5A1.25 1.25 0 0 1 4 18.75V12.5Zm5.25 7.5v-5h5.5v5',
  feedback: 'M4 4.75A2.75 2.75 0 0 1 6.75 2h10.5A2.75 2.75 0 0 1 20 4.75v7.5A2.75 2.75 0 0 1 17.25 15H11l-4.25 3v-3H6.75A2.75 2.75 0 0 1 4 12.25v-7.5Z',
  // A ruled sheet: the brief a decision is written on.
  decisions: 'M6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3Zm2 4.5h7m-7 4h7m-7 4h4',
  roadmap: 'M4 5.25 9.25 3l5.5 2.25L20 3v15.75L14.75 21l-5.5-2.25L4 21V5.25Zm5.25-2.25v15.75m5.5-13.5V21',
  releases: 'M12 3 19.5 7v10L12 21l-7.5-4V7L12 3Zm0 9 7.5-5M12 12 4.5 7M12 12v9',
  accounts: 'M3 19.5a6 6 0 0 1 12 0M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm6.5-6.8a3.5 3.5 0 0 1 0 6.6M17 14.2a6 6 0 0 1 4 5.3',
  arrow: 'm9 18 6-6-6-6',
  calendar: 'M6.5 3v3m11-3v3M4 9h16M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5Z',
  evidence: 'M7 3.5h7.5L19 8v12.5H7A2 2 0 0 1 5 18.5v-13A2 2 0 0 1 7 3.5Zm7.5 0V8H19M8.5 12h7M8.5 15.5h5',
  external: 'M13 5h6v6M19 5l-8.5 8.5M18 13v5.25A1.75 1.75 0 0 1 16.25 20h-10.5A1.75 1.75 0 0 1 4 18.25V7.75A1.75 1.75 0 0 1 5.75 6H11',
  warning: 'M12 3.5 21 20H3l9-16.5ZM12 9v4.5m0 3h.01',
  check: 'm5.5 12 4 4L18.5 7',
  signout: 'M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14m-3.5-8H20m-3.5-3.5L20 12l-3.5 3.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  plus: 'M12 5v14M5 12h14',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.5V12l3 2',
  minus: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM8 12h8',
  mail: 'M4.5 5.5h15A1.5 1.5 0 0 1 21 7v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5Zm-1 1 8.5 7 8.5-7',
  key: 'M15 14a5 5 0 1 0-4.6-3L3 18.5V21h3v-2h2v-2h2l1.4-1.4A5 5 0 0 0 15 14Zm1.5-6.5h.01',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  plug: 'M9 3v5m6-5v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0V8Zm5.5 8.5V21',
  palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.6-1-2.7 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Zm-4.5 9.5h.01M9 7.5h.01m5 0h.01',
  board: 'M5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4Zm3.83 0v16m5.34-16v16',
  tag: 'M3.5 12.5v-8a1 1 0 0 1 1-1h8l8 8-9 9-8-8Zm4.5-4.5h.01',
  form: 'M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5ZM8.5 8h7m-7 4h7m-7 4h4',
} as const

export type IconName = keyof typeof iconPaths

/** A line icon. Decorative: the label beside it carries the meaning. */
export function Icon({ name, className = 'size-4', strokeWidth = 1.8 }: { readonly name: IconName; readonly className?: string; readonly strokeWidth?: number }) {
  return <svg width="16" height="16" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>
}

const discSizes = {
  /** Beside a label in a chip-sized line, such as a linked quote. */
  small: { disc: 'size-9 bg-penny-sand text-penny-ink', icon: 'size-[18px]' },
  /** Rows and cards. */
  row: { disc: 'size-11 bg-penny-sand text-penny-ink', icon: 'size-5' },
  /** A settings-style section head. */
  section: { disc: 'size-14 bg-penny-sand text-penny-ink', icon: 'size-6' },
  /** A load failure. */
  error: { disc: 'size-14 bg-penny-danger-wash text-penny-danger sm:size-22', icon: 'size-7 sm:size-10' },
} as const

/** The landing's point marker: a sand circle with a centred ink line icon (danger on its wash for an error). */
export function IconDisc({ name, size = 'row', className = '' }: { readonly name: IconName; readonly size?: keyof typeof discSizes; readonly className?: string }) {
  const { disc, icon } = discSizes[size]
  return <span className={`grid shrink-0 place-items-center rounded-full ${disc} ${className}`.trim()} aria-hidden="true"><Icon name={name} className={icon} strokeWidth={1.6} /></span>
}

/** Done or all clear: a filled moss disc with a pale check. */
export function DoneMark({ className = 'size-4' }: { readonly className?: string }) {
  return <svg className={`shrink-0 text-penny-moss ${className}`} viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor" /><path d="m4.6 8.2 2.2 2.2 4.6-4.8" fill="none" stroke="#fdfbf6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
