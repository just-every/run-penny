/** JSON string token locations in JavaScript UTF-16 offsets. Paths distinguish
 * repeated values; JSON.parse validates syntax before this structural walk. */
export function jsonStringSpans(text:string){
 JSON.parse(text)
 const spans=new Map<string,{start:number;end:number;value:string}>();let at=0
 const space=()=>{while(/\s/.test(text[at]??'')&&at<text.length)at++}
 function string(){const start=at++;while(at<text.length){const c=text[at++];if(c==='\\')at++;else if(c==='"')break}return {start,end:at,value:JSON.parse(text.slice(start,at)) as string}}
 function value(path:string[]){
  space();const c=text[at]
  if(c==='"'){spans.set(JSON.stringify(path),string());return}
  if(c==='{'){at++;space();if(text[at]==='}'){at++;return}while(at<text.length){space();const key=string().value;space();at++;value([...path,key]);space();if(text[at++]==='}')return}}
  else if(c==='['){at++;space();if(text[at]===']'){at++;return}let index=0;while(at<text.length){value([...path,String(index++)]);space();if(text[at++]===']')return}}
  else{while(at<text.length&&!/[\s,\]}]/.test(text[at]))at++}
 }
 value([]);return spans
}
