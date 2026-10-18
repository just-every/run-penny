/** Public rich content is confined to release-approved local media and these video providers. */
export const releaseVideoOrigins=['https://www.youtube-nocookie.com','https://player.vimeo.com'] as const
export interface PublicReleaseLabel {id:string;name:string}
export interface PublicReleaseProduct {id:string;name:string}
export interface ReleaseRichFields {labels:PublicReleaseLabel[];products:PublicReleaseProduct[]}
export function releaseImagePath(slug:string,id:string){return `/api/public/releases/${encodeURIComponent(slug)}/attachments/${encodeURIComponent(id)}`}
export function releaseVideoEmbed(value:string):string|null {
 try {
  const url=new URL(value)
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null
  if(['youtube.com','www.youtube.com','www.youtube-nocookie.com','youtu.be'].includes(url.hostname)){
   const id=url.hostname==='youtu.be'?url.pathname.slice(1):url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/embed\/([^/]+)$/)?.[1]
   return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?`${releaseVideoOrigins[0]}/embed/${id}`:null
  }
  const id=url.hostname==='vimeo.com'?url.pathname.match(/^\/(\d+)$/)?.[1]:url.hostname==='player.vimeo.com'?url.pathname.match(/^\/video\/(\d+)$/)?.[1]:null
  return id?`${releaseVideoOrigins[1]}/video/${id}`:null
 }catch{return null}
}
export function safeReleaseImage(src:string|undefined,slug:string){
 return src&&new RegExp(`^/api/public/releases/${slug.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}/attachments/[0-9A-HJKMNPQRSTVWXYZ]{26}$`).test(src)?src:null
}
