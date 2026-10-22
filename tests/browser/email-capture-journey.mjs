import assert from 'node:assert/strict'
export async function reviewEmailCapture({page,runtime,goto,capture}){
 await goto('/app/settings')
 const panel=page.locator('section[aria-labelledby=mail-identity]')
 await panel.getByLabel('Dedicated capture address').fill('capture@penny.test')
 await panel.getByLabel('Allowed sender domains').fill('example.test')
 const saved=page.waitForResponse(response=>response.url().endsWith('/api/operator/settings/email-capture')&&response.request().method()==='PUT')
 await panel.getByRole('button',{name:'Save capture settings',exact:true}).click()
 assert.equal((await saved).status(),200)
 await panel.getByText('Capture settings saved. Hosted routing must be configured separately.').waitFor()
 await capture('CAP-009-capture-settings')
 const raw='From: operator@example.test\r\nTo: capture@penny.test\r\nMessage-ID: <synthetic-penny-browser@example.test>\r\nAuthentication-Results: mx.cloudflare.net; dmarc=pass header.from=example.test\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n---------- Forwarded message ---------\r\nFrom: Customer <synthetic-penny-browser@example.test>\r\nDate: Thu, 22 Oct 2026 09:00:00 +0000\r\nSubject: Reports\r\nTo: Operator <operator@example.test>\r\n\r\nPlease add scheduled report exports.'
 const mime=raw.replace('Content-Type: text/plain; charset=utf-8\r\n\r\n','MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=synthetic-penny-boundary\r\n\r\n--synthetic-penny-boundary\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n')+'\r\n--synthetic-penny-boundary\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename=synthetic-penny-refused.txt\r\n\r\nSynthetic attachment of a refused type\r\n--synthetic-penny-boundary--\r\n'
 await runtime.email({from:'operator@example.test',to:'capture@penny.test',raw:mime})
 assert.equal(await runtime.db.prepare("SELECT named_speaker FROM evidence_items WHERE source_type='email'").first('named_speaker'),'synthetic-penny-browser@example.test')
 await goto('/app/feedback')
 await page.getByText('Named speaker: synthetic-penny-browser@example.test',{exact:true}).first().waitFor()
 await page.getByText('Please add scheduled report exports.',{exact:false}).first().waitFor()
 await page.getByText('Forwarded email. Attachment omitted: allowed types',{exact:true}).waitFor()
 await capture('CAP-009-original-sender-item')
 assert.equal(runtime.outbox.length,0,'Capture sends no email')
}
