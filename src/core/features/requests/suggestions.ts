import { publicRequestPredicate } from './publication-predicate'
/** Whole lexical terms, deterministic overlap rank, with no identity or evidence projection. */
export const lexicalTerms=(text:string)=>[...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[])].filter(term=>term.length>1)
export async function requestSuggestions(db:D1Database,title:string,operator=false){
 const terms=lexicalTerms(title)
 if(!terms.length)return []
 const titleColumn=operator?'r.title':'r.public_title',descriptionColumn=operator?'r.description':'r.public_description'

 const rows=await db.prepare(`SELECT r.id,r.slug,${titleColumn} AS title,${descriptionColumn} AS description
 FROM requests r JOIN boards b ON b.id=r.board_id LEFT JOIN requesters author ON author.id=r.author_requester_id
 WHERE ${operator?'r.merged_into_request_id IS NULL':`${publicRequestPredicate} AND b.archived_at IS NULL AND r.public_state!='unpublished'`}`).all<{id:string;slug:string;title:string;description:string}>()
 return rows.results.map(row=>{const words=new Set(lexicalTerms(`${row.title}\n${row.description}`));return {...(operator?{id:row.id}:{}),slug:row.slug,title:row.title,description:row.description,matchedTerms:terms.filter(term=>words.has(term))}})
 .filter(row=>row.matchedTerms.length).sort((a,b)=>b.matchedTerms.length-a.matchedTerms.length||(a.slug<b.slug?-1:a.slug>b.slug?1:0)).slice(0,5)
}
