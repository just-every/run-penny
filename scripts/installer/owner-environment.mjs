import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ownerWorkerName } from '../../base/modules/deploy-kit/owner.mjs'

// Base declarations name bindings; the caller's environment names the install.
// Penny's runtime accepts production or preview for hosted installations.
export async function ownerDeclaration(root, environment = 'production') {
  const declaration = JSON.parse(await readFile(join(root, 'deploy.json'), 'utf8'))
  const worker = ownerWorkerName(declaration.project, environment)
  declaration.vars = { ...declaration.vars, PENNY_ENVIRONMENT: environment === 'production' ? 'production' : 'preview' }
  const directory = environment === 'production' ? ['.rer', 'deploy'] : ['.rer', 'deploy', 'environments', environment]
  const file = name => [...directory, environment === 'production' ? `production${name === 'state' ? '' : `-${name}`}.json` : `${name}.json`].join('/')
  return {
    declaration, environment, worker, directory,
    stateFile: file('state'), credentialFile: file('secrets'), declarationFile: file('declaration'),
  }
}
