export const requesterOAuthBindings={REQUESTER_GOOGLE_CLIENT_ID:'synthetic-penny-google-client',REQUESTER_GOOGLE_CLIENT_SECRET:'synthetic-penny-google-secret',REQUESTER_GITHUB_CLIENT_ID:'synthetic-penny-github-client',REQUESTER_GITHUB_CLIENT_SECRET:'synthetic-penny-github-secret',MAIL_API_KEY:'synthetic-browser-provider-key'}
export const requesterOAuthEdge={name:'requester-oauth-network',modules:true,compatibilityDate:'2026-08-31',script:`
import {WorkerEntrypoint} from 'cloudflare:workers';
export default class extends WorkerEntrypoint{
 async send(wire){
  const reply=value=>({status:200,headers:{},body:JSON.stringify(value)});
  if(['https://oauth2.googleapis.com/token','https://github.com/login/oauth/access_token'].includes(wire.url)){
   if(wire.method!=='POST'||!new URLSearchParams(wire.body).get('code_verifier'))throw Error('OAuth fixture expected a PKCE exchange');
   return reply({access_token:'synthetic-penny-provider-access',token_type:'bearer'});
  }
  if(wire.method!=='GET')throw Error('OAuth fixture expected GET');
  if(wire.url==='https://openidconnect.googleapis.com/v1/userinfo')return reply({email:'synthetic-penny-google@example.test',email_verified:true,name:'Synthetic requester'});
  if(wire.url==='https://api.github.com/user/emails')return reply([{email:'synthetic-penny-github@example.test',verified:false,primary:true}]);
  throw Error('Unexpected OAuth fixture destination');
 }
}`}
