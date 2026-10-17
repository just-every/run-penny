import {expect} from 'vitest'
import type {PublicBoard} from '@/core/shared/api/public'

type BoardRequest=(path:string,method:'GET'|'PUT',body?:unknown)=>Promise<Response>

/** These fixtures exercise explicit permission; automatic subscription has its own route journey. */
export async function explicitConsentBoard(slug:string,request:BoardRequest){
 const response=await request('/api/public/boards','GET')
 expect(response.status,await response.clone().text()).toBe(200)
 const board=(await response.json() as PublicBoard[]).find(board=>board.slug===slug)
 expect(board?.subscriptionDisclosure).toBeDefined()
 const saved=await request(`/api/operator/boards/${slug}/vote-subscriptions`,'PUT',{enabled:false,version:board!.subscriptionDisclosure!.version})
 expect(saved.status,await saved.clone().text()).toBe(200)
}
