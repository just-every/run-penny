import type {runView} from './runs'
export type RedactionRun=Awaited<ReturnType<typeof runView>>
export const activeRun=(run:RedactionRun|null)=>run?.state==='previewing'||run?.state==='running'
export const recordCount=(count:number)=>`${count} record${count===1?'':'s'}`
// Penny's own words: a server's message is shown, a browser's network or parse error never is.
export const errorMessage=(error:unknown,otherwise:string)=>error instanceof TypeError?"Couldn't reach Penny. Try again.":error instanceof Error&&error.constructor===Error?error.message:otherwise
