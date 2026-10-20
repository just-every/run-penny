/** Deterministic paid-edge output; the product supplies every source identifier. */
export function draftNetwork(input:{task:string;sources:{id:string;text:string}[]},privateName='Secret Acme account'){
 const evidence=input.sources.find(s=>s.id.startsWith('evidence:'))??input.sources[0]
 const discussion=input.sources.find(s=>s.id.startsWith('comment:'))??input.sources[0]
 return {paragraphs:[{text:input.task==='reply'?`${privateName}, thank you for explaining the report export problem. We are reviewing the evidence and have not committed to a delivery date.`:'The stored evidence describes report export friction. The discussion provides context for reviewing the workflow; a delivery outcome is not established.',citationIds:[evidence.id,discussion.id,'evidence:missing-record']}]}
}
