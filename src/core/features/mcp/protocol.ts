import type {ContentfulStatusCode} from 'hono/utils/http-status'
import {z} from 'zod'
export const protocolVersion='2025-11-25'
export const envelope=z.object({jsonrpc:z.literal('2.0'),id:z.union([z.string().max(128),z.number().int()]).optional(),method:z.string().min(1).max(128),params:z.unknown().optional()}).strict()
export const initializeInput=z.object({protocolVersion:z.string().min(1).max(32),capabilities:z.record(z.string(),z.unknown()),clientInfo:z.object({name:z.string().min(1).max(200),version:z.string().min(1).max(128)}).passthrough()}).passthrough()
export const toolCallInput=z.object({name:z.string().min(1).max(64),arguments:z.record(z.string(),z.unknown()).default({}),_meta:z.record(z.string(),z.unknown()).optional()}).strict()
export const listInput=z.object({_meta:z.record(z.string(),z.unknown()).optional()}).strict()
export class McpError extends Error{
 readonly code:number
 readonly status:ContentfulStatusCode
 constructor(code:number,message:string,status:ContentfulStatusCode=400){super(message);this.code=code;this.status=status}
}
export function transport(request:Request,origin:string){
 const supplied=request.headers.get('Origin')
 if(supplied&&supplied!==origin)throw new McpError(-32000,'Origin refused.',403)
 if(new URL(request.url).search)throw new McpError(-32600,'The endpoint accepts no query parameters.')
 if(request.method!=='POST')throw new McpError(-32601,'Only POST is supported.',405)
 const accepts=(request.headers.get('Accept')??'').split(',').map(value=>value.split(';')[0].trim().toLowerCase())
 if(!accepts.includes('application/json')||!accepts.includes('text/event-stream'))throw new McpError(-32600,'Accept must include application/json and text/event-stream.',406)
 if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new McpError(-32600,'Use application/json.',415)
}
