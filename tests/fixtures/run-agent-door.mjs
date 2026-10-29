/** Penny's focused public-door check uses the installed, pinned release CLI. */
import {checkAgentDoor} from '../../node_modules/@runeditrun/rer/cli/agent-door.mjs'
try {
 await checkAgentDoor(process.cwd())
} catch (error) {
 console.error(error.code ?? 'agent_conformance_failed', error.message)
 process.exitCode = 1
}
