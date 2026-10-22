import {chromium} from '@playwright/test'
import {headlessExecutable} from './headless-executable.mjs'

export function browserOptions() {
 const configured=process.env.PENNY_BROWSER_EXECUTABLE
 // Older entries supply chromium.executablePath(), which names full Chromium.
 // Their managed default must use the pinned headless-shell as well.
 const executablePath=!configured||configured===chromium.executablePath()?headlessExecutable():configured
 if(!/chrome-headless-shell|headless_shell/.test(executablePath))throw new Error('Browser journeys require Playwright chrome-headless-shell.')
 return {headless:true,args:['--disable-gpu','--use-mock-keychain','--password-store=basic'],executablePath}
}
