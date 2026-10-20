/** Anthropic's raw-schema subset requires constraints in descriptions; the
 * capability still validates the response against its complete original schema.
 * https://platform.claude.com/docs/en/build-with-claude/structured-outputs */
export function anthropicSchema(schema:Record<string,unknown>):Record<string,unknown>{
 const unsupported=new Set(['minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf','minLength','maxLength','maxItems','uniqueItems','contains','minContains','maxContains','minProperties','maxProperties'])
 function convert(value:unknown):unknown{
  if(Array.isArray(value))return value.map(convert)
  if(!value||typeof value!=='object')return value
  const result:Record<string,unknown>={},constraints:string[]=[]
  for(const [key,item] of Object.entries(value)){
   if(key==='$schema')continue
   if(unsupported.has(key)||(key==='minItems'&&Number(item)>1)){constraints.push(`${key}=${JSON.stringify(item)}`);continue}
   if(['properties','$defs','definitions'].includes(key)&&item&&typeof item==='object')result[key]=Object.fromEntries(Object.entries(item).map(([name,child])=>[name,convert(child)]))
   else result[key]=['const','default','enum'].includes(key)?item:convert(item)
  }
  if(constraints.length)result.description=[result.description??'',`Constraints: ${constraints.join('; ')}.`].filter(Boolean).join(' ')
  return result
 }
 return convert(schema) as Record<string,unknown>
}
