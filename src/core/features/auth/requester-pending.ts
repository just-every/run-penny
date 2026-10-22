import {opaqueToken} from './native-tokens'
const key='penny_requester_pending'
export function pendingRequesterToken():string{
 let token=sessionStorage.getItem(key)
 if(!token){token=opaqueToken();sessionStorage.setItem(key,token)}
 return token
}
