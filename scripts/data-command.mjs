// Product archive commands: private session files, explicit HTTPS or local origins.
import {runDataCommand} from './data/commands.mjs'
import {DataCommandError} from './data/errors.mjs'
try {console.log(JSON.stringify(await runDataCommand(process.argv.slice(2))))}
catch(error) {
 console.error(error instanceof DataCommandError?error.code:'data_command_failed')
 process.exitCode=1
}
