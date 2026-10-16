/** What another tool sends to a signed internal-note receiver (Base's
 * verifyWebhook): the receiver checks it, Settings shows it and "Send a test"
 * signs with it. */
export const RECEIVER_TENANT='penny-inbound',RECEIVER_EVENT='request.note'
export const signedText=(destinationId:string,id:string,timestamp:string,body:string)=>JSON.stringify(['integrations.webhook.v1',RECEIVER_TENANT,destinationId,RECEIVER_EVENT,id,timestamp,body])
