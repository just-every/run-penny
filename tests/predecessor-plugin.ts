import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
const root = fileURLToPath(new URL('../', import.meta.url))
const names = new Set(['operator','mail','repository','session','native-service','first-run'])
// These services use Base sessions and transaction guards over oa_* tables.
// Historical board credentials cannot stand in for their native authority.
const nativeOperatorFeatures = new Set(['integrations','data','decisions','releases','imports','editor'])
// Only the predecessor identity entry points use its retained mail transport.
// Current notification delivery and native Base auth keep the real mail adapter.
const historicalMailConsumers = new Set([
 'src/core/features/auth/native-routes.ts',
 'src/core/features/auth/native-service.ts',
 'src/core/features/requests/native-routes.ts',
].map(path=>resolve(root,path)))
export function predecessorAuth(): Plugin {
 return { name:'penny-predecessor-auth-only', enforce:'pre', resolveId(id,importer) {
  const source = id.startsWith('@/') ? resolve(root,'src',id.slice(2)) : id.startsWith('.') && importer ? resolve(importer.split('?')[0],'..',id) : id
  const match = /\/src\/core\/features\/auth\/([\w-]+)(?:\.ts)?$/.exec(source)
  if (!match || !names.has(match[1]) || source.includes('/tests/predecessor-src-root/')) return null
  const importingFile = importer?.split('?')[0]
  const importingFeature = importingFile && /\/src\/core\/features\/([^/]+)\//.exec(importingFile)?.[1]
  if (match[1]==='operator' && importingFeature && nativeOperatorFeatures.has(importingFeature)) return null
  if (match[1]==='mail' && (!importingFile || !historicalMailConsumers.has(importingFile))) return null
  return resolve(root,'tests/predecessor-src-root/src/core/features/auth',match[1]+'.ts')
 }, transform(code,id) {
  if (id.split('?')[0] === resolve(root,'src/routes/__root.tsx'))return code.replace(/^import \{loadEditorAdmission\}[^\n]+\n/m,'').replace(/^  loader: \(\) => loadEditorAdmission\(\),\n/m,'')
  if (id.split('?')[0] !== resolve(root,'src/core/app/api.ts')) return null
  // This auth-only historical fixture predates native import admission. Keep
  // new native imports, claims and editor admission out of that older graph.
  return code.replace(/^import {registerEditorRoutes}[^\n]+\n/m,'')
   .replace(/^import \{ registerOwnerClaimRoutes \}[^\n]+\n/m,'')
   .replace(/^import \{ registerDependencyRoutes \}[^\n]+\n/m,'')
   .replace(/^  registerDependencyRoutes\(app\)\n/m,'')
   .replace(/^  registerEditorRoutes\(app\)\n/m,'')
   .replace(/^  registerOwnerClaimRoutes\(app\)\n/m,'')
   .replace(/^import \{ registerFeedbackImportRoutes \} from [^\n]+\n/m,'')
   .replace(/^  registerFeedbackImportRoutes\(app\)\n/m,'')
   // Current data recovery owns native admission. Register it before the
   // predecessor workspace's broad historical-cookie middleware so restored
   // legacy credential revocation cannot reject a preserved native owner.
   .replace(/^  registerDataRoutes\(app\)\n/m,'')
   .replace(/^  registerWorkspaceReadRoutes\(app\)\n/m,'  registerDataRoutes(app)\n  registerWorkspaceReadRoutes(app)\n')
 } }
}
