import type { Json } from '../../../../base/modules/import-kit/src/types.ts'
import { FeedbackSourceError } from './ideas'
import type { FeedbackStatus, SavedFeedbackInput, UserVoiceVersion } from './types'
import { aggregateCategory, documentedColumn, omissionReason, uservoiceRequired, voterOnlyColumn } from './uservoice-columns'

type File=SavedFeedbackInput['files'][number]
const zoned=/^\d{4}-\d\d-\d\dT\S*(?:Z|[+-]\d\d:\d\d)$/
const blank=(status:string)=>status||'(blank)'
export const uservoiceUser=(id:string)=>'uservoice-user:'+id

// UserVoice's export article does not state a timestamp format. Accept only the
// zoned ISO form its import templates document; never guess a timezone.
function time(value:string,heading:string,key:string):string {
 if(!zoned.test(value)||!Number.isFinite(Date.parse(value)))throw new FeedbackSourceError(`${heading} for ${key} is not an ISO 8601 timestamp with a timezone, such as 2016-01-01T00:00:00Z. UserVoice does not document its export timestamp format, so Penny does not guess one.`,[heading])
 return value
}
function columns(file:File,headings:string[]) {
 const options=file.uservoice!,version=file.version as UserVoiceVersion,rename=options.headings??{},omitted=options.omissions??[]
 const named=new Map(headings.map(heading=>[heading,rename[heading]??heading]))
 const renamed=[...named.values()]
 if(version==='uservoice-ideas-csv'){const voters=renamed.filter(voterOnlyColumn);if(voters.length)throw new FeedbackSourceError('This file has supporter columns ('+voters.slice(0,3).join(', ')+'), so it is an Ideas & Voters export. Use it as the voters file and take a Regular (ideas only) export for the ideas file.',voters)}
 for(const [from,to] of Object.entries(rename))if(!headings.includes(from)||!documentedColumn(version,to))throw new FeedbackSourceError(`Heading rename ${from} → ${to} needs a heading present in the file and a documented UserVoice column.`,[from])
 if(new Set(renamed).size!==renamed.length)throw new FeedbackSourceError('Each UserVoice heading must have exactly one meaning.',renamed)
 for(const name of omitted)if(!headings.includes(name)||documentedColumn(version,named.get(name)!))throw new FeedbackSourceError(`Listed omission ${name} must be a heading in the file that UserVoice does not document.`,[name])
 const unknown=headings.filter(heading=>!documentedColumn(version,named.get(heading)!)&&!omitted.includes(heading))
 if(unknown.length)throw new FeedbackSourceError('Unknown UserVoice heading: '+unknown.join(', ')+'. Rename it to a documented column in uservoice.headings or list it in uservoice.omissions to keep it private.',unknown)
 const missing=uservoiceRequired[version].filter(name=>!renamed.includes(name))
 if(missing.length)throw new FeedbackSourceError('Missing UserVoice heading: '+missing.join(', ')+'. Include it when choosing export columns.',missing)
 const cell=(row:Record<string,string>,name:string)=>{const heading=headings.find(h=>named.get(h)===name);return heading===undefined?undefined:row[heading]}
 const omissions=(skip:string[],reason?:(name:string)=>string|undefined)=>headings.filter(h=>!skip.includes(named.get(h)!)).map(h=>({field:h,reason:omitted.includes(h)?'Listed by the owner as retained-only; not mapped.':reason?.(named.get(h)!)??omissionReason(named.get(h)!)}))
 return {options,renamed,cell,omissions,scope:{file:file.name,scope:options.scope,filter:options.filter??null}}
}
export function uservoiceIdeas(rows:Record<string,string>[],file:File,headings:string[],statuses:Record<string,FeedbackStatus>):Record<string,Json>[] {
 const {options,renamed,cell,omissions,scope}=columns(file,headings),unmapped=new Set<string>(),forums=new Set<string>()
 const counted=renamed.filter(name=>aggregateCategory(name)),claim=renamed.includes('Voters Count')?'Voters Count':renamed.includes('Votes')?'Votes':null
 const used=['Idea ID','Idea Title','Idea Description','Created Timestamp','Public Status Name','Idea Creator ID','Idea Creator Name',...counted,...(options.forums?['Forum ID']:[])]
 const values=rows.map(row=>{
  const key=cell(row,'Idea ID')!.trim(),title=cell(row,'Idea Title')!,description=cell(row,'Idea Description')!,status=cell(row,'Public Status Name')!
  if(!key)throw new FeedbackSourceError('Idea ID is empty; Penny never invents a source key.',['Idea ID'])
  if(!title.trim())throw new FeedbackSourceError('Idea Title is empty for idea '+key+'.',['Idea Title'])
  const created=time(cell(row,'Created Timestamp')!,'Created Timestamp','idea '+key),mapped=statuses[status]
  if(!mapped)unmapped.add(blank(status))
  const forum=cell(row,'Forum ID')??'',board=options.forums?options.forums[forum]:file.boardId!
  if(!board)forums.add(forum||'(blank)')
  const creator=cell(row,'Idea Creator ID')?.trim(),author=creator?{id:uservoiceUser(creator),name:cell(row,'Idea Creator Name')?.trim()||'UserVoice user '+creator,created}:null
  const aggregates=counted.flatMap(field=>{
   const raw=cell(row,field)!.trim(),category=aggregateCategory(field)!
   if(!raw)return []
   if(category==='count'?!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw)):!/^\d+(?:\.\d+)?$/.test(raw))throw new FeedbackSourceError(`${field} for idea ${key} is not a plain nonnegative ${category==='count'?'whole number':'number'}.`,[field])
   return [{field,category,value:Number(raw)}]
  })
  const notes=[...omissions(used),...(description.trim()?[]:[{field:'Idea Description',reason:'The description is empty; the supplied Idea Title is the evidence wording.'}])]
  return {id:key,_format:'uservoice-ideas-csv',_boardId:board,_row:row,_uservoice:{...scope,key,title,details:description.trim()?description:title,status:blank(status),mapped,created,...(author?{author}:{}),aggregates,claimed:claim?(aggregates.find(item=>item.field===claim)?.value??null):null,claimField:claim,omissions:notes}} as Record<string,Json>
 })
 if(unmapped.size)throw new FeedbackSourceError('Unmapped UserVoice status: '+[...unmapped].join(', ')+'. Map each Public Status Name in statuses.',[...unmapped])
 if(forums.size)throw new FeedbackSourceError('Unmapped UserVoice forum: '+[...forums].join(', ')+'. Map each Forum ID in uservoice.forums.',[...forums])
 return values
}
// One idea and supporter pair is one attribution. UserVoice repeats the pair
// for each associated account and each captured feedback; every row is kept.
export function uservoiceVoters(rows:Record<string,string>[],file:File,headings:string[]):Record<string,Json>[] {
 const {renamed,cell,omissions,scope}=columns(file,headings),pairs=new Map<string,Record<string,string>[]>()
 const proxyColumns=renamed.includes('Feedback Capturer')||renamed.includes('Feedback Captured By')
 for(const row of rows){
  const idea=cell(row,'Idea ID')!.trim(),user=cell(row,'User ID')!.trim()
  if(!idea||!user)throw new FeedbackSourceError('Every supporter row needs an Idea ID and a User ID; Penny never matches people by name or email.',[idea?'User ID':'Idea ID'])
  time(cell(row,'Linked Idea Creation Date')!,'Linked Idea Creation Date','supporter '+user+' on idea '+idea)
  pairs.set(idea+'/'+user,[...pairs.get(idea+'/'+user)??[],row])
 }
 const used=['Idea ID','User ID','User Name','Linked Idea Creation Date']
 const ideaLevel=(name:string)=>voterOnlyColumn(name)?undefined:'Idea-level column repeated on each supporter row; the idea comes from the Ideas export.'
 return [...pairs].map(([id,group])=>{
  const first=group[0],idea=cell(first,'Idea ID')!.trim(),user=cell(first,'User ID')!.trim(),created=group.map(row=>cell(row,'Linked Idea Creation Date')!).sort((a,b)=>Date.parse(a)-Date.parse(b))[0]
  const captured=(row:Record<string,string>)=>{const capturer=cell(row,'Feedback Capturer')?.trim();return capturer!==undefined&&capturer!==''?capturer!==user:Boolean(cell(row,'Feedback Captured By')?.trim())}
  const supporterType=proxyColumns&&group.every(captured)?'proxy':'unmarked'
  return {id,post:idea,voter:{id:uservoiceUser(user),name:cell(first,'User Name')?.trim()||'UserVoice user '+user,created},created,_format:'uservoice-voters-csv',_rows:group,_uservoice:{...scope,rows:group.length,supporterType,proxyColumns,omissions:omissions(used,ideaLevel)}} as Record<string,Json>
 })
}
