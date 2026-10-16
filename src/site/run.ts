import type { RunData } from '../base/run-site'

export const run: RunData = {
  name: 'Penny',
  repository: 'https://github.com/just-every/run-penny',
  clone: 'npx -y @runeditrun/rer dev just-every/run-penny',
  folder: 'run-penny',
  requirements: 'Runs on macOS, Linux or Windows with WSL2. With rer available, it bootstraps the pinned Node 22.20.0 and pnpm 10.12.4 in its own cache; no pnpm preinstall is needed.',
  licence: 'MIT',
  docs: true,
  hosted: [],
}
