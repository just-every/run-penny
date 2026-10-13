export class DataCommandError extends Error {
 constructor(code) { super(code); this.name='DataCommandError'; this.code=code }
}
export function refuse(code) { throw new DataCommandError(code) }
