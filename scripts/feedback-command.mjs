#!/usr/bin/env node
import { feedbackCommand } from './feedback/import.mjs'
try {console.log(JSON.stringify(await feedbackCommand(process.argv.slice(2))))}
catch(error) {console.error(error?.name==='DataCommandError'?error.message:'Saved feedback action refused. Check the private files, current operator session, reviewed fingerprint and saved job state.');process.exitCode=1}
