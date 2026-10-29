/** Everyday metadata follows the operator's locale; exact source values stay in inspection. */
export function LearningDate({value,empty='Not established',dateOnly=false}:{value:string|null;empty?:string;dateOnly?:boolean}) {
 if(!value)return <>{empty}</>
 return <time dateTime={value}>{new Intl.DateTimeFormat(undefined,{dateStyle:'medium',...(dateOnly?{}:{timeStyle:'short' as const})}).format(new Date(value))}</time>
}
