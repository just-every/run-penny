import type {runView} from './runs'
export type RedactionRun=Awaited<ReturnType<typeof runView>>
export const activeRun=(run:RedactionRun|null)=>run?.state==='previewing'||run?.state==='running'
export const recordCount=(count:number)=>`${count} record${count===1?'':'s'}`
export const errorMessage=(error:unknown,otherwise:string)=>error instanceof Error?error.message:otherwise
