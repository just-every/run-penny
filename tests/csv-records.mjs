/** Small RFC 4180 reader used by route and downloaded-file assertions. */
export function csvRecords(text){
 const rows=[];let row=[],value='',quoted=false
 for(let i=0;i<text.length;i++){
  const char=text[i]
  if(char==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}
  else if(char===','&&!quoted){row.push(value);value=''}
  else if(char==='\r'&&text[i+1]==='\n'&&!quoted){row.push(value);rows.push(row);row=[];value='';i++}
  else value+=char
 }
 if(quoted)throw new Error('Unclosed CSV field')
 if(value||row.length){row.push(value);rows.push(row)}
 const [columns,...records]=rows
 return records.map(values=>Object.fromEntries(columns.map((column,index)=>[column,values[index]])))
}
