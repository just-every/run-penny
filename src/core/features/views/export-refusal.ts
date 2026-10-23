/** Aggregate custody information; never a creator, view name or definition. */
export function privateViewsRefusal(count:number,lowerBound=false):string{
 return `${lowerBound?'At least ':''}${count} private saved view${count===1?' prevents':'s prevent'} this backup. Ask their creators to share or delete these views, then try again.`
}
