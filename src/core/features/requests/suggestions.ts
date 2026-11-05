import { publicRequestPredicate } from './publication-predicate'
/** Whole lexical terms, deterministic overlap rank, with no identity or evidence projection. */
export const lexicalTerms=(text:string)=>[...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[])].filter(term=>term.length>1)
export async function requestSuggestions(db:D1Database,title:string,operator=false){
 const terms=lexicalTerms(title)
 if(!terms.length)return []
 const titleColumn=operator?'r.title':'r.public_title',descriptionColumn=operator?'r.description':'r.public_description'

 const candidates=`SELECT r.id,r.slug,b.show_voters AS showVoters,${titleColumn} AS title,${descriptionColumn} AS description
 FROM requests r JOIN boards b ON b.id=r.board_id LEFT JOIN requesters author ON author.id=r.author_requester_id
 WHERE ${operator?'r.merged_into_request_id IS NULL':`${publicRequestPredicate} AND b.archived_at IS NULL AND r.public_state!='unpublished'`}`
 // Rank ASCII wording inside D1 so a large board does not transfer every row.
 // Unicode wording retains the complete lexical matcher below. ASCII wording
 // cannot match a non-ASCII term, so only its ASCII query terms need ranking.
 const asciiTerms=terms.filter(term=>/^[a-z0-9]+$/.test(term)),nonAscii='*[^\u0001-\u007f]*'
 const wording="coalesce(title,'null')||char(10)||coalesce(description,'null')"
 const score=asciiTerms.map(()=>`CASE WHEN matchText GLOB ? THEN 1 ELSE 0 END`).join('+')||'0'
 const query=`WITH visible AS (${candidates}), candidates AS MATERIALIZED (
 SELECT *,(' '||lower(${wording})||' ') AS matchText,(${wording}) GLOB ? AS unicodeWording FROM visible
 ), scored AS MATERIALIZED (
 SELECT id,slug,showVoters,title,description,(${score}) AS matches FROM candidates WHERE unicodeWording=0
 ), ranked AS (
 SELECT id,slug,showVoters,title,description FROM scored WHERE matches>0 ORDER BY matches DESC,slug LIMIT 5
 ) SELECT * FROM ranked
 UNION ALL SELECT id,slug,showVoters,title,description FROM candidates WHERE unicodeWording=1`
 const rows=await db.prepare(query).bind(nonAscii,...asciiTerms.map(term=>`*[^a-z0-9]${term}[^a-z0-9]*`)).all<{id:string;slug:string;showVoters:number;title:string;description:string}>()
 return rows.results.map(row=>{const words=new Set(lexicalTerms(`${row.title}\n${row.description}`));return {...(operator?{id:row.id}:{showVoters:!!row.showVoters}),slug:row.slug,title:row.title,description:row.description,matchedTerms:terms.filter(term=>words.has(term))}})
 .filter(row=>row.matchedTerms.length).sort((a,b)=>b.matchedTerms.length-a.matchedTerms.length||(a.slug<b.slug?-1:a.slug>b.slug?1:0)).slice(0,5)
}
