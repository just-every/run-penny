import { fieldLabelClass } from '@/core/ui/app/classes'
import { fieldClass } from '../../auth/client-mutations'
import { defaultFeedbackBoardPolicy,type FeedbackBoardPolicy } from '../board-policy'

export function BoardPolicyFields({policy,onChange,disabled}:{policy:FeedbackBoardPolicy|undefined;onChange:(policy:FeedbackBoardPolicy|undefined)=>void;disabled:boolean}){
 const value=policy??defaultFeedbackBoardPolicy
 const toggles=[['commentsAllowed','Allow requester comments'],['showVoteCounts','Show vote totals publicly'],['showVoters','List voter display names publicly'],['anonymousRequesters','Show requester names as Anonymous']] as const
 return <fieldset className="space-y-3 rounded-lg border border-penny-line p-4">
  <legend className={fieldLabelClass}>Board participation and display</legend>
  <p className="text-sm leading-6 text-penny-muted">Canny’s exports do not include these settings. Copy them from the source board before applying. Without a mapping, Penny allows posts and comments, shows vote totals, hides the voter list and shows requester names.</p>
  <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-4" disabled={disabled} checked={Boolean(policy)} onChange={event=>onChange(event.target.checked?{...defaultFeedbackBoardPolicy}:undefined)}/>Map this board’s participation and display settings</label>
  {policy?<><label className={fieldLabelClass}>Who may post?<select className={fieldClass} disabled={disabled} value={value.postingPolicy} onChange={event=>onChange({...value,postingPolicy:event.target.value as FeedbackBoardPolicy['postingPolicy']})}><option value="requesters">Requesters and operators</option><option value="operators">Operators only</option></select></label>
   {toggles.map(([key,label])=><label key={key} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-4 shrink-0" disabled={disabled} checked={value[key]} onChange={event=>onChange({...value,[key]:event.target.checked})}/>{label}</label>)}
  </>:null}
 </fieldset>
}
