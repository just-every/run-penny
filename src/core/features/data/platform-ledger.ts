import {NativeError,digest} from '../auth/native-tokens'

// RER Platform (RER Managed) applies migrations/core itself and records each
// applied file's name and SHA-256 in rer_migrations(name,sha256,applied_at).
// That ledger is the installation's: it never travels in an archive and a
// restore never writes it. Every archive door still requires it to list exactly
// this revision's migrations with their file hashes, as Platform records them;
// anything else (an interrupted '<file>#<start>-<end>' row, a missing, extra or
// edited migration) means the database is not this revision's schema.
async function revision():Promise<{name:string;sha256:string}[]>{
 // Vite bundles the files' text; Node scripts that load this module never call it.
 const files=import.meta.glob<string>('../../../../migrations/core/*.sql',{query:'?raw',import:'default'})
 const migrations=await Promise.all(Object.entries(files).map(async([path,load])=>({name:path.split('/').at(-1)!,sha256:await digest(await load())})))
 return migrations.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)
}
export async function assertPlatformLedger(db:D1Database):Promise<void>{
 const columns=(await db.prepare("SELECT name FROM pragma_table_info('rer_migrations')").all<{name:string}>()).results.map(column=>column.name)
 if(!columns.length)return
 const mismatch=()=>new NativeError('migration_history_mismatch',503)
 if(!columns.includes('name')||!columns.includes('sha256'))throw mismatch()
 const [recorded,expected]=await Promise.all([db.prepare('SELECT name,sha256 FROM rer_migrations ORDER BY name').all<{name:string;sha256:string}>(),revision()])
 if(!expected.length||JSON.stringify(recorded.results.map(({name,sha256})=>({name,sha256})))!==JSON.stringify(expected))throw mismatch()
}
