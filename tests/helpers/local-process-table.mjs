export { readProcessTable, parseLinuxProcess, validPid, inspectionMs } from '../../scripts/base-onboarding/process-table.mjs'
import { readProcessTable } from '../../scripts/base-onboarding/process-table.mjs'
// Independent numeric birth observations never inspect private argv.
export const readOwnedGroup = (pgid, timeout) => readProcessTable(timeout, pgid)
export const sameProcess = (left, right) => left?.pid === right?.pid && left?.pgid === right?.pgid && left?.birth === right?.birth
