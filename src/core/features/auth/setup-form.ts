import {fontHead} from '@/core/ui/brand/font-head'
import {themeFrame} from '@/base/theme-frame'
import branding from '@/branding.json'
import type {MailIdentity} from '../settings/mail-identity'
import type {WorkspaceClock} from '../settings/workspace-clock'
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
/** Product fields keep Base's theme; a nonce-bound script preselects browser time. */
export async function setupForm(base:Response,identity:MailIdentity|null,clock:WorkspaceClock,deploymentTimezone:boolean){
 const frame=await themeFrame({href:'/rer-theme.css',productName:branding.name,accentColor:branding.accent})
 const nonce=crypto.randomUUID(),timezone=clock.confirmed||deploymentTimezone?clock.timezone:''
 const preferences=`<fieldset><legend>Workspace time and customer email</legend><p><label>Workspace timezone<input name="timezone" required maxlength="100" list="timezones" value="${escape(timezone)}" placeholder="America/New_York"></label><datalist id="timezones"></datalist></p><p>Requester email waits during quiet hours in this timezone. Decision-review email sends without quiet hours.</p><p><label><input type="checkbox" name="quietEnabled" value="yes"${clock.quietEnabled?' checked':''}> Use requester quiet hours</label></p><p><label>Quiet hours start (0–23)<input type="number" name="quietStart" min="0" max="23" required value="${clock.quietStart}"></label></p><p><label>Quiet hours end (0–23)<input type="number" name="quietEnd" min="0" max="23" required value="${clock.quietEnd}"></label></p></fieldset>`
 const body=`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finish setup</title>${fontHead}${frame.head}</head><body><main>${frame.brand}<h1>Finish setup</h1><p>Name your business and confirm the postal address customers will see in email updates.</p><form method="post" action="/setup"><p><label>Company name<input name="companyName" required maxlength="160" value="${escape(identity?.companyName??'')}"></label></p><p><label>Business postal address<input name="postalAddress" required maxlength="2000" value="${escape(identity?.postalAddress??'')}"></label></p><p><label><input type="checkbox" name="confirm" value="yes" required> I confirm this owner account and business postal address are ready to use.</label></p><button type="submit">Finish setup</button></form></main></body></html>`
 const script=`<script nonce="${nonce}">const input=document.querySelector('[name="timezone"]');if(!input.value)input.value=Intl.DateTimeFormat().resolvedOptions().timeZone;for(const value of Intl.supportedValuesOf('timeZone')){const option=document.createElement('option');option.value=value;document.getElementById('timezones').append(option)}</script>`
 const headers=new Headers(base.headers),policy=headers.get('content-security-policy')??"default-src 'none'"
 headers.set('content-security-policy',policy.replace(/;?\s*script-src[^;]*/g,'')+`; script-src 'nonce-${nonce}'`)
 return new Response(body.replace('<p><label><input type="checkbox" name="confirm"',preferences+'<p><label><input type="checkbox" name="confirm"').replace('</body>',script+'</body>'),{status:base.status,headers})
}
