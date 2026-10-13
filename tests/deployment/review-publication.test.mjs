import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read=name=>readFile(new URL('../../'+name,import.meta.url),'utf8')
test('[BASE-PUBLIC-003] the catalogue replacement claim is the owner-approved nominative list',async()=>assert.deepEqual(JSON.parse(await read('seed.json')).replaces,['Canny','UserVoice','Productboard']))
test('[REQ-003 NOTIFY-001] flagship status states the current writable requester board and notification release',async()=>{
 const text=(await read('FLAGSHIP-PLAN.md')).split('## The product')[0]
 assert.match(text,/0\.0\.0/);assert.match(text,/submission/);assert.match(text,/notifications/)
 assert.doesNotMatch(text,/remains.*read-only|remains `ui-port-read-spine`|Stages 1 onward.*unimplemented|82aaf88/)
})
test('[BASE-SECRET-001] public handover and requester record omit private publishing/report paths',async()=>{
 assert.doesNotMatch(await read('HANDOVER.md'),/docs\/PUBLISH\.md|Private development history contains/)
 assert.doesNotMatch(await read('docs/requester-board.md'),/reports\/launch-audit-/)
})
test('[NOTIFY-002] operator and buyer instructions disclose fixed quiet hours and timezone configuration',async()=>{
 for(const file of ['OPERATIONS.md','README.md']){
  const text=await read(file);assert.match(text,/20:00.*08:00/s);assert.match(text,/Australia\/Brisbane/);assert.match(text,/src\/ext\/config\.server\.ts|WORKSPACE_TIMEZONE/)
 }
})
function luminance(hex){const rgb=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
function composite(foreground,background,alpha){const front=foreground.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)),back=background.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16));return '#'+front.map((channel,index)=>Math.round(channel*alpha+back[index]*(1-alpha)).toString(16).padStart(2,'0')).join('')}
async function tokenColors(){
 const brand=await read('src/core/ui/brand/tokens.css'),app=await read('src/index.css'),branding=JSON.parse(await read('src/branding.json'))
 return name=>{
  const value=app.match(new RegExp(`--color-penny-${name}: ([^;]+);`))?.[1]
  // The accent is the configured brand accent; its default lives in src/branding.json.
  const hex=value==='var(--penny-brand-accent)'?branding.accent:value?.startsWith('var(')?brand.match(new RegExp(`--${value.slice(6,-1)}: (#[a-f\\d]{6})`))?.[1]:value
  assert.match(hex??'',/^#[a-f\d]{6}$/,`--color-penny-${name} resolves to a colour`);return hex
 }
}
const contrast=(foreground,background)=>(Math.max(luminance(foreground),luminance(background))+.05)/(Math.min(luminance(foreground),luminance(background))+.05)
test('[BASE-PUBLIC-003] small public/operator text reaches AA on shipped surfaces',async()=>{
 const color=await tokenColors(),sidebar=composite(color('sand'),color('paper'),.45)
 for(const [text,background] of [['ink','paper'],['muted','paper'],['muted','card'],['muted','sand'],['soft','paper'],['accent','paper'],['accent','card'],['moss','paper'],['danger','paper']]){
  const ratio=contrast(color(text),color(background));assert(ratio>=4.5,`${text} on ${background}: ${ratio}`)
 }
 for(const text of ['muted','soft']){const ratio=contrast(color(text),sidebar);assert(ratio>=4.5,`${text} on the operator sidebar (${sidebar}): ${ratio}`)}
 const ratio=contrast(color('paper'),color('ink'));assert(ratio>=4.5,`paper text on the ink pill: ${ratio}`)
})
test('[BASE-PUBLIC-003] every status chip tone keeps small-text AA on its actual tinted fill over paper and cards',async()=>{
 const color=await tokenColors(),chip=await read('src/core/ui/app/Chip.tsx')
 const tones=[...chip.matchAll(/^ {2}'?([\w-]+)'?: '([^']*)',$/gm)]
 assert(tones.length>=5,'chip tones are declared')
 for(const [,tone,classes] of tones){
  const text=classes.match(/text-penny-([\w-]+)/)[1],fill=classes.match(/bg-penny-([\w-]+)(?:\/(\d+))?/),transparent=/bg-transparent/.test(classes)
  assert(fill||transparent,`${tone} declares its fill`)
  for(const backdrop of ['paper','card']){
   const background=transparent?color(backdrop):composite(color(fill[1]),color(backdrop),fill[2]?Number(fill[2])/100:1)
   const ratio=contrast(color(text),background);assert(ratio>=4.5,`${tone} chip on ${backdrop} (${background}): ${ratio}`)
  }
 }
})
test('[REL-011 BASE-SECRET-002] install plan carries the selected event verification binding when configured',async()=>{
 const {pennyPlan}=await import('../../scripts/deployment/plan.mjs')
 for(const [mailProvider,key] of [['sendgrid','SENDGRID_EVENT_PUBLIC_KEY'],['resend','RESEND_WEBHOOK_SECRET']]){
  const plan=pennyPlan({migrations:[]},{origin:'https://rer-seedproof-penny.example.workers.dev',mailFrom:'no-reply@example.com',mailProvider,eventVerification:true})
  assert(plan.secrets.some(secret=>secret.binding===key&&secret.environment===key))
 }
})
