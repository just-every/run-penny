/** Eval-only transport. This is not Penny's PENNY_LEARNING_EGRESS door. */
export function evalTransport(){
 const usage={requests:0,httpStatuses:[]}
 return {usage,send:async request=>{
  if(request.url!=='https://api.openai.com/v1/embeddings'||request.method!=='POST')throw Object.assign(Error(),{code:'eval_destination_refused',safeReason:'The eval transport permits only the OpenAI embeddings endpoint.'})
  // One batched request per invocation, no loop, retry or concurrent call.
  if(usage.requests)throw Object.assign(Error(),{code:'eval_request_limit',safeReason:'This evaluation has already dispatched its embeddings batch.'})
  usage.requests++
  let response
  try{response=await fetch(request.url,{method:'POST',headers:request.headers,body:request.body,redirect:'error',signal:AbortSignal.timeout(120000)})}
  catch{throw Object.assign(Error(),{code:'eval_transport_uncertain',safeReason:'The embeddings call did not return a response. It was not retried.'})}
  usage.httpStatuses.push(response.status)
  return {status:response.status,body:await response.text()}
 }}
}
