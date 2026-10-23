import {z} from 'zod'
import {publicRequestFiltersSchema} from '../portal/routes'
import {proxyVoteSchema} from '../requests/proxy-votes'
const slug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128)
export const feedbackInput=z.object({title:z.string().trim().min(1).max(280),description:z.string().trim().min(1).max(20000),boardSlug:slug,evidenceIds:z.array(z.string().regex(/^[0-9A-HJKMNPQRSTVWXYZ]{26}$/)).max(100).default([])}).strict()
export const proxyInput=z.object({requestSlug:slug,vote:proxyVoteSchema}).strict()
export const searchInput=publicRequestFiltersSchema
export const roadmapInput=z.object({}).strict()
export const toolInputs={search_requests:searchInput,read_roadmap:roadmapInput,add_feedback:feedbackInput,record_proxy_vote:proxyInput}
export type ToolName=keyof typeof toolInputs
