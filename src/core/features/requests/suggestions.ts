import { publicRequestPredicate } from './publication-predicate'
/** Whole lexical terms, deterministic overlap rank, with no identity or evidence projection. */
export const lexicalTerms=(text:string)=>[...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[])].filter(term=>term.length>1)
export async function requestSuggestions(db:D1Database,title:string,operator=false){
 const terms=lexicalTerms(title)
 if(!terms.length)return []
 const titleColumn=operator?'r.title':'r.public_title',descriptionColumn=operator?'r.description':'r.public_description'

 const candidates=`SELECT r.id,r.slug,r.terms
 FROM ${operator?'penny_suggestions_operator_rows':'penny_suggestions_public_rows'} r
 JOIN boards b ON b.id=r.board_id ${operator?'':'LEFT JOIN blocked author ON author.id=r.author_requester_id'}
 WHERE ${operator?'r.merged_into_request_id IS NULL':`${publicRequestPredicate} AND b.archived_at IS NULL AND r.public_state!='unpublished'`}`
 // Indexed ASCII terms rank inside D1. Other wording retains the complete
 // matcher below; ASCII wording cannot match a non-ASCII query term.
 const asciiTerms=terms.filter(term=>/^[a-z0-9]+$/.test(term))
 const score=asciiTerms.map(()=>`CASE WHEN instr(terms,?)>0 THEN 1 ELSE 0 END`).join('+')||'0'
 const selection=asciiTerms.length?`indexed AS MATERIALIZED (${candidates}), ranked AS (
 SELECT id,(${score}) AS matches FROM indexed WHERE terms IS NOT NULL ORDER BY matches DESC,slug LIMIT 5
 ), selected AS (
 SELECT id FROM ranked WHERE matches>0 UNION ALL SELECT id FROM indexed WHERE terms IS NULL
 )`:`selected AS (${candidates} AND r.terms IS NULL)`
 // With no ASCII query terms, only NULL-terms wording can match. Filter the
 // existing view first, without limiting candidates before the whole-term match.
 const query=`WITH blocked AS MATERIALIZED (SELECT id,blocked_at FROM requesters WHERE blocked_at IS NOT NULL),
 ${selection} SELECT r.id,r.slug,b.show_voters AS showVoters,${titleColumn} AS title,${descriptionColumn} AS description
 FROM selected JOIN requests r ON r.id=selected.id JOIN boards b ON b.id=r.board_id`
 const rows=await db.prepare(query).bind(...asciiTerms.map(term=>` ${term} `)).all<{id:string;slug:string;showVoters:number;title:string;description:string}>()
 return rows.results.map(row=>{const words=new Set(lexicalTerms(`${row.title}\n${row.description}`));return {...(operator?{id:row.id}:{showVoters:!!row.showVoters}),slug:row.slug,title:row.title,description:row.description,matchedTerms:terms.filter(term=>words.has(term))}})
 .filter(row=>row.matchedTerms.length).sort((a,b)=>b.matchedTerms.length-a.matchedTerms.length||(a.slug<b.slug?-1:a.slug>b.slug?1:0)).slice(0,5)
}
