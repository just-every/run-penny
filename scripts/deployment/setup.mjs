// Credential-free packaging only. Build first in the credential-free source job.
import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { packageBuild, assertCredentialFree } from '../../base/modules/deploy-kit/prepare.mjs'
import { hash, assert } from '../../base/modules/deploy-kit/validation.mjs'
import { validateMigrations } from '../../base/modules/deploy-kit/migrations.mjs'
assertCredentialFree(process.env)
assert(process.argv.length === 2,'setup-takes-environment-only')
const root=process.cwd(),file=process.env.RER_DEPLOY_ARTIFACT
assert(file && resolve(file)===file && !file.startsWith(root+'/'),'artifact-must-be-absolute-and-outside-checkout')
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
assert(!git('status','--porcelain','--untracked-files=no'),'source-must-be-clean')
const source={sha:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}')}
if(process.env.RER_DEPLOY_SOURCE_SHA)assert(source.sha===process.env.RER_DEPLOY_SOURCE_SHA,'source-sha-mismatch')
const artifact=await packageBuild({root,source,runIdentity:{id:process.env.RER_DEPLOY_RUN_ID,attempt:process.env.RER_DEPLOY_RUN_ATTEMPT},productDirectory:''})
validateMigrations(artifact.migrations.map(({binding:_binding,...migration})=>migration))
const bytes=JSON.stringify(artifact)
await writeFile(file,bytes,{flag:'wx',mode:0o600})
console.log(JSON.stringify({source,sha256:hash(bytes),migrations:artifact.migrations.length,modules:artifact.modules.length,assets:artifact.assets.length}))
