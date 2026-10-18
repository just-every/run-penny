import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { safeReleaseImage,releaseVideoEmbed } from '../rich-content'
import { secondaryButtonClass,textLinkClass } from '@/core/features/portal/ui/portal-classes'
function ReleaseVideo({src,title}:{src:string;title:string}){
 const [loaded,setLoaded]=useState(false)
 return loaded?<iframe src={src} title={title} loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture" allowFullScreen className="aspect-video w-full rounded-xl border border-penny-line"/>:<button type="button" className={secondaryButtonClass} onClick={()=>setLoaded(true)}>Load video: {title}</button>
}
export function ReleaseMarkdown({body,slug}:{body:string;slug:string}){
 return <div className="space-y-4 break-words text-base leading-7 text-penny-ink [overflow-wrap:anywhere] [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-penny-paper [&_pre]:p-4 [&_blockquote]:border-l-2 [&_blockquote]:border-penny-line [&_blockquote]:pl-4">
 <ReactMarkdown components={{
  img:({src,alt})=>{const safe=safeReleaseImage(src,slug);return safe?<img src={safe} alt={alt??''} loading="lazy" className="inline-block h-auto max-w-full rounded-xl"/>:<span>{alt??'Image unavailable'}</span>},
  a:({href,children})=>{const video=href&&releaseVideoEmbed(href);if(video)return <ReleaseVideo src={video} title={String(children)}/>;return href&&/^(https?:\/\/|\/[^/]|#)/i.test(href)?<a href={href} rel="noreferrer" className={textLinkClass}>{children}</a>:<span>{children}</span>},
  // React Markdown's default HTML node renderer escapes it as visible text.
  p:({children})=><div>{children}</div>,
 }}>{body}</ReactMarkdown></div>
}
