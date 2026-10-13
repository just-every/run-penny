import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
for(const file of ['README.md','ACCEPTANCE.md','RELEASE.json'])test(`[REL-011] ${file} discloses exact unsupported suppression shapes`,async()=>{
 const text=await readFile(new URL('../../'+file,import.meta.url),'utf8')
 assert.match(text,/delayed or asynchronous bounces/i)
 assert.match(text,/sg_message_id/)
 assert.match(text,/historical accepted attempts/i)
 assert.match(text,/recipient snapshot/)
 assert.match(text,/attempt correlation/)
 assert.match(text,/suppression for these excluded events is not implemented/)
 assert.match(text,/REL-011.*not fully satisfied/)
})
