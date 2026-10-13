import { useRouter } from '@tanstack/react-router'
import type { ComponentProps, FormEvent } from 'react'
export function WorkspaceLink({href,...props}:ComponentProps<'a'> & {href:string}) {
 const router=useRouter()
 return <a {...props} href={href} onClick={event=>{props.onClick?.(event);if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();void router.navigate({href})}}/>
}
export function useWorkspaceForm() {
 const router=useRouter()
 return (event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget,query=new URLSearchParams();for(const [key,value] of new FormData(form))if(typeof value==='string'&&value.trim())query.append(key,value);void router.navigate({href:`${new URL(form.action).pathname}${query.size?`?${query}`:''}`})}
}
