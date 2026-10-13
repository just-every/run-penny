import type {TrustedTransport,WireRequest,WireResponse} from '../../../../base/modules/integrations/core/types.ts'
import {validateDestination} from '../../../../base/modules/integrations/core/destination.ts'
import type {PennyRuntime} from '@/core/app/runtime'
import {NativeError} from '../auth/native-tokens'

/** Installation-owned RPC port. Its service must enforce public DNS/IP at
 * connect time, verified TLS, no redirects and bounded requests/responses.
 * A fetch binding does not implement this contract. */
export interface EnforcingEgress {send(request:WireRequest):Promise<WireResponse>}
export function integrationTransport(runtime:PennyRuntime):TrustedTransport {
 const port=runtime.bindings.PENNY_EGRESS
 if(!port)throw new NativeError('integration_transport_unconfigured',503)
 return {send:async wire=>{
  validateDestination(wire.url)
  if(new TextEncoder().encode(wire.body).length>1024*1024)throw new Error('integration_request_limit')
  const response=await port.send(wire)
  if(!Number.isInteger(response.status)||response.status<100||response.status>599||typeof response.body!=='string'||new TextEncoder().encode(response.body).length>65536)throw new Error('integration_response_limit')
  return response
 }}
}
