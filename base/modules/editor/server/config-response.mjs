// Server authorization for the editor's public configuration grant.
// requireOwner returns a truthy authenticated owner or throws; false/null refuse.
export function createEditorConfigHandler({requireOwner,readConfig,path='/api/editor/config'}) {
 return async request=>{
  if(new URL(request.url).pathname!==path)return null;
  const headers={'Cache-Control':'no-store, private',Vary:'Cookie'};
  if(request.method!=='GET')return new Response(null,{status:405,headers});
  try{if(!await requireOwner(request))throw Error('owner_required');}catch{return Response.json({error:'owner_required'},{status:403,headers});}
  return Response.json({config:await readConfig(),expiresAt:Date.now()+30000},{headers});
 };
}
