/** The workspace's IANA time zone, which every time the operator app writes is shown in. The app shell sets it from the
 * saved workspace clock before its pages render (useWorkspaceZoneSync); UTC until then, which is what an unconfirmed
 * workspace uses. */
let zone = 'UTC'

export function workspaceTimezone(): string { return zone }

export function setWorkspaceTimezone(next: string): void { zone = next }
