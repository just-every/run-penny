import {fontHead} from '@/core/ui/brand/font-head'
import {themeFrame} from '@/base/theme-frame'
import branding from '@/branding.json'
import type {MailIdentity} from '../settings/mail-identity'
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
/** Product fields in the same Base theme frame; no client script is needed. */
export async function setupForm(base:Response,identity:MailIdentity|null){
 const frame=await themeFrame({href:'/rer-theme.css',productName:branding.name,accentColor:branding.accent})
 const body=`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finish setup</title>${fontHead}${frame.head}</head><body><main>${frame.brand}<h1>Finish setup</h1><p>Name your business and confirm the postal address customers will see in email updates.</p><form method="post" action="/setup"><p><label>Company name<input name="companyName" required maxlength="160" value="${escape(identity?.companyName??'')}"></label></p><p><label>Business postal address<input name="postalAddress" required maxlength="2000" value="${escape(identity?.postalAddress??'')}"></label></p><p><label><input type="checkbox" name="confirm" value="yes" required> I confirm this owner account and business postal address are ready to use.</label></p><button type="submit">Finish setup</button></form></main></body></html>`
 return new Response(body,{status:base.status,headers:base.headers})
}
