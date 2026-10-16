/// <reference path="./operator-preload-module.d.ts" />
import routes from 'virtual:penny-operator-preloads'

export function preloadOperatorModules(response:Response, pathname:string):Response {
  if(!response.ok||!(pathname==='/app'||pathname.startsWith('/app/'))||!response.headers.get('content-type')?.includes('text/html'))return response
  const path=pathname.replace(/\/$/,'')
  const assets=new Set(Object.entries(routes).filter(([route])=>{
    const pattern=route.replace(/\$[^/]+/g,'[^/]+')
    return new RegExp(`^${pattern}(?:/|$)`).test(path)
  }).flatMap(([,assets])=>assets))
  if(!assets.size)return response
  return new HTMLRewriter().on('head',{element(element){
    element.append([...assets].map(href=>`<link rel="modulepreload" href="${href}" crossorigin>`).join(''),{html:true})
  }}).transform(response)
}
