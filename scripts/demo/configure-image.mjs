// Managed Worker packaging requires public mail placeholders. Container images
// receive declared secrets at runtime and cannot carry those same placeholders.
// Scope this change to the disposable run-demo checkout before its image build.
import { readFileSync, writeFileSync } from 'node:fs'
import { parseJsonc } from '@runeditrun/rer/jsonc'
const file = 'wrangler.jsonc'
const config = parseJsonc(readFileSync(file, 'utf8'))
const declaration = JSON.parse(readFileSync('deploy.json', 'utf8'))
for (const { binding } of declaration.secrets ?? []) {
  if (!Object.hasOwn(config.vars ?? {}, binding)) continue
  if (config.vars[binding] !== '') throw Error(`Demo image requires an empty placeholder for ${binding}`)
  delete config.vars[binding]
}
writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
