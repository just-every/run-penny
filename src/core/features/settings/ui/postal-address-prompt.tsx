import {useEffect} from 'react'
import {useOperatorResource} from '@/core/app/ui/operator-resource'
import {textLinkClass} from '@/core/ui/app/classes'
export function PostalAddressPrompt(){
 const [settings,reload]=useOperatorResource<{owner:boolean;postalAddressRequired:boolean}>('/api/operator/settings/mail')
 useEffect(()=>{window.addEventListener('penny-mail-identity-changed',reload);return ()=>window.removeEventListener('penny-mail-identity-changed',reload)},[reload])
 return settings.kind==='ready'&&settings.data.postalAddressRequired?<aside className="my-5 rounded-xl border border-penny-line bg-penny-card p-5" aria-label="Business postal address required"><h2 className="text-lg font-bold">Confirm your business postal address</h2><p className="mt-2">A business postal address is needed before voting or submitting can subscribe customers to email updates. {settings.data.owner?<a href="/app/settings#mail-identity" className={textLinkClass}>Confirm the company name and postal address in email settings.</a>:'Ask the installation owner to record the business postal address.'}</p></aside>:null
}
