export const kinds=['ssn','card','phone','email','credential'] as const
export type Kind=typeof kinds[number]
export interface Rules {enabled:boolean;kinds:Kind[];patterns:string[]}
export interface Span {start:number;end:number;kind:Kind|'custom'}
export const defaultRules:Rules={enabled:false,kinds:[...kinds],patterns:[]}
/** Fixed-width patterns have no ambiguous repetition, groups, lookarounds or
 * backreferences. Matching also has an explicit per-excerpt step budget. */
export function compilePattern(pattern:string):RegExp[]{
 if(!pattern||pattern.length>160)throw new Error('Use a pattern of 1–160 characters.')
 const tokens:RegExp[]=[]
 for(let i=0;i<pattern.length;){
  let atom=pattern[i++]
  if(atom==='\\'){
   if(i===pattern.length||!/[dws\\.*+?^$()[\]{}|\-]/.test(pattern[i]))throw new Error('Unsupported pattern escape.')
   atom+=pattern[i++]
  }else if(atom==='['){
   const start=i;let escaped=false
   for(;i<pattern.length;i++){if(pattern[i]===']'&&!escaped)break;escaped=pattern[i]==='\\'&&!escaped}
   if(i===pattern.length||i===start||pattern.slice(start,i).includes('['))throw new Error('Invalid character class.')
   atom+=pattern.slice(start,i+1);i++
  }else if(/[+*?(){}|^$\]]/.test(atom))throw new Error('Only fixed-width literals, classes and {n} repetitions are safe here.')
  let count=1
  if(pattern[i]==='{'){
   const match=/^\{([1-9][0-9]?)\}/.exec(pattern.slice(i))
   if(!match||Number(match[1])>64)throw new Error('Repetitions must be fixed {n}, from 1 to 64.')
   count=Number(match[1]);i+=match[0].length
  }
  let token:RegExp;try{token=new RegExp('^(?:'+atom+')$','u')}catch{throw new Error('Invalid pattern.')}
  for(let n=0;n<count;n++)tokens.push(token)
  if(tokens.length>256)throw new Error('Expanded pattern exceeds 256 characters.')
 }
 return tokens
}
export function luhn(value:string){
 const digits=value.replace(/[ -]/g,'')
 if(!/^\d{13,19}$/.test(digits)||/^(\d)\1+$/.test(digits))return false
 let sum=0;for(let i=digits.length-1,twice=false;i>=0;i--,twice=!twice){let n=Number(digits[i]);if(twice){n*=2;if(n>9)n-=9}sum+=n}
 return sum%10===0
}
export function detect(text:string,rules:Rules):Span[]{
 if(!rules.enabled)return []
 if(text.length>200000)throw new Error('redaction_excerpt_limit')
 const found:Span[]=[],existing=[...text.matchAll(/\[REDACTED:(?:ssn|card|phone|email|credential|custom)\]/g)].map(match=>({start:match.index,end:match.index+match[0].length}))
 const push=(start:number,end:number,kind:Span['kind'])=>{if(!existing.some(span=>start>=span.start&&end<=span.end))found.push({start,end,kind})}
 const scan=(kind:Kind,pattern:RegExp,group=0,admit=(value:string)=>!!value)=>{
  if(!rules.kinds.includes(kind))return
  for(const match of text.matchAll(pattern)){const value=match[group];if(admit(value)){const start=match.index+(group?match[0].lastIndexOf(value):0);push(start,start+value.length,kind)}}
 }
 scan('ssn',/\b(?!000|666|9\d\d)\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}\b/g)
 scan('ssn',/\b(?:SSN|social security(?: number)?)\s*[:#]?\s*((?!000|666|9\d\d)\d{3}(?!00)\d{2}(?!0000)\d{4})\b/gi,1)
 scan('card',/(?<!\d)\d[\d -]{11,36}\d(?!\d)/g,0,luhn)
 scan('phone',/(?<![\w])(?:\+?1[ .-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[ .-]?[2-9]\d{2}[ .-]?\d{4}(?!\d)/g)
 scan('phone',/(?<![\w])\+[2-9]\d(?:[ .-]?\d){7,13}(?!\d)/g)
 scan('email',/\b[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?\.[A-Za-z]{2,63}\b/g)
 scan('credential',/\b(?:password|secret|api[_-]?key|access[_-]?token|credential)\s*[:=]\s*["']?([^\s;"']{8,})/gi,1)
 let steps=0
 if(rules.patterns.length>10)throw new Error('redaction_pattern_limit')
 for(const pattern of rules.patterns){const tokens=compilePattern(pattern)
  for(let start=0;start+tokens.length<=text.length;start++){
   let matched=true
   for(let n=0;n<tokens.length;n++){if(++steps>1000000)throw new Error('redaction_step_limit');if(!tokens[n].test(text[start+n])){matched=false;break}}
   if(matched){push(start,start+tokens.length,'custom');start+=tokens.length-1}
  }
 }
 // Union overlapping sensitive spans: a shorter detector must not expose the
 // remainder of a longer value. Stable markers never contain the source value.
 found.sort((a,b)=>a.start-b.start||b.end-a.end)
 const spans:Span[]=[]
 for(const span of found){const last=spans.at(-1);if(last&&span.start<last.end)last.end=Math.max(last.end,span.end);else spans.push({...span})}
 return spans
}
export function redact(text:string,rules:Rules):string{
 const spans=detect(text,rules);let result='',offset=0
 for(const span of spans){result+=text.slice(offset,span.start)+`[REDACTED:${span.kind}]`;offset=span.end}
 return result+text.slice(offset)
}
