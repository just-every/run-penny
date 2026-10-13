import { Buffer } from 'node:buffer'
import type { SavedFeedbackInput } from '@/core/features/imports/types'

// Synthetic only, built from the headings in UserVoice's "Column Definitions
// for Exports" article. No real UserVoice export has been supplied.
export const created='2024-07-08T09:10:11Z'
const cell=(value:string)=>/[",\r\n]/.test(value)?'"'+value.replaceAll('"','""')+'"':value
export const uservoiceCsv=(headings:string[],rows:string[][])=>'﻿'+[headings,...rows].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
export const ideaHeadings=['Idea ID','Idea Title','Idea Description','Portal URL','Created Timestamp','Public Status Name','Idea Creator ID','Idea Creator Name','Idea Creator Email Address','Forum ID','Forum Name','Voters Count','Total Revenue','Parent ID','Moderation State','Internal Status Name','cv_Priority']
export const voterHeadings=['Idea ID','Idea Title','Voters Count','User ID','User Name','User Email Address','Account ID','Account Name','Linked Idea Creation Date','Subscribed','Feedback ID','Feedback Description','Feedback Capturer','Feedback Captured By']
const idea=(id:string,title:string,description:string,status:string,creator:string,claimed:string)=>[id,title,description,'https://example.uservoice.com/forums/1/suggestions/'+id,created,status,creator,creator?'Creator Café':'',creator?'creator@example.test':'','f1','Product ideas',claimed,claimed==='5'?'1200.50':'','','Published','Triage','High']
const voter=(ideaId:string,user:string,name:string,email:string,account:string,feedback:string,capturer:string)=>[ideaId,'Idea '+ideaId,'5',user,name,email,account,account?'Account '+account:'',created,'TRUE',feedback,feedback?'Captured private wording':'',capturer,capturer?'Admin Nine':'']
export const defaultIdeas=[idea('101','Keyboard, labels','Exact café "quote"\r\nSecond line','Under Review','c1','5'),idea('102','Dark mode','','','','2')]
// Six rows, five supporters: Bea's proxy vote repeats for a second account, and
// a different person (u3) shares Bea's name and address but is never merged.
export const defaultVoters=[voter('101','c1','Creator Café','creator@example.test','','',''),voter('101','u1','Alex','alex@example.test','a1','',''),voter('101','u2','Bea','shared@example.test','a1','fb-1','admin-9'),voter('101','u2','Bea','shared@example.test','a2','fb-1','admin-9'),voter('102','u1','Alex','alex@example.test','a1','',''),voter('102','u3','Bea','shared@example.test','','','')]
export function uservoiceFixture(namespace='uservoice-history',{ideas=defaultIdeas,voters=defaultVoters,scope='filtered' as 'complete'|'filtered'}={}):SavedFeedbackInput {
 const options={scope,...(scope==='filtered'?{filter:'Status: open ideas; Forum: Product ideas'}:{})}
 return {namespace,statuses:{'Under Review':'under_review','':'open'},boards:[{id:'uv-board',name:'UserVoice ideas',isPrivate:false,created}],files:[
  {name:'ideas.csv',kind:'posts',version:'uservoice-ideas-csv',boardId:'uv-board',uservoice:{...options,forums:{f1:'uv-board'},omissions:['cv_Priority']},base64:Buffer.from(uservoiceCsv(ideaHeadings,ideas)).toString('base64')},
  {name:'voters.csv',kind:'votes',version:'uservoice-voters-csv',uservoice:options,base64:Buffer.from(uservoiceCsv(voterHeadings,voters)).toString('base64')},
 ]}
}
// 300 supporter rows across 30 ideas. One person (one User ID and address)
// supports five ideas; a second User ID reuses that address on another idea.
export function largeUservoiceFixture(namespace='uservoice-crowd'):SavedFeedbackInput {
 const ideas=Array.from({length:30},(_,i)=>idea(String(1000+i),'Historical idea '+i,'Supplied wording '+i,'Under Review','','10'))
 const voters=Array.from({length:300},(_,i)=>i<5?voter(String(1000+i),'shared','Shared Person','same@example.test','','',''):i===5?voter('1005','other','Other Person','same@example.test','','',''):voter(String(1000+i%30),'u'+i,'Supporter '+i,'supporter'+i+'@example.test','acct'+i%7,i%10===0?'fb'+i:'',i%10===0?'admin-9':''))
 return uservoiceFixture(namespace,{ideas,voters,scope:'complete'})
}
// 30 ideas and 61 supporters in at most 200 records whose plan is larger than one
// page, so it is applied as a paged stream. One person supports the first and the
// last idea, so their two votes fall on different pages.
export function pagedUservoiceFixture(namespace='uservoice-paged'):SavedFeedbackInput {
 const ideas=Array.from({length:30},(_,i)=>idea(String(2000+i),'Paged idea '+i,'Paged wording '+i,'Under Review','','2'))
 const spanning=(ideaId:string)=>voter(ideaId,'spanning','Spanning Supporter','spanning@example.test','','','')
 const voters=[spanning('2000'),...Array.from({length:60},(_,i)=>voter(String(2000+i%30),'p'+i,'Paged supporter '+i,'paged'+i+'@example.test','','','')),spanning('2029')]
 return uservoiceFixture(namespace,{ideas,voters,scope:'complete'})
}
