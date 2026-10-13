import { parseConfig, type EditorConfig } from '../src/config';
/** Pass auth.requireEditorOwner (Base) or accounts/requireEditorOwner (an app adapter). */
export async function editorConfigResponse(request: Request, requireOwner: (request: Request) => Promise<unknown>, readConfig: () => Promise<EditorConfig>) {
  const headers = { 'cache-control': 'no-store, private', 'vary': 'Cookie', 'content-type': 'application/json' };
  let owner;try {owner=await requireOwner(request);}catch{}
  if (!owner) return new Response(JSON.stringify({error:'Owner authorization required'}), {status:403,headers});
  const config = parseConfig(await readConfig());
  return new Response(JSON.stringify({config,expiresAt:Date.now()+30_000}), {headers});
}
