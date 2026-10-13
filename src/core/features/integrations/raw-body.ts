import {NativeError} from '../auth/native-tokens'
export async function boundedRawBody(request:Request,limit=32768):Promise<Uint8Array> {
 const reader=request.body?.getReader();if(!reader)throw new NativeError('validation_failed',400)
 const parts:Uint8Array[]=[];let size=0
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();throw new NativeError('integration_request_limit',413)}parts.push(part.value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}return bytes
}
