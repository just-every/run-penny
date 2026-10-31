import {maskValues,privateValues,type PrivateValue} from '../privacy'
import {settings} from '../configuration'

/** Native members have no commercial grant. ROLE-001 can extend this boundary. */
export async function askPrivacy(db:D1Database,role:string){
 const includePrivate=!!(await settings(db)).include_private,commercial=role==='owner'||role==='admin'
 const values=await privateValues(db)
 const revenues=(await db.prepare('SELECT revenue_cents FROM accounts WHERE revenue_cents IS NOT NULL LIMIT 10001').all<{revenue_cents:number}>()).results
 const commercialValues:PrivateValue[]=revenues.flatMap(({revenue_cents:cents})=>{
  const dollars=cents/100
  return [...new Set([String(cents),String(dollars),dollars.toFixed(2),new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(dollars),new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(dollars)])].map(value=>({value,field:'Revenue'}))
 })
 const withheld=[...values.filter(v=>!includePrivate||!commercial&&['Revenue','Account health','Renewal date'].includes(v.field)),...(!includePrivate||!commercial?commercialValues:[])].sort((a,b)=>b.value.length-a.value.length)
 return {includePrivate,commercial,clean:(text:string)=>{
  const cleaned=maskValues(text,withheld) as string
  // Free text is a field too: a commercial line cannot bypass a member's projection.
  return !commercial?cleaned.split('\n').map(line=>/\b(revenue|mrr|arr|opportunit(?:y|ies)|health)\b/i.test(line)?'[commercial context withheld]':line).join('\n'):cleaned
 }}
}
