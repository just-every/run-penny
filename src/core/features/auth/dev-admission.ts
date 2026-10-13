// The dev layer registers its key gate here on every local dev request; a
// deployed Worker never does, so devAdmitted is false there.
export { devAdmitted } from '../../../../base/modules/operator-auth/dev-admission.mjs'
