import { z } from 'zod'

/** Explicit owner mapping: Canny's documented board API omits these toggles. */
export const feedbackBoardPolicySchema=z.object({
 postingPolicy:z.enum(['requesters','operators']),
 commentsAllowed:z.boolean(),
 showVoteCounts:z.boolean(),
 showVoters:z.boolean(),
 anonymousRequesters:z.boolean(),
}).strict()
export type FeedbackBoardPolicy=z.infer<typeof feedbackBoardPolicySchema>
export const defaultFeedbackBoardPolicy:FeedbackBoardPolicy={postingPolicy:'requesters',commentsAllowed:true,showVoteCounts:true,showVoters:false,anonymousRequesters:false}
export function boardPolicyValues(policy:FeedbackBoardPolicy):Record<string,string|number>{
 return {posting_policy:policy.postingPolicy,comments_allowed:Number(policy.commentsAllowed),show_vote_counts:Number(policy.showVoteCounts),show_voters:Number(policy.showVoters),anonymous_requesters:Number(policy.anonymousRequesters)}
}
