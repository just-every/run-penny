import {chromium} from '@playwright/test'
import {createRequire} from 'node:module'
import {readFileSync,readdirSync,statSync} from 'node:fs'
import {basename,dirname,join} from 'node:path'

/** Resolve the headless-shell shipped by the pinned Playwright installation. */
export function headlessExecutable() {
 const testRequire=createRequire(import.meta.resolve('@playwright/test'))
 const playwrightRequire=createRequire(testRequire.resolve('playwright'))
 const root=dirname(playwrightRequire.resolve('playwright-core/package.json'))
 const browser=JSON.parse(readFileSync(join(root,'browsers.json'),'utf8')).browsers.find(item=>item.name==='chromium-headless-shell')
 if(!browser)throw new Error('Pinned Playwright has no headless-shell declaration.')
 let bundle=dirname(chromium.executablePath())
 while(!/^chromium-\d+$/.test(basename(bundle))) {
  const parent=dirname(bundle)
  if(parent===bundle)throw new Error('Pinned Chromium bundle could not be located.')
  bundle=parent
 }
 const directory=join(dirname(bundle),`chromium_headless_shell-${browser.revision}`)
 const executables=readdirSync(directory,{recursive:true}).filter(path=>/^(?:chrome-headless-shell|headless_shell)(?:\.exe)?$/.test(basename(path))&&statSync(join(directory,path)).isFile())
 if(executables.length!==1)throw new Error('Install the pinned Playwright chrome-headless-shell before running browser journeys.')
 return join(directory,executables[0])
}
