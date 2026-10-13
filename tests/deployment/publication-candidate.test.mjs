import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync,writeFileSync,mkdirSync,rmSync,chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inspectPublicationCandidate,assertCandidateRefs } from '../../scripts/publication-custody.mjs'
const git=(repo,...args)=>execFileSync('git',['-C',repo,...args],{stdio:['ignore','pipe','pipe']}).toString().trim()
function commit(repo){git(repo,'add','.');git(repo,'-c','user.name=Release preparation','-c','user.email=release@example.invalid','commit','-m','Prepare source');return git(repo,'rev-parse','HEAD')}
function init(repo){mkdirSync(repo);git(repo,'init','-b','main');writeFileSync(join(repo,'edition.json'),JSON.stringify({id:'just-every/penny'}));writeFileSync(join(repo,'rer-project.json'),JSON.stringify({projectId:'just-every/penny',sourceRepository:'https://github.com/just-every/run-penny'}));writeFileSync(join(repo,'run.mjs'),'export const ready=true\n');chmodSync(join(repo,'run.mjs'),0o755);return commit(repo)}
test('[BASE-SECRET-001] exact parentless raw tree and executable modes have no imported refs',()=>{
 const root=mkdtempSync(join(tmpdir(),'penny-publication-custody-'))
 try{
  const source=join(root,'source'),candidate=join(root,'candidate'),ref=init(source);init(candidate)
  const receipt=inspectPublicationCandidate(source,ref,candidate)
  assert.equal(receipt.commits,1);assert.equal(receipt.tags,0);assert.equal(receipt.rawBlobsEqual,true);assert.equal(receipt.modesEqual,true)
  git(candidate,'update-ref','refs/remotes/private/main',git(candidate,'rev-parse','HEAD'));assert.throws(()=>inspectPublicationCandidate(source,ref,candidate),/custody refused/);git(candidate,'update-ref','-d','refs/remotes/private/main')
  const changedMode=join(root,'changed-mode');init(changedMode);git(changedMode,'update-ref','-d','refs/heads/main');git(changedMode,'checkout','--orphan','main');chmodSync(join(changedMode,'run.mjs'),0o644);commit(changedMode);assert.throws(()=>inspectPublicationCandidate(source,ref,changedMode),/custody refused/)
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('[BASE-SECRET-001 BASE-INPUT-001] mismatched destination, changed bytes, extra history and tag inventory refuse',()=>{
 assert.throws(()=>assertCandidateRefs(['refs/heads/main','refs/tags/fixture'],1),/custody refused/)
 assert.throws(()=>assertCandidateRefs(['refs/heads/main'],2),/custody refused/)
 const root=mkdtempSync(join(tmpdir(),'penny-publication-refusal-'))
 try{
  const source=join(root,'source'),candidate=join(root,'candidate');init(source);init(candidate)
  writeFileSync(join(source,'rer-project.json'),JSON.stringify({projectId:'just-every/penny',sourceRepository:'https://github.com/actions/checkout'}));const wrong=commit(source)
  assert.throws(()=>inspectPublicationCandidate(source,wrong,candidate),/custody refused/)
  const clean=join(root,'clean'),ref=init(clean);writeFileSync(join(candidate,'run.mjs'),'export const ready=false\n');commit(candidate)
  assert.throws(()=>inspectPublicationCandidate(clean,ref,candidate),/custody refused/)
 }finally{rmSync(root,{recursive:true,force:true})}
})
