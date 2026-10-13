// UserVoice "Column Definitions for Exports" (help.uservoice.com article
// 360035485693, read 2026-10-12): the documented Ideas Only and Ideas & Voters
// headings. Anything else is refused by name unless the owner lists it.
const ideaColumns=['Idea ID','Idea Title','Idea Description','Description Mime Type','Portal URL','Admin Console URL','Created Timestamp','Created User Agent','Referrer Link','Browser','Browser Version','OS Version','Created on Mobile','Moderation State','Idea Channel','Inappropriate Flags Count','Last Updated Timestamp','Closed Timestamp','Comments Count','Notes Count','Votes','Request Count','Voters Count','Supporting Accounts Count','Total Revenue','Average Customer Activity','Recent Customer Activity','Customer Activity Trend','Forum ID','Category ID','Parent ID','Ticket ID','Idea Creator ID','Idea Creator Name','Idea Creator Email Address','User SSO ID','Label ID','Forum Name','Category Name','Labels','Supporters NPS','NPS Detractors','NPS Promoters','NPS Passive','Public Status ID','Public Status Name','Status Update ID','Public Status Update Message','Public Status Updated Timestamp','Public Status Creator ID','Public Status Creator Name','Public Status Creator Email Address','Linked Jira Issues','Jira Status Update Timestamp','Linked ADO Work Items','ADO Updated Timestamp','Internal Status Update ID','Internal Status Name','Internal Status Update Message','Internal Status Update Timestamp','Internal Status Update Creator ID','Internal Status Update Creator Name']
const voterColumns=['User ID','User Name','User Email Address','Job Title','User Created Timestamp','User Last Updated','Last Login','IP Address','Country','Region','City','NPS Rating','NPS Group','Last NPS Rating','Previous NPS Rating','Previous NPS Group','Previous NPS Timestamp','Account ID','Account Name','Account Creation Date','Account Revenue','Account LTV','Account Plan','External User ID','External User Name','External User Type','External User Creation Date','Idea User ID','Subscribed','Linked Idea Creation Date','Feedback ID','Feedback Description','Feedback Capturer','Feedback Captured By','Feedback Captured By Email Address','Feedback Captured Team','Account Status','Account Type','Company Size','Company Industry','% Opportunities Won','% Revenue Won','Lost Opportunities','Lost Revenue','Open Opportunities','Potential Revenue','Opportunity ID']
const segment=/^.+ (?:Vote Count|Supporting Accounts|Total Revenue)$/
export const uservoiceRequired={'uservoice-ideas-csv':['Idea ID','Idea Title','Idea Description','Created Timestamp','Public Status Name'],'uservoice-voters-csv':['Idea ID','User ID','Linked Idea Creation Date']} as const
export function documentedColumn(version:string,heading:string):boolean {
 return ideaColumns.includes(heading)||segment.test(heading)||version==='uservoice-voters-csv'&&voterColumns.includes(heading)
}
export const voterOnlyColumn=(heading:string)=>voterColumns.includes(heading)
export function aggregateCategory(heading:string):'count'|'revenue'|null {
 if(heading==='Total Revenue'||/ Total Revenue$/.test(heading))return 'revenue'
 return ['Votes','Voters Count','Request Count','Comments Count','Notes Count','Inappropriate Flags Count','Supporting Accounts Count'].includes(heading)||segment.test(heading)?'count':null
}
const reasons:[RegExp,string][]=[
 [/Email Address$|^(?:IP Address|Country|Region|City|User SSO ID|Created User Agent|Browser|Browser Version|OS Version|Job Title|Last Login|External User .+)$/,'Personal contact or device data stays in the private original. It never becomes a sign-in, verified address, consent or outreach audience.'],
 [/^(?:Account .+|Supporting Accounts Count|Company .+|Total Revenue|.+ Total Revenue|.*Opportunit.+|.* Revenue.*|% .+|.*NPS.*|Previous NPS .+)$/,'Organization and commercial data stays in the private original. No account is created or linked; link accounts natively.'],
 [/^Parent ID$/,'The merge relationship stays in the private original. UserVoice exports no merge date, so merge natively.'],
 [/^Moderation State$/,'Publication and moderation stay separate native decisions.'],
 [/^Internal Status .+$/,'Internal status stays in the private original and is never mapped.'],
 [/^(?:Status Update ID|Public Status (?:ID|Update Message|Updated Timestamp|Creator .+))$/,'Status history stays in the private original; only the current public status name is mapped.'],
 [/^Subscribed$/,'A UserVoice subscription never becomes a follow or notification permission.'],
 [/^Feedback (?:ID|Description|Captured Team)$/,'Captured feedback stays in the private original; it is not turned into evidence.'],
 [/^Feedback Capture(?:r|d By)$/,'Used only to mark a proxy vote; the capturing admin gets no identity in Penny.'],
]
export function omissionReason(heading:string):string {
 return reasons.find(([pattern])=>pattern.test(heading))?.[1]??'Documented UserVoice column retained in the private original; not mapped.'
}
