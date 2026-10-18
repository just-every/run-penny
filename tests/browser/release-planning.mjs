import assert from 'node:assert/strict'
import {moderationJourney} from './moderation-runtime.mjs'
await moderationJourney('release-planning',async({runtime,origin,operator,json,pageFor,capture})=>{
 const clock=new Date(),date=(offset)=>new Date(Date.UTC(clock.getUTCFullYear(),clock.getUTCMonth()+offset,15)).toISOString().slice(0,10),releaseDate=date(1),editedDate=date(2),publicEta=`${releaseDate.slice(0,4)}-Q${Math.ceil(Number(releaseDate.slice(5,7))/3)}`
 const now=clock.toISOString(),ids=['01J00000000000000000000001','01J00000000000000000000002','01J00000000000000000000003'],titles=['Reporting data model','Scheduled finance reports','Finance launch']
 for(const [index,id] of ids.entries())await runtime.db.prepare("INSERT INTO roadmap_items(id,slug,title,summary,status,target_window,created_at,updated_at) VALUES(?,?,?,'Monthly reporting improvements','planned',?,?,?)").bind(id,id,titles[index],index===0?date(-1).slice(0,7):releaseDate.slice(0,7),now,now).run()
 const actor=await runtime.db.prepare('SELECT id FROM operators').first('id')
 await runtime.db.prepare("INSERT INTO roadmap_publications(id,roadmap_item_id,public_title,public_summary,approved_by_operator_id,approved_at,public_slug,board_id,public_eta,created_at,updated_at) VALUES('planning-public',?,'Finance launch','Customer-safe reporting',?,?,'finance-launch',(SELECT id FROM boards WHERE slug='finance'),?,?,?)").bind(ids[2],actor,now,publicEta,now,now).run()
 const owner=await pageFor({cookie:operator.Cookie});await owner.goto(origin+'/app/roadmap',{waitUntil:'networkidle'})
 const panel=owner.getByRole('region',{name:'Release planning',exact:true})
 await panel.locator('summary').filter({hasText:/^Create release plan$/}).click()
 const create=panel.getByRole('form',{name:'Create release plan',exact:true})
 await create.getByLabel('Plan name',{exact:true}).fill('Autumn finance launch');await create.getByLabel('Release date',{exact:true}).fill(releaseDate)
 for(const title of titles)await create.getByLabel(title,{exact:true}).check()
 await create.getByRole('button',{name:'Create plan',exact:true}).click()
 await panel.getByRole('heading',{name:'Autumn finance launch',exact:true}).waitFor()
 await panel.locator('summary').filter({hasText:/^Manage dependencies$/}).click()
 const dependency=panel.getByRole('form',{name:'Manage dependencies',exact:true})
 for(const [blocker,dependent] of [[0,1],[1,2]]){await dependency.getByLabel('Blocker',{exact:true}).selectOption(ids[blocker]);await dependency.getByLabel('Blocked item',{exact:true}).selectOption(ids[dependent]);await dependency.getByRole('button',{name:'Save dependency',exact:true}).click();await panel.getByRole('list',{name:'Recorded dependencies'}).getByText(new RegExp(titles[dependent])).waitFor()}
 await panel.getByText(`Public ETA ${publicEta} at risk`,{exact:true}).waitFor()
 await capture(owner,'planned-release-and-slip',panel)
 // Use the normal delivery move control; the plan's live state and risk clear together.
 const card=owner.locator(`#roadmap-item-${ids[0]}`);await card.getByText('Edit, approve or move',{exact:true}).click()
 const move=card.getByRole('form',{name:'Move roadmap item',exact:true});await move.getByLabel('New status',{exact:true}).selectOption('shipped');await move.getByLabel('Reason',{exact:true}).fill('The reporting data model is ready.')
 await move.getByRole('button',{name:'Record move',exact:true}).click()
 await panel.getByText('No slipped dependencies on active items.',{exact:true}).waitFor()
 const release=panel.getByRole('region',{name:'Autumn finance launch',exact:true});assert.match(await release.innerText(),/Reporting data model · Shipped/)
 await capture(owner,'resolved-release-plan',panel)
 await release.getByText('Edit release plan',{exact:true}).click()
 const edit=release.getByRole('form',{name:'Edit release plan: Autumn finance launch',exact:true});await edit.getByLabel('Release date',{exact:true}).fill(editedDate);await edit.getByRole('button',{name:'Save plan',exact:true}).click();await release.getByText(`Planned for ${editedDate}`,{exact:true}).waitFor()
 await owner.reload({waitUntil:'networkidle'});await panel.getByText(`Planned for ${editedDate}`,{exact:true}).waitFor();await capture(owner,'saved-release-plan',panel)
 const publicText=JSON.stringify(await json('/api/public/roadmap'));assert.equal(publicText.includes('Autumn finance launch'),false);assert.equal(publicText.includes('at risk'),false)
 assert.equal((await fetch(origin+'/api/operator/release-planning')).status,401)
})
